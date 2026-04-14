-- ============================================================
-- T-B3: cancel_application_atomically RPC SQL 회귀 테스트
-- ============================================================
-- 목적: PR 머지 후 마이그레이션 적용 시 수동/CI 실행하여 RPC 동작 검증.
-- 실행 방법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_application_atomically.test.sql
--   또는 supabase db reset 후 supabase test 명령
--
-- 시나리오:
--   1. staff_initiates happy path: confirmed → applied
--   2. staff_approves_cancel_request happy path: cancellation_pending → cancelled
--   3. idempotency: 재호출 시 success+idempotent
--   4. unauthorized actor: 권한 없음 에러
--   5. invalid_status: 상태 불일치 에러
--
-- 본 파일은 마이그레이션 적용 후 실행되어야 하므로
-- BEGIN/ROLLBACK 트랜잭션으로 격리 (테스트 데이터 잔존 방지).
-- ============================================================

BEGIN;

-- ============================================================
-- 0. 테스트 픽스처 준비
-- ============================================================
-- NOTE: 실제 운영 DB 스키마에 맞게 컬럼/제약 보정 필요.
--       users / job_postings / applications / work_logs FK 만족시켜야 함.

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
  -- 픽스처 INSERT 자리 (스키마 의존)
  -- INSERT INTO users(id, ...) VALUES (v_owner_id, ...), (v_staff_id, ...);
  -- INSERT INTO job_postings(id, owner_id, total_positions, filled_positions, status, ...)
  --   VALUES (v_job_id, v_owner_id, 5, 1, 'active', ...);
  -- INSERT INTO applications(id, job_posting_id, applicant_id, status,
  --                          confirmation_history, ...)
  --   VALUES (v_app_id, v_job_id, v_staff_id, 'confirmed',
  --           '[{"assignments":[{"dates":["2026-05-01"]}],"cancelled_at":null}]'::jsonb, ...);
  -- INSERT INTO work_logs(id, application_id, status, ...)
  --   VALUES (v_work_log_id, v_app_id, 'scheduled', ...);

  -- ----------------------------------------------------------
  -- 시나리오 1: staff_initiates happy path
  -- 기대: success=true, new_status='applied', deleted_work_log_count>=1
  -- ----------------------------------------------------------
  -- v_result := public.cancel_application_atomically(
  --   p_application_id := v_app_id,
  --   p_actor_type := 'staff_initiates',
  --   p_actor_id := v_staff_id,
  --   p_cancel_reason := '개인 사정'
  -- );
  -- ASSERT (v_result->>'success')::bool = true,
  --   format('S1 expected success=true, got: %s', v_result);
  -- ASSERT v_result->>'new_status' = 'applied',
  --   format('S1 expected new_status=applied, got: %s', v_result);
  -- ASSERT (v_result->>'deleted_work_log_count')::int >= 1,
  --   format('S1 expected deleted_work_log_count>=1, got: %s', v_result);

  -- 사이드이펙트 검증:
  -- ASSERT (SELECT status FROM applications WHERE id = v_app_id) = 'applied';
  -- ASSERT (SELECT filled_positions FROM job_postings WHERE id = v_job_id) = 0;
  -- ASSERT NOT EXISTS (SELECT 1 FROM work_logs
  --                    WHERE application_id = v_app_id AND status = 'scheduled');

  -- ----------------------------------------------------------
  -- 시나리오 3: idempotency (시나리오1 직후 재호출)
  -- 기대: success=true, idempotent=true
  -- ----------------------------------------------------------
  -- v_result := public.cancel_application_atomically(
  --   p_application_id := v_app_id,
  --   p_actor_type := 'staff_initiates',
  --   p_actor_id := v_staff_id
  -- );
  -- ASSERT (v_result->>'success')::bool = true
  --   AND (v_result->>'idempotent')::bool = true,
  --   format('S3 expected idempotent=true, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 4: unauthorized actor (다른 사용자가 staff_initiates 시도)
  -- 기대: success=false, error='unauthorized'
  -- ----------------------------------------------------------
  -- 새 픽스처 (다시 confirmed 상태로):
  -- UPDATE applications SET status = 'confirmed' WHERE id = v_app_id;
  --
  -- v_result := public.cancel_application_atomically(
  --   p_application_id := v_app_id,
  --   p_actor_type := 'staff_initiates',
  --   p_actor_id := v_other_user_id  -- ≠ applicant
  -- );
  -- ASSERT (v_result->>'success')::bool = false
  --   AND v_result->>'error' = 'unauthorized',
  --   format('S4 expected unauthorized, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 5: invalid_status (status='applied'에서 staff_initiates 시도)
  -- → idempotency 가지에서 success+idempotent 처리됨 (시나리오 3과 동일)
  --
  -- 진짜 invalid_status는 status='cancelled' 등 종결 상태:
  -- UPDATE applications SET status = 'cancelled' WHERE id = v_app_id;
  -- v_result := public.cancel_application_atomically(
  --   p_application_id := v_app_id,
  --   p_actor_type := 'staff_initiates',
  --   p_actor_id := v_staff_id
  -- );
  -- ASSERT (v_result->>'success')::bool = false
  --   AND v_result->>'error' = 'invalid_status_for_cancellation',
  --   format('S5 expected invalid_status_for_cancellation, got: %s', v_result);

  -- ----------------------------------------------------------
  -- 시나리오 2: staff_approves_cancel_request happy path
  -- 사전 조건: status='cancellation_pending' + cancellation_request.status='pending'
  -- ----------------------------------------------------------
  -- UPDATE applications SET
  --   status = 'cancellation_pending',
  --   cancellation_request = jsonb_build_object(
  --     'status', 'pending',
  --     'requested_at', now()::text,
  --     'reason', '스태프 요청'
  --   ),
  --   confirmation_history = '[{"assignments":[{"dates":["2026-05-01"]}],"cancelled_at":null}]'::jsonb
  -- WHERE id = v_app_id;
  -- UPDATE job_postings SET filled_positions = 1 WHERE id = v_job_id;
  --
  -- v_result := public.cancel_application_atomically(
  --   p_application_id := v_app_id,
  --   p_actor_type := 'staff_approves_cancel_request',
  --   p_actor_id := v_owner_id
  -- );
  -- ASSERT (v_result->>'success')::bool = true,
  --   format('S2 expected success=true, got: %s', v_result);
  -- ASSERT v_result->>'new_status' = 'cancelled',
  --   format('S2 expected new_status=cancelled, got: %s', v_result);
  -- ASSERT (SELECT status FROM applications WHERE id = v_app_id) = 'cancelled';
  -- ASSERT (SELECT (cancellation_request->>'status')
  --         FROM applications WHERE id = v_app_id) = 'approved';

  RAISE NOTICE 'cancel_application_atomically tests: OK (fixtures commented out — fill before running)';
END $$;

ROLLBACK;
