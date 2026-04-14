-- ============================================================
-- T-B3: cancel_application_atomically RPC SQL 회귀 테스트
-- ============================================================
-- 목적: PR 머지 후 마이그레이션 적용 시 수동/CI 실행하여 RPC 동작 검증.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_application_atomically.test.sql
--   기대 결과: 마지막에 'CANCEL_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치:
--   - 마커 이메일(__sql_fixture_*@test.local)로 production에서도 격리 가능
--   - auth.users INSERT 시 handle_new_user 트리거가 public.users 자동 생성
--   - 종료 직전 cleanup: work_logs → applications → job_postings → auth.users 역순
--     (auth.users CASCADE는 public.users만 cover, FK 의존 테이블은 별도 삭제)
--   - 실행 도중 예외 발생 시 PostgreSQL 묵시적 트랜잭션이 전체 롤백
--
-- 시나리오:
--   S1. staff_initiates happy: confirmed → applied
--   S3. idempotency: 재호출 시 success+idempotent
--   S4. unauthorized actor
--   S5. invalid_status_for_cancellation
--   S2. staff_approves_cancel_request happy: cancellation_pending → cancelled
--
-- 스키마 의존:
--   - public.users(id, email, name NOT NULL, role) ← auth.users FK
--   - applications(applicant_name NOT NULL)
--   - job_postings(title NOT NULL)
--   - work_logs(staff_id, job_posting_id, date, role NOT NULL)
-- ============================================================

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_work_log_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  -- ============================================================
  -- 0. auth.users seed (트리거가 public.users 자동 생성)
  -- ============================================================
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,      '__sql_fixture_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id,      '__sql_fixture_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_other_user_id, '__sql_fixture_other@test.local', '{"role":"staff"}'::jsonb,    '{"name":"OTHER"}'::jsonb, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, '__sql_fixture: cancel atomicity', 5, 1, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, date, status, role, created_at, updated_at
  )
  VALUES (v_work_log_id, v_app_id, v_staff_id, v_job_id, '2026-05-01', 'scheduled', 'staff', now(), now());

  -- ============================================================
  -- 시나리오 1: staff_initiates happy path
  -- ============================================================
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id, '개인 사정');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'S1 fail: %', v_result; END IF;
  IF v_result->>'new_status' != 'applied' THEN RAISE EXCEPTION 'S1 status: %', v_result; END IF;
  IF (v_result->>'deleted_work_log_count')::int < 1 THEN RAISE EXCEPTION 'S1 delete: %', v_result; END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'applied' THEN
    RAISE EXCEPTION 'S1 side: applications.status';
  END IF;
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) != 0 THEN
    RAISE EXCEPTION 'S1 side: filled_positions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_logs WHERE application_id = v_app_id AND status = 'scheduled') THEN
    RAISE EXCEPTION 'S1 side: scheduled work_logs not deleted';
  END IF;

  -- ============================================================
  -- 시나리오 3: idempotency (시나리오 1 직후 재호출)
  -- ============================================================
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id);
  IF NOT ((v_result->>'success')::bool AND (v_result->>'idempotent')::bool) THEN
    RAISE EXCEPTION 'S3 fail: %', v_result;
  END IF;

  -- ============================================================
  -- 시나리오 4: unauthorized actor
  -- ============================================================
  UPDATE public.applications SET status = 'confirmed' WHERE id = v_app_id;
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_other_user_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'unauthorized' THEN
    RAISE EXCEPTION 'S4 fail: %', v_result;
  END IF;

  -- ============================================================
  -- 시나리오 5: invalid_status_for_cancellation
  -- ============================================================
  UPDATE public.applications SET status = 'cancelled' WHERE id = v_app_id;
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'invalid_status_for_cancellation' THEN
    RAISE EXCEPTION 'S5 fail: %', v_result;
  END IF;

  -- ============================================================
  -- 시나리오 2: staff_approves_cancel_request happy path
  -- ============================================================
  UPDATE public.applications SET
    status = 'cancellation_pending',
    cancellation_request = jsonb_build_object('status', 'pending', 'requested_at', now()::text, 'reason', '스태프 요청'),
    confirmation_history = jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
      'cancelled_at', NULL
    ))
  WHERE id = v_app_id;
  UPDATE public.job_postings SET filled_positions = 1 WHERE id = v_job_id;

  v_result := public.cancel_application_atomically(v_app_id, 'staff_approves_cancel_request', v_owner_id);
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'S2 fail: %', v_result; END IF;
  IF v_result->>'new_status' != 'cancelled' THEN RAISE EXCEPTION 'S2 status: %', v_result; END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'cancelled' THEN
    RAISE EXCEPTION 'S2 side: applications.status';
  END IF;
  IF (SELECT cancellation_request->>'status' FROM public.applications WHERE id = v_app_id) != 'approved' THEN
    RAISE EXCEPTION 'S2 side: cancellation_request.status';
  END IF;

  -- ============================================================
  -- Cleanup (역순)
  -- ============================================================
  DELETE FROM public.work_logs WHERE application_id = v_app_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_user_id);
END $$;

SELECT 'CANCEL_TEST_PASSED' AS result;
