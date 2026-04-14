-- ============================================================
-- T-B3: cancel_application_atomically RPC SQL 회귀 테스트
-- ============================================================
-- 목적: PR 머지 후 마이그레이션 적용 시 수동/CI 실행하여 RPC 동작 검증.
--
-- ⚠️ 환경 요구사항 (PRODUCTION 실행 금지):
--   - public.users.id → auth.users(id) FK가 존재하므로
--     fixture가 작동하려면 auth.users seed가 필요함.
--   - 본 테스트는 로컬 supabase 환경 또는 dedicated test branch 전용:
--     1) supabase db reset                 (clean slate)
--     2) auth seed via Supabase admin API  (또는 supabase/seed.sql)
--     3) supabase db psql -f supabase/tests/cancel_application_atomically.test.sql
--   - production에서 실행하면 FK violation 또는 운영 데이터 오염 위험.
--
-- 시나리오:
--   1. staff_initiates happy path: confirmed → applied
--   2. staff_approves_cancel_request happy path: cancellation_pending → cancelled
--   3. idempotency: 재호출 시 success+idempotent
--   4. unauthorized actor: 권한 없음 에러
--   5. invalid_status: 상태 불일치 에러
--
-- BEGIN/ROLLBACK 트랜잭션으로 격리 (테스트 데이터 잔존 방지).
--
-- 스키마 의존: users(name NOT NULL), job_postings, applications, work_logs.
-- 컬럼 mismatch 시 즉시 ERROR로 노출 — 실제 컬럼명에 맞춰 보정 필요.
-- ============================================================

BEGIN;

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
  -- ----------------------------------------------------------
  -- 0. 픽스처 INSERT
  -- ----------------------------------------------------------
  -- NOTE: public.users.id → auth.users(id) FK 존재. 로컬/test 환경에서는
  --       supabase auth admin API로 사전 seed 필요. 이 INSERT 자체는 FK 위반.
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES
    (v_owner_id, format('owner-%s@test.local', v_owner_id), 'OWNER', 'employer', now(), now()),
    (v_staff_id, format('staff-%s@test.local', v_staff_id), 'STAFF', 'staff', now(), now()),
    (v_other_user_id, format('other-%s@test.local', v_other_user_id), 'OTHER', 'staff', now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, 'TEST 공고 - cancel atomicity', 5, 1, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, status, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(
        jsonb_build_object('dates', jsonb_build_array('2026-05-01'))
      ),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (id, application_id, status, created_at, updated_at)
  VALUES (v_work_log_id, v_app_id, 'scheduled', now(), now());

  -- ----------------------------------------------------------
  -- 시나리오 1: staff_initiates happy path
  -- 기대: success=true, new_status='applied', deleted_work_log_count>=1
  -- ----------------------------------------------------------
  v_result := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id,
    p_cancel_reason := '개인 사정'
  );
  ASSERT (v_result->>'success')::bool = true,
    format('S1 expected success=true, got: %s', v_result);
  ASSERT v_result->>'new_status' = 'applied',
    format('S1 expected new_status=applied, got: %s', v_result);
  ASSERT (v_result->>'deleted_work_log_count')::int >= 1,
    format('S1 expected deleted_work_log_count>=1, got: %s', v_result);

  -- 사이드이펙트 검증
  ASSERT (SELECT status FROM public.applications WHERE id = v_app_id) = 'applied',
    'S1 applications.status expected applied';
  ASSERT (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) = 0,
    'S1 job_postings.filled_positions expected 0';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.work_logs
    WHERE application_id = v_app_id AND status = 'scheduled'
  ), 'S1 expected scheduled work_logs to be deleted';

  -- ----------------------------------------------------------
  -- 시나리오 3: idempotency (시나리오 1 직후 재호출)
  -- 기대: success=true, idempotent=true
  -- ----------------------------------------------------------
  v_result := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id
  );
  ASSERT (v_result->>'success')::bool = true
    AND (v_result->>'idempotent')::bool = true,
    format('S3 expected idempotent=true, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 4: unauthorized actor
  -- 사전 조건: status를 confirmed로 되돌림 (idempotency 가지 회피)
  -- 기대: success=false, error='unauthorized'
  -- ----------------------------------------------------------
  UPDATE public.applications SET status = 'confirmed' WHERE id = v_app_id;

  v_result := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_other_user_id  -- ≠ applicant
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'unauthorized',
    format('S4 expected unauthorized, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 5: invalid_status_for_cancellation
  -- 사전 조건: 종결 상태 'cancelled'에서 staff_initiates 시도
  -- ----------------------------------------------------------
  UPDATE public.applications SET status = 'cancelled' WHERE id = v_app_id;

  v_result := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id
  );
  ASSERT (v_result->>'success')::bool = false
    AND v_result->>'error' = 'invalid_status_for_cancellation',
    format('S5 expected invalid_status_for_cancellation, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 2: staff_approves_cancel_request happy path
  -- 사전 조건: status='cancellation_pending' + cancellation_request.status='pending'
  -- ----------------------------------------------------------
  UPDATE public.applications SET
    status = 'cancellation_pending',
    cancellation_request = jsonb_build_object(
      'status', 'pending',
      'requested_at', now()::text,
      'reason', '스태프 요청'
    ),
    confirmation_history = jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(
        jsonb_build_object('dates', jsonb_build_array('2026-05-01'))
      ),
      'cancelled_at', NULL
    ))
  WHERE id = v_app_id;
  UPDATE public.job_postings SET filled_positions = 1 WHERE id = v_job_id;

  v_result := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_approves_cancel_request',
    p_actor_id := v_owner_id
  );
  ASSERT (v_result->>'success')::bool = true,
    format('S2 expected success=true, got: %s', v_result);
  ASSERT v_result->>'new_status' = 'cancelled',
    format('S2 expected new_status=cancelled, got: %s', v_result);
  ASSERT (SELECT status FROM public.applications WHERE id = v_app_id) = 'cancelled',
    'S2 applications.status expected cancelled';
  ASSERT (
    SELECT (cancellation_request->>'status')
    FROM public.applications WHERE id = v_app_id
  ) = 'approved',
    'S2 cancellation_request.status expected approved';

  RAISE NOTICE 'cancel_application_atomically tests: ALL PASS (S1-S5)';
END $$;

ROLLBACK;
