-- =============================================================================
-- FEAT: confirm_application — blurhash 미러 전파 (impeccable v2 §18)
-- =============================================================================
-- 목적: applications.applicant_photo_url_blurhash 를 work_logs.staff_photo_url_blurhash
--       로 비정규화 복사. 확정 시점 스냅샷.
--
-- 변경:
--   - work_logs INSERT 에 staff_photo_url_blurhash 추가
--   - applicant_photo_url_blurhash 컬럼이 없던 레거시 데이터는 NULL 로 전달
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid,
  p_owner_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb,
  p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text,
  p_is_fixed_posting boolean DEFAULT false,
  p_assignments_v3 jsonb DEFAULT NULL::jsonb
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

  -- work_logs INSERT: flat 포맷(p_assignments) 사용
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
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
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  -- applications UPDATE: assignments 컬럼은 p_assignments_v3(v3 포맷) 사용
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

  -- job_postings filled_positions: flat 개수 기준 (work_logs와 1:1 매핑)
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

REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC. applications.assignments 는 p_assignments_v3(v3) 로 저장, work_logs INSERT 는 p_assignments(flat) 전개. impeccable v2 §18: applicant_photo_url_blurhash → staff_photo_url_blurhash 미러 스냅샷.';
