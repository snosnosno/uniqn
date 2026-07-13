-- =============================================================================
-- T-E4-rest: Critical RPC is_active 가드 추가
-- =============================================================================
-- 목적: 세션 중 계정이 비활성화된 경우 (public.users.is_active = false),
--       critical write RPC 호출이 거부되도록 보장한다.
--
-- 대상 RPC (3개):
--   1. cancel_application_atomically  — 가드는 1단계 LOCK 이후, 2단계 Idempotency 이전
--   2. process_qr_checkin_atomically  — 가드는 1단계 LOCK 이후, defensive validations 이전
--   3. confirm_application            — 가드는 BEGIN 직후
--
-- 원본: 운영 DB pg_proc에서 verbatim 추출 후 is_active 가드 블록만 삽입.
--       기존 로직은 그대로 유지.
--
-- 실패 시 반환값:
--   - cancel_application_atomically / process_qr_checkin_atomically:
--       jsonb { success: false, error: 'account_disabled' } (jsonb 반환 패턴 유지)
--   - confirm_application:
--       RAISE EXCEPTION 'ACCOUNT_DISABLED: ...' (기존 RAISE EXCEPTION 패턴 유지)
-- =============================================================================


-- =============================================================================
-- 1. cancel_application_atomically — is_active guard on p_actor_id
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
  v_application applications%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb;
  v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb;
  v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now();
  v_assignment_count int := 0;
  v_new_filled int;
  v_new_status text;
  v_updated_cancellation_request jsonb;
BEGIN
  -- 1. Lock application row
  SELECT * INTO v_application FROM applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- is_active guard (T-E4-rest)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled');
  END IF;

  -- 2. Idempotency
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 3. State validation (actor-specific)
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation');
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval');
    END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type');
  END IF;

  -- 4. Lock job_posting
  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 5. Manual permission check
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_job_posting.owner_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- 6. confirmation_history 갱신
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1
  INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY
  WHERE (value->>'cancelled_at') IS NULL
  LIMIT 1;

  IF v_active_confirmation_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation');
  END IF;

  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancellation_reason'],
    COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 7. New status + cancellation_request update
  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  -- 8. Update applications  ← FIX: 명시적 cast
  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 9. job_postings: filled_positions 재계산
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - v_assignment_count);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    status = CASE
      WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'::posting_status
      ELSE status
    END,
    updated_at = v_now_ts
  WHERE id = v_job_posting.id;

  -- 10. work_logs DELETE
  DELETE FROM work_logs
  WHERE application_id = p_application_id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'new_status', v_new_status,
    'assignment_count', v_assignment_count,
    'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count,
    'cancelled_at', v_now
  );
END;
$function$;


-- =============================================================================
-- 2. process_qr_checkin_atomically — is_active guard on p_staff_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,
  p_check_time timestamp with time zone DEFAULT now(),
  p_expected_date text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_check_in_text text;
  v_check_in_ts timestamptz;
  v_duration_minutes numeric;
BEGIN
  -- 1. Lock work_log row
  SELECT * INTO v_work_log
  FROM work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  -- is_active guard (T-E4-rest)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_staff_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled');
  END IF;

  -- 2. Lock job_posting row
  SELECT status::text INTO v_job_posting_status
  FROM job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 3. Defensive validations
  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch');
  END IF;

  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch');
  END IF;

  IF p_expected_date IS NOT NULL
     AND COALESCE(v_work_log.is_fixed_posting, false) = false
     AND v_work_log.date IS DISTINCT FROM p_expected_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_mismatch');
  END IF;

  IF v_job_posting_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;

    UPDATE work_logs SET
      status = 'checked_in',
      check_in_time = to_jsonb(v_now),
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkIn',
      'check_in_time', v_now,
      'work_duration', 0
    );

  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;

    IF v_work_log.check_in_time IS NOT NULL THEN
      v_check_in_text := CASE
        WHEN jsonb_typeof(v_work_log.check_in_time) = 'string'
          THEN v_work_log.check_in_time #>> '{}'
        ELSE NULL
      END;

      IF v_check_in_text IS NOT NULL THEN
        BEGIN
          v_check_in_ts := v_check_in_text::timestamptz;
          v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_check_in_ts)) / 60;
          v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
        EXCEPTION WHEN OTHERS THEN
          v_work_duration := 0;
        END;
      END IF;
    END IF;

    UPDATE work_logs SET
      status = 'checked_out',
      check_out_time = to_jsonb(v_now),
      work_duration = v_work_duration,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkOut',
      'check_out_time', v_now,
      'work_duration', v_work_duration
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$function$;


-- =============================================================================
-- 3. confirm_application — is_active guard on p_owner_id
-- =============================================================================
-- NOTE: confirm_application 은 기존에 RAISE EXCEPTION 패턴을 사용하므로
--       is_active 가드도 동일한 패턴(RAISE EXCEPTION)으로 통일한다.
--       jsonb { account_disabled } 반환 패턴은 다른 두 RPC와 반환 타입이 다르므로
--       기존 일관성을 유지하는 쪽이 caller 호환성이 높다.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid,
  p_owner_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb,
  p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text,
  p_is_fixed_posting boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app record;
  v_job record;
  v_work_log_ids uuid[] := '{}';
  v_wl_id uuid;
  v_assignment jsonb;
  v_now timestamptz := now();
BEGIN
  -- is_active guard (T-E4-rest)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status; END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;
  IF v_job.owner_id != p_owner_id THEN RAISE EXCEPTION 'PERMISSION_DENIED: 공고 소유자만 확정 가능'; END IF;

  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url,
        role, custom_role, owner_id,
        status, is_fixed_posting,
        created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url,
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed', assignments = p_assignments,
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history, confirmed_at = v_now,
    processed_by = p_owner_id::text, processed_at = v_now,
    notes = COALESCE(p_notes, notes), updated_at = v_now
  WHERE id = p_application_id;

  UPDATE job_postings SET
    filled_positions = filled_positions + jsonb_array_length(p_assignments),
    stats = jsonb_set(jsonb_set(stats, '{confirmedApplicants}',
      to_jsonb(COALESCE((stats->>'confirmedApplicants')::int, 0) + 1)),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + jsonb_array_length(p_assignments))),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;


-- =============================================================================
-- Grants (기존 권한 유지 — CREATE OR REPLACE 시 이미 보존되나 명시적으로 재선언)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '취소 흐름 원자화 RPC + is_active 가드 (T-E4-rest). 세션 중 계정이 비활성화되면 account_disabled 에러로 거부.';

COMMENT ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) IS
  'QR check-in/out 원자화 RPC + is_active 가드 (T-E4-rest). 세션 중 계정이 비활성화되면 account_disabled 에러로 거부.';

COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean) IS
  '지원서 확정 RPC + is_active 가드 (T-E4-rest). 세션 중 owner 계정이 비활성화되면 ACCOUNT_DISABLED 예외로 거부.';
