-- =============================================================================
-- 취소요청 승인이 지원서를 목록에서 증발시키던 결함 수정 (2026-07-27 감사 CANCEL-1)
--
-- 증상:
--   사장님이 스태프의 취소 요청을 "승인" 하면 그 지원서가 구인자·스태프 양쪽 목록에서
--   조용히 사라진다. 에러도 로그도 남지 않는다.
--
-- 원인:
--   cancel_application_atomically 의 취소요청 승인 분기가 cancellation_request JSONB 에
--   snake_case 로 메타를 썼다 — jsonb_build_object('status','approved','reviewed_at',...).
--   클라 읽기 스키마(cancellationRequestStoredSchema)의 'approved' 분기는
--   reviewedAt / reviewedBy(camelCase)를 필수로 요구하고, toCamelCase 는 **얕은** 변환이라
--   중첩 JSONB 키를 바꾸지 않는다(src/utils/supabase.ts:727).
--   => discriminated union 파싱 실패 => cancellationRequest 를 품은 **지원서 객체 전체**의
--      safeParse 실패 => rowsToApplications 가 그 행을 통째로 버린다
--      (src/repositories/supabase/ApplicationRepositoryHelpers.ts:65).
--
-- 변경:
--   1) 승인 분기의 JSONB 키를 camelCase 로 교정. 나머지 동작은 무변경 —
--      20260711020000 의 본문을 그대로 복사해 해당 키만 치환했다.
--   2) 이미 오염된 행 백필: reviewed_at / reviewed_by 를 camelCase 로 옮긴다.
--      (클라도 두 표기를 모두 수용하도록 고쳤으나 저장 정본은 하나여야 한다)
--
-- 주의: confirmation_history 의 cancelled_at / cancelled_by / cancellation_reason 은
--   **snake_case 가 정본**이다(confirmationHistoryEntrySchema 계약). 건드리지 말 것.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL::text,
  p_rejection_reason text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_application applications%ROWTYPE; v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb; v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb; v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now(); v_assignment_count int := 0; v_new_filled int;
  v_new_status text; v_updated_cancellation_request jsonb;
BEGIN
  -- [보안] 호출자 바인딩: p_actor_id 는 호출자 본인(또는 admin)이어야 함.
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_application FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'application_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled'); END IF;

  -- 멱등 처리
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'employer_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;

  -- 상태 전제 검증
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN
    IF v_application.status != 'confirmed' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation'); END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval'); END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending'); END IF;
  ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type'); END IF;

  SELECT * INTO v_job_posting FROM job_postings WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  -- 행위자별 인가
  -- owner_id 는 nullable(계정삭제 시 ON DELETE SET NULL) — NULL = p_actor_id 가 NULL 로 전파되면
  -- NOT(NULL OR false...) = NULL 이라 IF 미발화 → fail-open. COALESCE 로 fail-closed 고정
  -- (보안리뷰 MEDIUM, 기존 staff_approves 분기도 동일 하드닝 적용).
  IF p_actor_type IN ('staff_approves_cancel_request', 'employer_initiates') THEN
    IF NOT (COALESCE(v_job_posting.owner_id = p_actor_id, false) OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id) OR public.is_admin()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM work_logs WHERE application_id = p_application_id AND status IN ('checked_in', 'checked_out')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in'); END IF;

  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1 INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY WHERE (value->>'cancelled_at') IS NULL LIMIT 1;
  IF v_active_confirmation_entry IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation'); END IF;
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancellation_reason'], COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 전이 결과 상태: 본인 취소·구인자 해제는 applied 복귀, 취소요청 승인은 cancelled
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN v_new_status := 'applied';
  ELSE v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request || jsonb_build_object('status', 'approved', 'reviewedAt', v_now, 'reviewedBy', p_actor_id);
  END IF;

  UPDATE applications SET status = v_new_status::application_status, confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request), cancelled_at = v_now_ts, updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 구인자 확정해제는 스태프에게 직접 통지
  -- (confirmed→applied 전이는 notify_on_application_update 트리거가 다루지 않음)
  IF p_actor_type = 'employer_initiates' THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_application.applicant_id,
        'confirmation_cancelled',
        '확정 취소',
        format('%s 확정이 취소되었습니다.',
          CASE WHEN v_job_posting.title IS NULL OR v_job_posting.title = '' THEN '해당 공고'
               ELSE format('''%s''', v_job_posting.title) END),
        '/schedule',
        jsonb_build_object(
          'applicationId', v_application.id,
          'jobPostingId', v_application.job_posting_id,
          'jobPostingTitle', COALESCE(v_job_posting.title, ''),
          'senderId', p_actor_id
        ),
        'high'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cancel_application_atomically] employer notify failed for % — %', p_application_id, SQLERRM;
    END;
  END IF;

  SELECT COUNT(*)::int INTO v_assignment_count FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;
  UPDATE job_postings SET
    status = CASE
      WHEN status = 'capacity_full' AND filled_positions < total_positions THEN 'active'::posting_status
      WHEN status = 'closed' AND closed_reason IN ('expired', 'expired_by_work_date') THEN 'closed'::posting_status
      WHEN status = 'closed' AND filled_positions < total_positions THEN 'active'::posting_status
      ELSE status
    END, updated_at = v_now_ts
  WHERE id = v_job_posting.id;
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 백필 — 이미 저장된 오염 행의 키 교정
-- ---------------------------------------------------------------------------
-- 승인(approved)뿐 아니라 거절(rejected) 경로도 같은 메타 키를 쓰므로 함께 옮긴다.
-- camelCase 가 이미 있으면 그쪽이 정본이라 덮지 않는다(COALESCE 순서).
UPDATE public.applications
SET cancellation_request =
      (cancellation_request - 'reviewed_at' - 'reviewed_by')
      || jsonb_strip_nulls(jsonb_build_object(
           'reviewedAt', COALESCE(cancellation_request->'reviewedAt', cancellation_request->'reviewed_at'),
           'reviewedBy', COALESCE(cancellation_request->'reviewedBy', cancellation_request->'reviewed_by')
         ))
WHERE cancellation_request IS NOT NULL
  AND (cancellation_request ? 'reviewed_at' OR cancellation_request ? 'reviewed_by');

COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '지원 확정 취소 원자 RPC. p_actor_type: staff_initiates(본인 취소) / employer_initiates(구인자 해제) / staff_approves_cancel_request(취소요청 승인). 승인 분기의 cancellation_request 메타 키는 camelCase(reviewedAt/reviewedBy) — 클라 Zod 계약과 맞춘 값이며 snake_case 로 되돌리면 지원서가 목록에서 사라진다.';
