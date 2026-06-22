-- ============================================================
-- T-W3.1: cancel_application_atomically race + idempotency 통합 테스트
-- ============================================================
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_application_race.test.sql
--   기대 결과: 마지막에 'RACE_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치:
--   - 마커 이메일(__sql_fixture_race_*@test.local)로 격리
--   - cleanup: work_logs → applications → job_postings → auth.users 역순
--
-- 시나리오:
--   R1. 동일 staff 연속 호출 → 첫 호출 success+applied, 두 번째 idempotent=true
--   R2. filled_positions가 한 번만 감소(0), 두 번째 호출에서 -1 안 됨
--   R3. 다른 actor의 시도는 unauthorized + 사이드이펙트 없음
--
-- 한계: PL/pgSQL 단일 트랜잭션이라 진정한 병렬 race 시뮬레이션 불가.
--       RPC 자체의 SELECT FOR UPDATE는 PostgreSQL이 보장하므로 idempotency
--       가지 검증으로 충분. 진정한 병렬 검증이 필요하면 별도 도구(pgbench 등) 사용.
-- ============================================================
-- pgTAP wrap: pg_prove 호환을 위해 BEGIN/plan/finish/ROLLBACK 추가.
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_work_log_id uuid := gen_random_uuid();
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,      '__sql_fixture_race_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id,      '__sql_fixture_race_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_other_user_id, '__sql_fixture_race_other@test.local', '{"role":"staff"}'::jsonb,    '{"name":"OTHER"}'::jsonb, now(), now());

  -- public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_user_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace seed (job_postings.workspace_id NOT NULL 충족 — PR #88 schema 변경)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_race_ws', v_owner_id, now(), now());

  -- filled_positions 는 SP3 부터 트리거가 applications status 로 관리. 0 시드 → 아래 confirmed INSERT 가 +1.
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: race', 3, 0, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-06-01'))),
      'cancelled_at', NULL
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, date, status, role, created_at, updated_at
  )
  VALUES (v_work_log_id, v_app_id, v_staff_id, v_job_id, '2026-06-01', 'scheduled', 'staff', now(), now());

  -- ----------------------------------------------------------
  -- R1: 동일 staff 연속 호출
  -- ----------------------------------------------------------
  -- [#195 가드] 호출자 바인딩: actor(v_staff_id) 로 jwt sub 세팅
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_first := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id, 'first call');
  IF NOT ((v_first->>'success')::bool) THEN RAISE EXCEPTION 'R1 first fail: %', v_first; END IF;
  IF v_first->>'new_status' != 'applied' THEN RAISE EXCEPTION 'R1 first status: %', v_first; END IF;
  IF (v_first->>'idempotent') IS NOT NULL AND (v_first->>'idempotent')::bool THEN
    RAISE EXCEPTION 'R1 first should NOT be idempotent: %', v_first;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_second := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id, 'second call');
  IF NOT ((v_second->>'success')::bool AND (v_second->>'idempotent')::bool) THEN
    RAISE EXCEPTION 'R1 second fail: %', v_second;
  END IF;

  -- ----------------------------------------------------------
  -- R2: 사이드이펙트 안정성
  -- ----------------------------------------------------------
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) != 0 THEN
    RAISE EXCEPTION 'R2 filled_positions not 0';
  END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'applied' THEN
    RAISE EXCEPTION 'R2 status not applied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_logs WHERE application_id = v_app_id AND status = 'scheduled') THEN
    RAISE EXCEPTION 'R2 work_logs not deleted';
  END IF;

  -- ----------------------------------------------------------
  -- R3: 다른 user의 시도 → unauthorized
  -- ----------------------------------------------------------
  -- 타인(v_other_user_id)이 본인 명의로 인증 후 취소 시도 → 비-applicant 거부 검증.
  UPDATE public.applications SET status = 'confirmed' WHERE id = v_app_id;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
  v_third := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_other_user_id);
  IF (v_third->>'success')::bool OR v_third->>'error' != 'unauthorized' THEN
    RAISE EXCEPTION 'R3 fail: %', v_third;
  END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'confirmed' THEN
    RAISE EXCEPTION 'R3 side: status changed after unauthorized';
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.work_logs WHERE application_id = v_app_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_user_id);
END $$;

SELECT pass('RACE_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
