-- ============================================================
-- APPL-1: 확정 해제 시 원본 지원 일정 복원 (W1-5)
-- ============================================================
-- 목적: 마이그레이션 20260727150000_restore_original_assignments_on_cancel.sql 검증.
--   부분 확정이 UI 기본 경로인데 confirm_application 이 assignments 를 선택분으로 덮어쓰고,
--   cancel_application_atomically 가 그걸 원복하지 않아 '확정 → 해제 → 재확정' 사이클마다
--   지원자의 선택지가 단조 감소했다.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_restores_original_assignments.test.sql
--   기대 결과: 마지막에 'CANCEL_RESTORE_ASSIGNMENTS_PASSED' 1행 반환, 에러 0건
--
-- 안전장치(cancel_application_employer_initiates.test.sql 하네스와 동일):
--   - 마커 이메일(__sql_fixture_ra_*@test.local)로 production 에서도 격리 가능
--   - public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
--   - BEGIN/plan/finish/ROLLBACK, DO block 내 RAISE EXCEPTION 을 fail 로 잡음
--
-- 시나리오:
--   R1. employer_initiates 해제 → assignments 가 original_application.assignments(3일)로 복원
--   R2. staff_initiates 해제 → 동일하게 복원 (applied 복귀 경로 공통)
--   R3. original_application 이 없는 레거시 행 → 현행 assignments 유지(소급 불가, 파괴 금지)
--   R4. 취소요청 승인(cancelled 종결) → 복원하지 않는다
-- ============================================================
BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  -- applications 에 (job_posting_id, applicant_id) UNIQUE 제약이 있어 케이스별로 지원자를 분리한다.
  v_staff2_id uuid := gen_random_uuid();
  v_staff3_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_app_legacy_id uuid := gen_random_uuid();
  v_app_cancel_id uuid := gen_random_uuid();
  v_result jsonb;
  v_assignments jsonb;
  -- 지원자가 원래 신청한 3일
  v_original jsonb := jsonb_build_array(
    jsonb_build_object('dates', jsonb_build_array('2026-05-01'), 'timeSlot', '09:00', 'roleIds', jsonb_build_array('dealer')),
    jsonb_build_object('dates', jsonb_build_array('2026-05-02'), 'timeSlot', '09:00', 'roleIds', jsonb_build_array('dealer')),
    jsonb_build_object('dates', jsonb_build_array('2026-05-03'), 'timeSlot', '09:00', 'roleIds', jsonb_build_array('dealer'))
  );
  -- 사장이 그중 1일만 확정한 뒤 남은 축소본
  v_partial jsonb := jsonb_build_array(
    jsonb_build_object('dates', jsonb_build_array('2026-05-01'), 'timeSlot', '09:00', 'roleIds', jsonb_build_array('dealer'))
  );
  v_active_history jsonb := jsonb_build_array(jsonb_build_object(
    'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
    'cancelled_at', NULL,
    'confirmed_at', now()::text
  ));
BEGIN
  -- ============================================================
  -- 0. seed
  -- ============================================================
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_ra_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_ra_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_staff2_id, '__sql_fixture_ra_staff2@test.local', '{"role":"staff"}'::jsonb,  '{"name":"STAFF2"}'::jsonb, now(), now()),
    (v_staff3_id, '__sql_fixture_ra_staff3@test.local', '{"role":"staff"}'::jsonb,  '{"name":"STAFF3"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_staff2_id, v_staff3_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_ra_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: restore assignments', 5, 0, 'active', now(), now());

  -- ============================================================
  -- R1: employer_initiates 해제 → 원본 3일 복원
  -- ============================================================
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status,
    assignments, original_application, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed',
    v_partial,
    jsonb_build_object('assignments', v_original, 'appliedAt', now()::text),
    v_active_history, now(), now()
  );

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_owner_id, '구인자 해제');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'R1 fail: %', v_result; END IF;

  SELECT assignments INTO v_assignments FROM public.applications WHERE id = v_app_id;
  IF jsonb_array_length(v_assignments) != 3 THEN
    RAISE EXCEPTION 'R1: 원본 3일이 복원되지 않았다 — got % : %', jsonb_array_length(v_assignments), v_assignments;
  END IF;
  IF v_assignments != v_original THEN
    RAISE EXCEPTION 'R1: 복원값이 original_application.assignments 와 다르다 — %', v_assignments;
  END IF;

  -- ============================================================
  -- R2: staff_initiates 해제도 같은 복원 계약을 공유한다
  -- ============================================================
  UPDATE public.applications
  SET status = 'confirmed', assignments = v_partial, confirmation_history = v_active_history
  WHERE id = v_app_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id, '개인 사정');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'R2 fail: %', v_result; END IF;

  SELECT assignments INTO v_assignments FROM public.applications WHERE id = v_app_id;
  IF jsonb_array_length(v_assignments) != 3 THEN
    RAISE EXCEPTION 'R2: staff 경로에서 복원 실패 — got %', jsonb_array_length(v_assignments);
  END IF;

  -- ============================================================
  -- R3: original_application 이 없는 레거시 행은 현행 유지 (소급 불가, 파괴 금지)
  -- ============================================================
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status,
    assignments, original_application, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_legacy_id, v_job_id, v_staff2_id, 'STAFF2', 'confirmed',
    v_partial, NULL, v_active_history, now(), now()
  );

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_legacy_id, 'employer_initiates', v_owner_id, '레거시');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'R3 fail: %', v_result; END IF;

  SELECT assignments INTO v_assignments FROM public.applications WHERE id = v_app_legacy_id;
  IF v_assignments != v_partial THEN
    RAISE EXCEPTION 'R3: 원본이 없는 행의 assignments 를 건드렸다 — %', v_assignments;
  END IF;

  -- ============================================================
  -- R4: 취소요청 승인(cancelled 종결)은 복원하지 않는다
  -- ============================================================
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status,
    assignments, original_application, confirmation_history, cancellation_request, created_at, updated_at
  )
  VALUES (
    -- 승인 경로의 상태 전제는 cancellation_pending 이다(RPC :70).
    v_app_cancel_id, v_job_id, v_staff3_id, 'STAFF3', 'cancellation_pending',
    v_partial,
    jsonb_build_object('assignments', v_original, 'appliedAt', now()::text),
    v_active_history,
    jsonb_build_object('status', 'pending', 'reason', '개인 사정', 'requestedAt', now()::text),
    now(), now()
  );

  -- 이름과 달리 승인 주체는 **구인자** 다(RPC 인가 분기 :81-84 에서 owner/워크스페이스/협업자 판정).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_cancel_id, 'staff_approves_cancel_request', v_owner_id);
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'R4 fail: %', v_result; END IF;

  SELECT assignments INTO v_assignments FROM public.applications WHERE id = v_app_cancel_id;
  IF v_assignments != v_partial THEN
    RAISE EXCEPTION 'R4: cancelled 종결 경로에서 복원이 일어났다 — %', v_assignments;
  END IF;

  -- ============================================================
  -- Cleanup (역순)
  -- ============================================================
  DELETE FROM public.notifications WHERE recipient_id IN (v_owner_id, v_staff_id, v_staff2_id, v_staff3_id);
  DELETE FROM public.work_logs WHERE application_id IN (v_app_id, v_app_legacy_id, v_app_cancel_id);
  DELETE FROM public.applications WHERE id IN (v_app_id, v_app_legacy_id, v_app_cancel_id);
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_staff_id, v_staff2_id, v_staff3_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_staff2_id, v_staff3_id);
END $$;

SELECT pass('CANCEL_RESTORE_ASSIGNMENTS_PASSED');
SELECT * FROM finish();
ROLLBACK;
