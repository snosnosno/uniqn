-- ============================================================
-- 공고 확정/취소 정합성: helper / H1 / H4 / H5 회귀 테스트
-- ============================================================
-- 목적: count_posting_confirmed_by_slot 집계 + confirm_application 정원가드(H1)
--       + 협업자 권한(H4) + cancel_application_atomically 체크인 후 차단(H5) 검증.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/posting_confirm_cancel_integrity.test.sql
--   또는 supabase test db (CI: .github/workflows/db-tests.yml)
--   기대 결과: 마지막에 'POSTING_INTEGRITY_TEST_PASSED' 1행, 에러 0건
--
-- 안전장치:
--   - 마커 이메일(__sql_fixture_pi_*@test.local)로 production 격리
--   - BEGIN/ROLLBACK 래핑 — 실행 후 전부 롤백(영속 없음)
--   - DO block 내부 RAISE EXCEPTION 발생 시 pg_prove 가 fail 잡음
--
-- 시나리오 (전부 NEW RPC 기준 기대값):
--   HELPER. dealer/미정 확정 1건 → count 1
--   H1.     동일 dealer/슬롯 정원(1) 초과 2번째 확정 → MAX_CAPACITY_REACHED
--   H4-a.   협업자(jpc)가 floor 확정 → 성공
--   H4-b.   비권한자(stranger)가 확정 시도 → PERMISSION_DENIED
--   H5.     checked_in work_log 있는 취소 승인 → staff_already_checked_in
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_ws        uuid := gen_random_uuid();
  v_owner     uuid := gen_random_uuid();
  v_collab    uuid := gen_random_uuid();
  v_stranger  uuid := gen_random_uuid();
  v_s1        uuid := gen_random_uuid();
  v_s2        uuid := gen_random_uuid();
  v_s3        uuid := gen_random_uuid();
  v_s4        uuid := gen_random_uuid();
  v_s5        uuid := gen_random_uuid();
  v_job       uuid := gen_random_uuid();
  v_appD1     uuid := gen_random_uuid();
  v_appD2     uuid := gen_random_uuid();
  v_appF1     uuid := gen_random_uuid();
  v_appF2     uuid := gen_random_uuid();
  v_appH5     uuid := gen_random_uuid();
  v_assign_dealer jsonb := jsonb_build_array(jsonb_build_object('date','2026-05-23','timeSlot','미정','role','dealer'));
  v_assign_floor  jsonb := jsonb_build_array(jsonb_build_object('date','2026-05-23','timeSlot','미정','role','floor'));
  v_res jsonb;
  v_cnt int;
  v_ok  boolean;
BEGIN
  -- ---- seed: auth.users (public.users FK) + public.users ----
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_pi_owner@test.local',    '{"role":"employer"}'::jsonb, '{"name":"O"}'::jsonb,  now(), now()),
    (v_collab,   '__sql_fixture_pi_collab@test.local',   '{"role":"employer"}'::jsonb, '{"name":"C"}'::jsonb,  now(), now()),
    (v_stranger, '__sql_fixture_pi_stranger@test.local', '{"role":"staff"}'::jsonb,    '{"name":"X"}'::jsonb,  now(), now()),
    (v_s1,       '__sql_fixture_pi_s1@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S1"}'::jsonb, now(), now()),
    (v_s2,       '__sql_fixture_pi_s2@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S2"}'::jsonb, now(), now()),
    (v_s3,       '__sql_fixture_pi_s3@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S3"}'::jsonb, now(), now()),
    (v_s4,       '__sql_fixture_pi_s4@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S4"}'::jsonb, now(), now()),
    (v_s5,       '__sql_fixture_pi_s5@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S5"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id IN (v_owner, v_collab) THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users
  WHERE id IN (v_owner, v_collab, v_stranger, v_s1, v_s2, v_s3, v_s4, v_s5)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  -- ---- seed: workspace + posting(dated, TBA slot, dealer 1 / floor 1) ----
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_pi_ws', v_owner, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at
  )
  VALUES (
    v_job, v_owner, v_ws, '__sql_fixture: posting integrity', 2, 0, 'active',
    jsonb_build_object('requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-05-23',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'isTimeToBeAnnounced', true,
        'roles', jsonb_build_array(
          jsonb_build_object('role', 'dealer', 'count', 1),
          jsonb_build_object('role', 'floor',  'count', 1)
        )
      ))
    ))),
    now(), now()
  );

  INSERT INTO public.job_posting_collaborators (id, job_posting_id, user_id, added_by, added_at)
  VALUES (gen_random_uuid(), v_job, v_collab, v_owner, now());

  -- ---- seed: applied applications ----
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES
    (v_appD1, v_job, v_s1, 'S1', 'applied', now(), now()),
    (v_appD2, v_job, v_s2, 'S2', 'applied', now(), now()),
    (v_appF1, v_job, v_s3, 'S3', 'applied', now(), now()),
    (v_appF2, v_job, v_s4, 'S4', 'applied', now(), now());

  -- ---- seed: H5 application (cancellation_pending) + checked_in work_log ----
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, cancellation_request, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_appH5, v_job, v_s5, 'S5', 'cancellation_pending',
    jsonb_build_object('status', 'pending', 'requested_at', now()::text, 'reason', 'req'),
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-23'))),
      'cancelled_at', NULL
    )),
    now(), now()
  );
  -- 별도 date('2026-06-01') 사용 — H1/HELPER 의 2026-05-23 dealer 정원 집계와 격리(checked_in 도 집계 대상이므로).
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (gen_random_uuid(), v_appH5, v_s5, v_job, '2026-06-01', '미정', 'checked_in', 'dealer', now(), now());

  -- ============================================================
  -- 1) owner 가 dealer 확정 → 성공
  -- ============================================================
  v_res := public.confirm_application(v_appD1, v_owner, v_assign_dealer);
  IF v_res->>'applicationId' IS NULL THEN RAISE EXCEPTION 'SEED D1 confirm 실패: %', v_res; END IF;

  -- HELPER: dealer/미정 확정 수 = 1
  SELECT confirmed_count INTO v_cnt
  FROM public.count_posting_confirmed_by_slot(ARRAY[v_job])
  WHERE role_key = 'dealer' AND time_slot = '미정' AND work_date = '2026-05-23';
  IF v_cnt IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'HELPER: dealer 확정 수 1 기대, 실제 %', v_cnt; END IF;

  -- ============================================================
  -- H1) dealer 정원(1) 초과 2번째 확정 → MAX_CAPACITY_REACHED
  -- ============================================================
  v_ok := false;
  BEGIN
    PERFORM public.confirm_application(v_appD2, v_owner, v_assign_dealer);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MAX_CAPACITY_REACHED%' THEN v_ok := true; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'H1: 정원 초과 dealer 확정이 차단되지 않음 (MAX_CAPACITY_REACHED 미발생)'; END IF;

  -- ============================================================
  -- H4-a) 협업자(jpc)가 floor 확정 → 성공
  -- ============================================================
  v_res := public.confirm_application(v_appF1, v_collab, v_assign_floor);
  IF v_res->>'applicationId' IS NULL THEN RAISE EXCEPTION 'H4-a: 협업자 floor 확정 실패: %', v_res; END IF;

  -- ============================================================
  -- H4-b) 비권한자(stranger) 확정 시도 → PERMISSION_DENIED
  -- ============================================================
  v_ok := false;
  BEGIN
    PERFORM public.confirm_application(v_appF2, v_stranger, v_assign_floor);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PERMISSION_DENIED%' THEN v_ok := true; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'H4-b: 비권한자 확정이 PERMISSION_DENIED 로 차단되지 않음'; END IF;

  -- ============================================================
  -- H5) checked_in work_log 있는 취소 승인 → staff_already_checked_in
  -- ============================================================
  v_res := public.cancel_application_atomically(v_appH5, 'staff_approves_cancel_request', v_owner);
  IF v_res->>'error' IS DISTINCT FROM 'staff_already_checked_in' THEN
    RAISE EXCEPTION 'H5: 체크인 후 취소가 차단되지 않음 (staff_already_checked_in 기대, 실제: %)', v_res;
  END IF;

  -- ---- cleanup (역순; ROLLBACK 이중 안전) ----
  DELETE FROM public.work_logs WHERE job_posting_id = v_job;
  DELETE FROM public.applications WHERE job_posting_id = v_job;
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_job;
  DELETE FROM public.job_postings WHERE id = v_job;
  DELETE FROM public.workspaces WHERE id = v_ws;
  DELETE FROM auth.users WHERE id IN (v_owner, v_collab, v_stranger, v_s1, v_s2, v_s3, v_s4, v_s5);
END $$;

SELECT pass('POSTING_INTEGRITY_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
