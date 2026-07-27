-- 확정 해제 시 원본 지원 일정 복원 (W1-5 / APPL-1, CRITICAL)
--
-- 문제: 부분 확정이 UI 의 기본 경로다(초기 선택 0건, 1건 이상 선택해야 확정 버튼 활성,
--       버튼 라벨도 'N개 확정'). 그런데 confirm_application 이
--       `assignments = COALESCE(p_assignments_v3, assignments)` 로 **선택분만 남기고 덮어쓰고**,
--       cancel_application_atomically 는 status·confirmation_history 만 되돌릴 뿐
--       assignments 를 원복하지 않는다. 그래서 '확정 → 해제 → 재확정' 사이클마다 지원자의
--       선택지가 단조 감소하고, 지원자가 실제로 지원했던 일정이 앱에서 복구 불가능해진다.
--
-- 해결: 신규 컬럼 없이 기존 `original_application`(최초 확정 시 클라가 백필, 이후 불변)에서
--       assignments 를 되돌린다. applied 로 복귀하는 전이(staff_initiates / employer_initiates)
--       에서만 복원하고, cancelled 로 종결되는 취소요청 승인 경로는 건드리지 않는다.
--
-- 범위: 함수 정의는 20260727100000 에서 **스크립트로 복사**했고 UPDATE 한 곳만 다르다
--       (손 전사 오류 방지). 그 외 로직·시그니처·search_path 는 완전 동일하다.
--
-- ⚠️ 적용 순서: 20260727100000 이 prod 미적용 상태다. 이 파일만 적용하면 함수는 최신이 되지만
--    그 파일의 **오염 row 백필 UPDATE 는 실행되지 않는다**. 반드시 순서대로 적용할 것.
--
-- ⚠️ 소급 불가: original_application 이 비어 있는 과거 행(최초 확정이 백필 도입 이전인 건)은
--    되돌릴 원본이 없다. jsonb_typeof 가드로 그런 행은 현행 assignments 를 유지한다.
--
-- 되돌리기: 20260727100000 의 함수 정의를 다시 적용하면 된다.

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

  -- [APPL-1] applied 복귀 시 원본 지원 일정을 되돌린다.
  -- 확정 RPC 가 assignments 를 선택분으로 덮어쓰므로(부분 확정이 UI 기본 경로다), 되돌리지
  -- 않으면 해제 후 재확정 때 지원자가 원래 신청했던 나머지 일정이 선택지에서 영영 사라진다.
  -- 원본은 최초 확정 시 original_application 에 이미 백필돼 있고 이후 불변이다(COALESCE).
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
