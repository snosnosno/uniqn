-- cancel_application_atomically 재베이스 — 낡은 정의를 베이스로 삼아 생긴 회귀 2건 복구
--
-- 사고 경위:
--   20260727100000(W1-1) / 20260727150000(W1-5) 이 이 함수를 재정의하면서 베이스로
--   **20260711020000** 을 복사했다. 그런데 그 사이 **20260718000000**(좌석 기준 filled/total)
--   이 같은 함수를 고쳤고, 07-11 을 베이스로 쓰는 순간 그 개선이 통째로 되돌아갔다.
--   CI 가 잡았다 — parity_baseline_guard(test 7) · seat_basis_filled_positions(test 8).
--
-- 되돌아갔던 것 (이 파일에서 복구):
--   1) `SET search_path TO 'public'` → **pg_temp 누락**. SECDEF 함수의 temp-table shadowing
--      방어가 사라진다(parity 가드가 이 축을 전수 검사한다).
--   2) DELETE 와 filled_positions 읽기 **순서 역전**. 07-18 은 좌석 감소를 먼저 반영해
--      (seat 트리거 발화 → filled -N) 재개 판정·반환값이 최신 filled 를 보게 했다.
--      07-11 순서로는 반환 new_filled_positions 가 삭제 전 옛값이다.
--   3) job_postings 재개 로직. 07-18 은 capacity_full→active 를 BEFORE 트리거에 위임하고
--      closed(비만료) 재개만 명시한다. 07-11 의 3분기 CASE 로 돌아가 있었다.
--
-- 유지하는 것 (W1 의 실제 변경 — 이 둘만이 07-18 대비 의도된 차이다):
--   a) 취소요청 승인 분기의 cancellation_request 메타 키 = **camelCase**(reviewedAt/reviewedBy).
--      snake_case 로 되돌리면 클라 Zod discriminated union 파싱이 깨져 지원서가 목록에서
--      통째로 사라진다(W1-1 / CANCEL-1).
--   b) applied 복귀 시 original_application 에서 assignments 복원(W1-5 / APPL-1).
--
-- 교훈: 함수를 재정의할 때 베이스는 **가장 최근 정의**여야 한다. 파일명 타임스탬프가 아니라
--   `grep -l "CREATE OR REPLACE FUNCTION <name>" *.sql | sort | tail -1` 로 확인할 것.

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
 SET search_path TO 'public', 'pg_temp'
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

  -- 행위자별 인가 (owner_id nullable → COALESCE fail-closed 유지)
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
    -- [W1-1] camelCase 고정. snake_case 로 되돌리면 지원서가 목록에서 사라진다.
    v_updated_cancellation_request := v_application.cancellation_request || jsonb_build_object('status', 'approved', 'reviewedAt', v_now, 'reviewedBy', p_actor_id);
  END IF;

  -- [W1-5 / APPL-1] applied 복귀 시 원본 지원 일정을 되돌린다.
  -- 확정 RPC 가 assignments 를 선택분으로 덮어쓰므로(부분 확정이 UI 기본 경로다), 되돌리지
  -- 않으면 해제 후 재확정 때 지원자가 원래 신청했던 나머지 일정이 선택지에서 영영 사라진다.
  -- cancelled 로 종결되는 경로(취소요청 승인)는 되돌릴 이유가 없으므로 제외한다.
  UPDATE applications SET status = v_new_status::application_status, confirmation_history = v_confirmation_history,
    assignments = CASE
      WHEN v_new_status = 'applied'
       AND jsonb_typeof(v_application.original_application -> 'assignments') = 'array'
      THEN v_application.original_application -> 'assignments'
      ELSE assignments
    END,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request), cancelled_at = v_now_ts, updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 구인자 확정해제는 스태프에게 직접 통지
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

  -- [좌석 기준 재배열] 좌석 감소를 먼저 반영(seat 트리거 발화 → filled -N,
  -- capacity_full→active 는 BEFORE 트리거 자동). 이후 재개 판정·반환값이 최신 filled 를 본다.
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  -- closed(비만료) 재개만 명시 처리 (만료 closed 는 유지).
  UPDATE job_postings SET status = 'active'::posting_status, updated_at = v_now_ts
  WHERE id = v_job_posting.id
    AND filled_positions < total_positions
    AND status = 'closed'
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;

  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '지원 확정 취소 원자 RPC. p_actor_type: staff_initiates(본인 취소) / employer_initiates(구인자 해제) / staff_approves_cancel_request(취소요청 승인). 승인 분기의 cancellation_request 메타 키는 camelCase(reviewedAt/reviewedBy) — 클라 Zod 계약과 맞춘 값이며 snake_case 로 되돌리면 지원서가 목록에서 사라진다. applied 복귀 시 original_application 에서 assignments 를 복원한다. 좌석 감소(work_logs DELETE)를 먼저 반영한 뒤 filled_positions 를 읽어야 반환값이 최신이다.';
