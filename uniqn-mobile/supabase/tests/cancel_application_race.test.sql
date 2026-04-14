-- ============================================================
-- T-W3.1: cancel_application_atomically race + idempotency 통합 테스트
-- ============================================================
-- ⚠️ 환경 요구사항 (PRODUCTION 실행 금지):
--   - public.users.id → auth.users(id) FK가 있어 fixture가 auth seed 필요
--   - 로컬 supabase 환경 또는 test branch 전용
--   - 사용법: supabase db reset → auth seed → supabase db psql -f <이 파일>
--
-- 목적: SELECT FOR UPDATE 기반 RPC가 동일 application에 대한 연속/중복 호출에서
--       일관된 결과를 반환하는지 검증.
--
-- 시나리오:
--   R1. 동일 staff가 연속 호출 → 첫 호출은 실제 취소, 두 번째는 idempotent
--   R2. R1 후 사이드이펙트(filled_positions, work_logs) 안정성 확인
--   R3. 다른 actor가 concurrent하게 시도 → unauthorized
--
-- 한계: PL/pgSQL 단일 트랜잭션에서는 진정한 병렬 race를 시뮬레이션할 수 없음.
--       RPC 자체의 SELECT FOR UPDATE는 PostgreSQL이 보장하므로, 본 테스트는
--       idempotency 가지가 정상 동작함을 보장하면 충분.
--       진정한 병렬 검증이 필요하면 별도 도구(pgbench, jest-concurrent) 사용.
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
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
BEGIN
  -- ----------------------------------------------------------
  -- 0. 픽스처
  -- ----------------------------------------------------------
  -- NOTE: public.users.id → auth.users(id) FK 존재. 로컬/test 환경 사전 seed 필요.
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES
    (v_owner_id, format('owner-%s@test.local', v_owner_id), 'OWNER', 'employer', now(), now()),
    (v_staff_id, format('staff-%s@test.local', v_staff_id), 'STAFF', 'staff', now(), now()),
    (v_other_user_id, format('other-%s@test.local', v_other_user_id), 'OTHER', 'staff', now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, 'TEST 공고 - race', 3, 1, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, status, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(
        jsonb_build_object('dates', jsonb_build_array('2026-06-01'))
      ),
      'cancelled_at', NULL
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (id, application_id, status, created_at, updated_at)
  VALUES (v_work_log_id, v_app_id, 'scheduled', now(), now());

  -- ----------------------------------------------------------
  -- R1: 동일 staff 연속 호출 (race를 직렬화로 단순화)
  -- ----------------------------------------------------------
  v_first := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id,
    p_cancel_reason := 'first call'
  );
  ASSERT (v_first->>'success')::bool = true,
    format('R1 first call expected success, got: %s', v_first);
  ASSERT v_first->>'new_status' = 'applied',
    format('R1 first call expected new_status=applied, got: %s', v_first);
  ASSERT (v_first->>'idempotent') IS NULL OR (v_first->>'idempotent')::bool = false,
    format('R1 first call should NOT be idempotent, got: %s', v_first);

  v_second := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id,
    p_cancel_reason := 'second call (duplicate)'
  );
  ASSERT (v_second->>'success')::bool = true
    AND (v_second->>'idempotent')::bool = true,
    format('R1 second call expected idempotent=true, got: %s', v_second);

  -- ----------------------------------------------------------
  -- R2: 사이드이펙트 안정성 — 두 번째 호출 이후에도 변화 없어야 함
  -- ----------------------------------------------------------
  ASSERT (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) = 0,
    'R2 expected filled_positions=0 (decremented once, not twice)';
  ASSERT (SELECT status FROM public.applications WHERE id = v_app_id) = 'applied',
    'R2 expected applications.status=applied (not flipped back)';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.work_logs
    WHERE application_id = v_app_id AND status = 'scheduled'
  ), 'R2 expected scheduled work_logs to remain deleted';

  -- ----------------------------------------------------------
  -- R3: 다른 user의 concurrent 시도 → unauthorized
  -- 사전: status를 confirmed로 되돌려 idempotency 가지 회피
  -- ----------------------------------------------------------
  UPDATE public.applications SET status = 'confirmed' WHERE id = v_app_id;

  v_third := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_other_user_id  -- ≠ applicant
  );
  ASSERT (v_third->>'success')::bool = false
    AND v_third->>'error' = 'unauthorized',
    format('R3 expected unauthorized, got: %s', v_third);

  -- 사이드이펙트: 권한 거부 후 상태 변화 없어야 함
  ASSERT (SELECT status FROM public.applications WHERE id = v_app_id) = 'confirmed',
    'R3 expected applications.status=confirmed (no change after unauthorized)';

  RAISE NOTICE 'cancel_application_race tests: ALL PASS (R1-R3)';
END $$;

ROLLBACK;
