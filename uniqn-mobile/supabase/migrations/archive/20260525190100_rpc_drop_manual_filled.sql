-- SP3: confirm/cancel RPC 의 수동 filled_positions 갱신 제거 (트리거 단일화)
--
-- T6(20260525190000) 가 fn_update_job_posting_stats 트리거에 filled_positions 갱신을 통합했다.
-- 두 RPC 모두 applications.status 를 UPDATE 하므로 트리거가 자동으로 filled_positions 를 ±1 한다.
-- 따라서 RPC 의 수동 ±1 을 제거해 이중 갱신을 막는다. (현행 본문 diff 기준, 나머지 로직 보존.)

-- ── confirm_application: 수동 filled_positions +1 블록 제거 ───────────────────
-- (SP2 적용본 기준. 변경: 말미의 job_postings filled_positions/stats.filledPositions UPDATE 제거.
--  status='confirmed' UPDATE 가 트리거를 발화시켜 filled +1 자동 처리.)
CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false,
  p_assignments_v3 jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- status='confirmed' UPDATE 가 fn_update_job_posting_stats 트리거를 발화 → filled_positions +1 자동.
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

  -- (수동 filled_positions/stats.filledPositions +1 제거 — 트리거가 담당)

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;

-- ── cancel_application_atomically: 수동 filled_positions -1 제거, reopen 보존, 반환값 재조회 ──
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
  -- 수동 filled_positions -1 제거(트리거 담당). reopen(closed→active) 로직은 보존하되 트리거 후 값 기준.
  UPDATE job_postings SET
    status = CASE WHEN status = 'closed' AND filled_positions < total_positions THEN 'active'::posting_status ELSE status END,
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
