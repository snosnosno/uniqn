-- =============================================================================
-- T-B6: process_qr_checkin_atomically SQL 회귀 테스트
-- =============================================================================
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/process_qr_checkin_atomically.test.sql
--   기대 결과: 마지막에 'QR_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치:
--   - 마커 이메일(__sql_fixture_qr_*@test.local)로 격리
--   - auth.users INSERT → handle_new_user 트리거가 public.users 자동 생성
--   - cleanup: work_logs → applications → job_postings → auth.users 역순
--
-- 시나리오:
--   S1. checkIn happy path (scheduled → checked_in)
--   S5. 이중 checkIn → already_checked_in
--   S2. checkOut happy path (checked_in → checked_out, work_duration ≈ 2h)
--   S4. staff_id mismatch
--   S6. checkOut without checkIn → not_checked_in
--   S3. payroll completed → already_settled
-- =============================================================================

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
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,       '__sql_fixture_qr_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id,       '__sql_fixture_qr_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_other_staff_id, '__sql_fixture_qr_other@test.local', '{"role":"staff"}'::jsonb,    '{"name":"OTHER"}'::jsonb, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, '__sql_fixture: qr atomicity', 5, 1, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
  )
  VALUES (v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed', now(), now());

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, date, status, role,
    is_fixed_posting, payroll_status, created_at, updated_at
  )
  VALUES (
    v_work_log_id, v_app_id, v_staff_id, v_job_id,
    to_char(now(), 'YYYY-MM-DD'), 'scheduled', 'staff',
    false, 'pending', now(), now()
  );

  -- ----------------------------------------------------------
  -- S1: checkIn happy path
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', v_check_in_time, to_char(now(), 'YYYY-MM-DD')
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'S1 fail: %', v_result; END IF;
  IF v_result->>'action' != 'checkIn' THEN RAISE EXCEPTION 'S1 action: %', v_result; END IF;
  IF (SELECT status::text FROM public.work_logs WHERE id = v_work_log_id) != 'checked_in' THEN
    RAISE EXCEPTION 'S1 side: status';
  END IF;

  -- ----------------------------------------------------------
  -- S5: 이중 checkIn → already_checked_in
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'already_checked_in' THEN
    RAISE EXCEPTION 'S5 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S2: checkOut happy path (S1 직후, 약 2시간 경과)
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkOut', now(), NULL
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'S2 fail: %', v_result; END IF;
  IF (v_result->>'work_duration')::numeric <= 1.5
     OR (v_result->>'work_duration')::numeric >= 2.5 THEN
    RAISE EXCEPTION 'S2 work_duration: %', v_result;
  END IF;
  IF (SELECT status::text FROM public.work_logs WHERE id = v_work_log_id) != 'checked_out' THEN
    RAISE EXCEPTION 'S2 side: status';
  END IF;

  -- ----------------------------------------------------------
  -- S4: staff_id mismatch (work_log 재초기화)
  -- ----------------------------------------------------------
  UPDATE public.work_logs SET
    status = 'scheduled', check_in_time = NULL, check_out_time = NULL, work_duration = 0
  WHERE id = v_work_log_id;

  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_other_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'staff_id_mismatch' THEN
    RAISE EXCEPTION 'S4 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S6: scheduled에서 checkOut → not_checked_in
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkOut', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'not_checked_in' THEN
    RAISE EXCEPTION 'S6 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S3: payroll completed → already_settled
  -- ----------------------------------------------------------
  UPDATE public.work_logs SET payroll_status = 'completed' WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'already_settled' THEN
    RAISE EXCEPTION 'S3 fail: %', v_result;
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.work_logs WHERE id = v_work_log_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_staff_id);
END $$;

SELECT 'QR_TEST_PASSED' AS result;
