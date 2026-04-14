-- =============================================================================
-- T-B6: process_qr_checkin_atomically SQL 회귀 테스트
-- =============================================================================
-- ⚠️ 환경 요구사항 (PRODUCTION 실행 금지):
--   - public.users.id → auth.users(id) FK가 있어 fixture가 auth seed 필요
--   - 로컬 supabase 환경 또는 test branch 전용
--
-- 사용법:
--   1) supabase db reset
--   2) auth seed (admin API 또는 supabase/seed.sql)
--   3) supabase db psql -f supabase/tests/process_qr_checkin_atomically.test.sql
--
-- 시나리오:
--   1. checkIn happy path (scheduled → checked_in)
--   2. checkOut happy path (checked_in → checked_out, work_duration > 0)
--   3. payroll completed → already_settled
--   4. staff_id mismatch
--   5. 이중 checkIn → already_checked_in
--   6. checkOut without checkIn → not_checked_in
--
-- 모든 시나리오는 BEGIN/ROLLBACK으로 격리.
--
-- 스키마 의존: users(name NOT NULL), job_postings, applications, work_logs.
--   work_logs는 staff_id, job_posting_id, application_id, status, check_in_time(jsonb),
--   payroll_status, date, is_fixed_posting 컬럼 사용.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_other_staff_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_work_log_id uuid := gen_random_uuid();
  v_result jsonb;
  v_check_in_time timestamptz := now() - interval '2 hours';
BEGIN
  -- ----------------------------------------------------------
  -- 0. 픽스처 INSERT
  -- ----------------------------------------------------------
  -- NOTE: public.users.id → auth.users(id) FK 존재. 로컬/test 환경 사전 seed 필요.
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES
    (v_owner_id, format('owner-%s@test.local', v_owner_id), 'OWNER', 'employer', now(), now()),
    (v_staff_id, format('staff-%s@test.local', v_staff_id), 'STAFF', 'staff', now(), now()),
    (v_other_staff_id, format('other-%s@test.local', v_other_staff_id), 'OTHER', 'staff', now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, 'TEST 공고 - QR atomicity', 5, 1, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, status, created_at, updated_at
  )
  VALUES (v_app_id, v_job_id, v_staff_id, 'confirmed', now(), now());

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, status,
    date, is_fixed_posting, payroll_status, created_at, updated_at
  )
  VALUES (
    v_work_log_id, v_app_id, v_staff_id, v_job_id, 'scheduled',
    to_char(now(), 'YYYY-MM-DD'), false, 'pending', now(), now()
  );

  -- ----------------------------------------------------------
  -- 시나리오 1: checkIn happy path
  -- 기대: scheduled → checked_in, success=true, work_duration=0
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_staff_id,
    p_job_posting_id := v_job_id,
    p_action := 'checkIn',
    p_check_time := v_check_in_time,
    p_expected_date := to_char(now(), 'YYYY-MM-DD')
  );
  ASSERT (v_result->>'success')::bool = true,
    format('S1 expected success=true, got: %s', v_result);
  ASSERT v_result->>'action' = 'checkIn',
    format('S1 expected action=checkIn, got: %s', v_result);
  ASSERT (SELECT status FROM public.work_logs WHERE id = v_work_log_id) = 'checked_in',
    'S1 expected work_logs.status=checked_in';

  -- ----------------------------------------------------------
  -- 시나리오 5: 이미 checked_in 상태에서 다시 checkIn → already_checked_in
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_staff_id,
    p_job_posting_id := v_job_id,
    p_action := 'checkIn',
    p_check_time := now(),
    p_expected_date := NULL
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'already_checked_in',
    format('S5 expected already_checked_in, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 2: checkOut happy path (S1 직후, 약 2시간 경과 가정)
  -- 기대: checked_in → checked_out, work_duration ≈ 2시간
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_staff_id,
    p_job_posting_id := v_job_id,
    p_action := 'checkOut',
    p_check_time := now(),  -- v_check_in_time + 2h
    p_expected_date := NULL
  );
  ASSERT (v_result->>'success')::bool = true,
    format('S2 expected success=true, got: %s', v_result);
  ASSERT (v_result->>'work_duration')::numeric > 1.5
    AND (v_result->>'work_duration')::numeric < 2.5,
    format('S2 expected work_duration ~2 hours, got: %s', v_result);
  ASSERT (SELECT status FROM public.work_logs WHERE id = v_work_log_id) = 'checked_out',
    'S2 expected work_logs.status=checked_out';

  -- ----------------------------------------------------------
  -- 시나리오 4: staff_id mismatch
  -- ----------------------------------------------------------
  -- 새 work_log 준비 (직전 시나리오는 종결 상태)
  UPDATE public.work_logs SET
    status = 'scheduled',
    check_in_time = NULL,
    check_out_time = NULL,
    work_duration = 0
  WHERE id = v_work_log_id;

  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_other_staff_id,  -- 잘못된 staff
    p_job_posting_id := v_job_id,
    p_action := 'checkIn',
    p_check_time := now(),
    p_expected_date := NULL
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'staff_id_mismatch',
    format('S4 expected staff_id_mismatch, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 6: scheduled 상태에서 checkOut → not_checked_in
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_staff_id,
    p_job_posting_id := v_job_id,
    p_action := 'checkOut',
    p_check_time := now(),
    p_expected_date := NULL
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'not_checked_in',
    format('S6 expected not_checked_in, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 3: payroll completed → already_settled
  -- ----------------------------------------------------------
  UPDATE public.work_logs SET payroll_status = 'completed' WHERE id = v_work_log_id;

  v_result := public.process_qr_checkin_atomically(
    p_work_log_id := v_work_log_id,
    p_staff_id := v_staff_id,
    p_job_posting_id := v_job_id,
    p_action := 'checkIn',
    p_check_time := now(),
    p_expected_date := NULL
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'already_settled',
    format('S3 expected already_settled, got: %s', v_result);

  RAISE NOTICE 'process_qr_checkin_atomically tests: ALL PASS (S1-S6)';
END $$;

ROLLBACK;
