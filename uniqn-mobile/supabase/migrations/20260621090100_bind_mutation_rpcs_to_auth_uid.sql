-- 2026-06-21 보안 하드닝 (P1): 변이 SECDEF RPC 의 행위자 파라미터를 auth.uid() 에 바인딩.
--
-- 배경: 아래 RPC 들은 행위자를 auth.uid() 가 아닌 파라미터(p_owner_id/p_actor_id/p_staff_id/
--   p_applicant_id)로 신뢰해, 인증 사용자 A 가 타인 B 의 uid 를 넘겨 대리 행위를 위조할 수 있었다.
--   (앞선 마이그레이션의 anon REVOKE 로 미인증 호출은 차단됐으나, 인증 사용자간 위조는 별도 차단 필요.)
--
-- 회귀 안전성(호출부 전수 확인):
--   * confirm_application: 클라이언트는 항상 현재 로그인 user.uid 를 p_owner_id 로 전달.
--   * cancel_application_atomically: 두 경로(staff_initiates/staff_approves) 모두 user.uid 전달.
--   * process_qr_checkin_atomically: 직원 본인 셀프스캔만 존재(user.uid==p_staff_id).
--   * apply_with_capacity_check: 본인 지원만(코드상 현재 미사용이나 방어적으로 바인딩).
--   admin 은 우회 허용(is_admin()).
--
-- 본문은 prod 실측(pg_get_functiondef)과 동일하며, BEGIN 직후 가드 블록만 추가했다.
-- (적용 후 pg_get_functiondef 재대조로 가드 외 본문 동일성 검증.)

-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb)
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
  v_existing int;
  v_capacity int;
  v_rec record;
  v_is_fixed boolean;
BEGIN
  -- [보안] 호출자 바인딩: p_owner_id 는 호출자 본인(또는 admin)이어야 함.
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

  IF NOT (
    v_job.owner_id = p_owner_id
    OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_rec IN
      SELECT
        (a->>'date') AS a_date,
        public._posting_slot_key(a->>'timeSlot') AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key,
        COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a
      GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing
      FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id
        AND wl.date = v_rec.a_date
        AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
        AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date
        AND (CASE
              WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
              WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL
                THEN public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
              WHEN v_is_fixed THEN 'NEGOTIABLE'
              ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
            END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id,
        status, is_fixed_posting,
        created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname,
        v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', v_is_fixed, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed',
    assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history,
    confirmed_at = v_now,
    processed_by = p_owner_id::text,
    processed_at = v_now,
    notes = COALESCE(p_notes, notes),
    updated_at = v_now
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text)
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
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

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
  -- M3 reopen 가드: 트리거가 capacity_full->active 를 이미 처리하나, 멱등 보강 + manual/expired 가드.
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

-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone DEFAULT now(), p_expected_date text DEFAULT NULL::text)
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
  v_duration_minutes numeric;
BEGIN
  -- [보안] 호출자 바인딩: 직원 본인 셀프 체크인만(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_work_log FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found'); END IF;

  SELECT status INTO v_job_posting_status FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch'); END IF;
  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch'); END IF;
  IF p_expected_date IS NOT NULL AND COALESCE(v_work_log.is_fixed_posting, false) = false AND v_work_log.date IS DISTINCT FROM p_expected_date THEN RETURN jsonb_build_object('success', false, 'error', 'date_mismatch'); END IF;
  IF v_job_posting_status::text != 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive'); END IF;
  IF v_work_log.payroll_status::text = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'already_settled'); END IF;

  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN RETURN jsonb_build_object('success', false, 'error', 'already_checked_in'); END IF;
    UPDATE work_logs SET status = 'checked_in', check_in_ts = p_check_time, updated_at = p_check_time WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkIn', 'check_in_time', v_now, 'work_duration', 0);
  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN RETURN jsonb_build_object('success', false, 'error', 'not_checked_in'); END IF;
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;
    UPDATE work_logs SET status = 'checked_out', check_out_ts = p_check_time, work_duration = v_work_duration, updated_at = p_check_time WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkOut', 'check_out_time', v_now, 'work_duration', v_work_duration);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_with_capacity_check(p_applicant_id uuid, p_job_posting_id uuid, p_applicant_name text, p_applicant_phone text DEFAULT NULL::text, p_applicant_email text DEFAULT NULL::text, p_applicant_nickname text DEFAULT NULL::text, p_applicant_photo_url text DEFAULT NULL::text, p_applicant_role text DEFAULT NULL::text, p_custom_role text DEFAULT NULL::text, p_job_posting_title text DEFAULT NULL::text, p_job_posting_date text DEFAULT NULL::text, p_recruitment_type text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_assignments jsonb DEFAULT '[]'::jsonb, p_pre_question_answers jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_posting record;
  v_existing record;
  v_total_positions int;
  v_active_count int;
  v_application_id uuid;
  v_now timestamptz := now();
  v_is_reapply boolean := false;
BEGIN
  -- [보안] 호출자 바인딩: 본인 명의 지원만(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_applicant_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PERMISSION_DENIED', 'message', '본인만 지원할 수 있습니다.');
  END IF;

  -- 1. 공고 행 잠금 (동시 지원 직렬화)
  SELECT id, status, total_positions, filled_positions, schedule
  INTO v_posting
  FROM job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', '공고를 찾을 수 없습니다.');
  END IF;

  -- 2. 공고 상태 확인
  IF v_posting.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'POSTING_CLOSED', 'message', '지원이 마감된 공고입니다.');
  END IF;

  -- 3. 기존 지원 확인
  SELECT id, status INTO v_existing
  FROM applications
  WHERE job_posting_id = p_job_posting_id
    AND applicant_id = p_applicant_id;

  IF FOUND THEN
    IF v_existing.status != 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', '이미 지원한 공고입니다.', 'application_id', v_existing.id);
    END IF;
    -- cancelled 상태면 재지원 허용
    v_is_reapply := true;
    v_application_id := v_existing.id;
  END IF;

  -- 4. 정원 확인 (active 지원 수 = applied + confirmed + cancellation_pending)
  v_total_positions := COALESCE(v_posting.total_positions, 0);

  IF v_total_positions > 0 THEN
    SELECT count(*) INTO v_active_count
    FROM applications
    WHERE job_posting_id = p_job_posting_id
      AND status IN ('applied', 'confirmed', 'cancellation_pending');

    IF v_active_count >= v_total_positions THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_FULL', 'message', '모집 인원이 마감되었습니다.', 'total_positions', v_total_positions, 'active_count', v_active_count);
    END IF;
  END IF;

  -- 5. Application INSERT 또는 UPDATE
  IF v_is_reapply THEN
    UPDATE applications SET
      status = 'applied',
      applicant_name = p_applicant_name,
      applicant_phone = p_applicant_phone,
      applicant_email = p_applicant_email,
      applicant_nickname = p_applicant_nickname,
      applicant_photo_url = p_applicant_photo_url,
      applicant_role = p_applicant_role::staff_role,
      custom_role = p_custom_role,
      job_posting_title = p_job_posting_title,
      job_posting_date = p_job_posting_date,
      recruitment_type = p_recruitment_type,
      message = p_message,
      assignments = p_assignments,
      pre_question_answers = p_pre_question_answers,
      is_read = false,
      cancelled_at = NULL,
      cancellation_request = NULL,
      rejection_reason = NULL,
      updated_at = v_now
    WHERE id = v_application_id;
  ELSE
    INSERT INTO applications (
      applicant_id, job_posting_id, status,
      applicant_name, applicant_phone, applicant_email,
      applicant_nickname, applicant_photo_url,
      applicant_role, custom_role,
      job_posting_title, job_posting_date,
      recruitment_type, message,
      assignments, pre_question_answers,
      is_read, created_at, updated_at
    ) VALUES (
      p_applicant_id, p_job_posting_id, 'applied',
      p_applicant_name, p_applicant_phone, p_applicant_email,
      p_applicant_nickname, p_applicant_photo_url,
      p_applicant_role::staff_role, p_custom_role,
      p_job_posting_title, p_job_posting_date,
      p_recruitment_type, p_message,
      p_assignments, p_pre_question_answers,
      false, v_now, v_now
    )
    RETURNING id INTO v_application_id;
  END IF;

  -- 6. 성공 반환
  RETURN jsonb_build_object('success', true, 'application_id', v_application_id, 'is_reapply', v_is_reapply);
END;
$function$;
