-- SP2: confirm_application 확정 경로 통일 (fixed 분기 제거 + H1 정원가드 fixed 키 정합)
--
-- 변경점 (현행 prod 본문 대비 5곳):
--   [변경1] v_is_fixed := (schedule->>'kind')='fixed' 도출 (p_is_fixed_posting 파라미터는 시그니처 유지·본문 무시)
--   [변경2] H1 정원 가드 진입조건에서 'NOT p_is_fixed_posting' 제거 → fixed 포함
--   [변경3] capacity date 매칭 COALESCE(req->>'date','FIXED_SCHEDULE')  (fixed null-date 정합)
--   [변경4] capacity slot 매칭 CASE 에 fixed 협의(startTime 없음) → 'NEGOTIABLE' 분기 (FIXED_TIME_MARKER)
--   [변경5] work_logs INSERT 진입조건 fixed 포함 + is_fixed_posting = v_is_fixed
-- filled_positions/stats.filledPositions 수동 갱신은 SP2 에서 현행 보존 (SP3 트리거 이관, 이중증가 금지).
-- 나머지(blurhash/권한/history/assignments_v3/notes) 전부 보존.

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
  v_is_fixed boolean;  -- [변경1]
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

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';  -- [변경1]

  IF NOT (
    v_job.owner_id = p_owner_id
    OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  -- [변경2] H1 정원 가드: fixed 포함 (NOT p_is_fixed_posting 조건 제거)
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
      WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date  -- [변경3]
        AND (CASE  -- [변경4] fixed 협의 슬롯 NEGOTIABLE 정합
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

  -- [변경5] work_logs INSERT: fixed 포함 + is_fixed_posting = v_is_fixed
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

  -- filled_positions/stats.filledPositions 수동 갱신: SP2 현행 보존 (SP3 트리거 이관)
  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
    ),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;
