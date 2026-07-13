-- M3 (공고 자동마감 Approach B): cancel_application_atomically reopen 가드 강화
--
-- 변경 범위: 말미의 job_postings status reopen CASE 1곳만 교체. 나머지 본문 100% 보존
--   (20260525190100_rpc_drop_manual_filled.sql 기준 diff).
-- 설계 (narrow, PR #153 정합 + capacity_full 분기):
--   capacity_full + filled<total           → active  (자동 재노출, UC2=A)
--   closed + expired/expired_by_work_date   → closed  (cron 만료 의도 보존, dangling 가드)
--   closed + manual/기타 + filled<total     → active  (기존 동작 보존 = 구인자 수동마감도 빈자리 시 재오픈)
--   그 외                                   → 불변
-- spec §2 M3 (broad 안에서 사용자 결정으로 narrow 채택 — manual 재오픈 유지).

CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid, p_actor_type text, p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_application applications%ROWTYPE; v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb; v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb; v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now(); v_assignment_count int := 0; v_new_filled int;
  v_new_status text; v_updated_cancellation_request jsonb;
BEGIN
  SELECT * INTO v_application FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'application_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled'); END IF;
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation'); END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval'); END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending'); END IF;
  ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type'); END IF;
  SELECT * INTO v_job_posting FROM job_postings WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;
  -- H4: 권한
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF NOT (v_job_posting.owner_id = p_actor_id OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id) OR public.is_admin()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  END IF;
  -- H5: 출근 후 차단
  IF EXISTS (SELECT 1 FROM work_logs WHERE application_id = p_application_id AND status IN ('checked_in', 'checked_out')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in'); END IF;
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1 INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY WHERE (value->>'cancelled_at') IS NULL LIMIT 1;
  IF v_active_confirmation_entry IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation'); END IF;
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancellation_reason'], COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));
  IF p_actor_type = 'staff_initiates' THEN v_new_status := 'applied';
  ELSE v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;
  -- status 변경 UPDATE 가 fn_update_job_posting_stats 트리거를 발화 → filled_positions -1 자동.
  UPDATE applications SET status = v_new_status::application_status, confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request), cancelled_at = v_now_ts, updated_at = v_now_ts
  WHERE id = p_application_id;
  SELECT COUNT(*)::int INTO v_assignment_count FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;
  -- M3 reopen 가드: 트리거가 capacity_full→active 를 이미 처리하나, 멱등 보강 + manual/expired 가드.
  UPDATE job_postings SET
    status = CASE
      WHEN status = 'capacity_full' AND filled_positions < total_positions THEN 'active'::posting_status
      WHEN status = 'closed' AND closed_reason IN ('expired', 'expired_by_work_date') THEN 'closed'::posting_status
      WHEN status = 'closed' AND filled_positions < total_positions THEN 'active'::posting_status
      ELSE status
    END,
    updated_at = v_now_ts
  WHERE id = v_job_posting.id;
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now);
END;
$function$;
