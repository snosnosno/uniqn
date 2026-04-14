-- T-A1: auth/confirm RPC 4개 회수 마이그레이션
-- 운영 DB pg_proc에서 verbatim 추출 (2026-04-14)
-- check_email_exists, check_nickname_exists, check_phone_exists, confirm_application

-- ============================================================
-- 1. check_email_exists
-- FOUND in pg_proc — recovered verbatim
-- NOTE: 운영 DB는 public.users.email 컬럼 기준 (auth.users 아님)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email);
$function$;

-- ============================================================
-- 2. check_nickname_exists
-- FOUND in pg_proc — recovered verbatim
-- NOTE: 운영 DB는 users.nickname 컬럼 기준
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE nickname = p_nickname
    AND (p_exclude_uid IS NULL OR id != p_exclude_uid)
  );
$function$;

-- ============================================================
-- 3. check_phone_exists
-- FOUND in pg_proc — recovered verbatim
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE phone = p_phone);
$function$;

-- ============================================================
-- 4. confirm_application
-- FOUND in pg_proc — recovered verbatim
-- 원자적 트랜잭션: 지원서 확정 + work_log 생성 + 공고 통계 업데이트
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false)
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
  -- 1. 지원서 잠금 + 상태 확인
  SELECT * INTO v_app
    FROM applications
    WHERE id = p_application_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id;
  END IF;

  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  -- 2. 공고 잠금 + 소유자 확인
  SELECT * INTO v_job
    FROM job_postings
    WHERE id = v_app.job_posting_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id;
  END IF;

  IF v_job.owner_id != p_owner_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 소유자만 확정 가능';
  END IF;

  -- 3. WorkLog 생성 (비고정 공고만)
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
        v_app.applicant_id,
        v_app.job_posting_id,
        p_application_id,
        v_assignment->>'groupId',
        v_assignment->>'date',
        v_assignment->>'timeSlot',
        v_app.applicant_name,
        v_app.applicant_nickname,
        v_app.applicant_photo_url,
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
        v_assignment->>'customRole',
        p_owner_id,
        'scheduled',
        false,
        v_now, v_now
      )
      RETURNING id INTO v_wl_id;

      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  -- 4. 지원서 상태 업데이트 (원자적)
  UPDATE applications SET
    status = 'confirmed',
    assignments = p_assignments,
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history,
    confirmed_at = v_now,
    processed_by = p_owner_id::text,
    processed_at = v_now,
    notes = COALESCE(p_notes, notes),
    updated_at = v_now
  WHERE id = p_application_id;

  -- 5. 공고 정원 업데이트
  UPDATE job_postings SET
    filled_positions = filled_positions + jsonb_array_length(p_assignments),
    stats = jsonb_set(
      jsonb_set(stats, '{confirmedApplicants}',
        to_jsonb(COALESCE((stats->>'confirmedApplicants')::int, 0) + 1)),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + jsonb_array_length(p_assignments))
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

-- ============================================================
-- REVOKE / GRANT — 최소 권한 원칙
-- ============================================================
REVOKE ALL ON FUNCTION public.check_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;

REVOKE ALL ON FUNCTION public.check_nickname_exists(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_nickname_exists(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.check_phone_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean) TO authenticated;
