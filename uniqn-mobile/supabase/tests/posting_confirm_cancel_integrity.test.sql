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
  -- 추가 시나리오용 (슬롯 정규화 / 커스텀 역할 / 중복행)
  v_job2      uuid := gen_random_uuid();
  v_job3      uuid := gen_random_uuid();
  v_s6        uuid := gen_random_uuid();
  v_s7        uuid := gen_random_uuid();
  v_s8        uuid := gen_random_uuid();
  v_s9        uuid := gen_random_uuid();
  v_s10       uuid := gen_random_uuid();
  v_appE1     uuid := gen_random_uuid();
  v_appE2     uuid := gen_random_uuid();
  v_appC1     uuid := gen_random_uuid();
  v_appC2     uuid := gen_random_uuid();
  v_appDup    uuid := gen_random_uuid();
  -- range 형태 timeSlot('18:00~02:00') 이 시작시각('18:00')으로 정규화되는지
  v_assign_range  jsonb := jsonb_build_array(jsonb_build_object('date','2026-07-01','timeSlot','18:00~02:00','role','dealer'));
  -- client 가 'other'→'staff' 평탄화하고 customRole 보존하는 실제 페이로드 형태
  v_assign_custom jsonb := jsonb_build_array(jsonb_build_object('date','2026-07-01','timeSlot','18:00','role','staff','customRole','딜러보조'));
  -- 단일 payload 내 동일 (date,slot,role) 2행 → overfill 시도
  v_assign_dup    jsonb := jsonb_build_array(
                     jsonb_build_object('date','2026-08-01','timeSlot','20:00','role','dealer'),
                     jsonb_build_object('date','2026-08-01','timeSlot','20:00','role','dealer'));
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
    (v_s5,       '__sql_fixture_pi_s5@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S5"}'::jsonb, now(), now()),
    (v_s6,       '__sql_fixture_pi_s6@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S6"}'::jsonb, now(), now()),
    (v_s7,       '__sql_fixture_pi_s7@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S7"}'::jsonb, now(), now()),
    (v_s8,       '__sql_fixture_pi_s8@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S8"}'::jsonb, now(), now()),
    (v_s9,       '__sql_fixture_pi_s9@test.local',       '{"role":"staff"}'::jsonb,    '{"name":"S9"}'::jsonb, now(), now()),
    (v_s10,      '__sql_fixture_pi_s10@test.local',      '{"role":"staff"}'::jsonb,    '{"name":"S10"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id IN (v_owner, v_collab) THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users
  WHERE id IN (v_owner, v_collab, v_stranger, v_s1, v_s2, v_s3, v_s4, v_s5, v_s6, v_s7, v_s8, v_s9, v_s10)
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
  -- checked_in 은 check_in_ts 동반 필수(work_logs_status_timestamp_consistency 제약)
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, date, time_slot, status, role, check_in_ts, created_at, updated_at)
  VALUES (gen_random_uuid(), v_appH5, v_s5, v_job, '2026-06-01', '미정', 'checked_in', 'dealer', now(), now(), now());

  -- ---- seed: job2 (명시 시각 18:00 슬롯, dealer 1 / other:딜러보조 1) ----
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at
  )
  VALUES (
    v_job2, v_owner, v_ws, '__sql_fixture: posting integrity 2', 2, 0, 'active',
    jsonb_build_object('requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-07-01',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'startTime', '18:00',
        'roles', jsonb_build_array(
          jsonb_build_object('role', 'dealer', 'count', 1),
          jsonb_build_object('role', 'other', 'customRole', '딜러보조', 'count', 1)
        )
      ))
    ))),
    now(), now()
  );

  -- ---- seed: job3 (명시 시각 20:00 슬롯, dealer 1) — 중복행 overfill 테스트용 ----
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at
  )
  VALUES (
    v_job3, v_owner, v_ws, '__sql_fixture: posting integrity 3', 1, 0, 'active',
    jsonb_build_object('requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-08-01',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'startTime', '20:00',
        'roles', jsonb_build_array(jsonb_build_object('role', 'dealer', 'count', 1))
      ))
    ))),
    now(), now()
  );

  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES
    (v_appE1, v_job2, v_s6,  'S6',  'applied', now(), now()),
    (v_appE2, v_job2, v_s7,  'S7',  'applied', now(), now()),
    (v_appC1, v_job2, v_s8,  'S8',  'applied', now(), now()),
    (v_appC2, v_job2, v_s9,  'S9',  'applied', now(), now()),
    (v_appDup, v_job3, v_s10, 'S10', 'applied', now(), now());

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

  -- ============================================================
  -- T6) range 형태 timeSlot('18:00~02:00') 정규화 — 시작시각 '18:00' 으로 집계/가드
  -- ============================================================
  v_res := public.confirm_application(v_appE1, v_owner, v_assign_range);
  IF v_res->>'applicationId' IS NULL THEN RAISE EXCEPTION 'T6: range 슬롯 dealer 확정 실패: %', v_res; END IF;

  -- 집계 키의 time_slot 이 정규화된 '18:00' 로 나와야 함(raw '18:00~02:00' 아님)
  SELECT confirmed_count INTO v_cnt
  FROM public.count_posting_confirmed_by_slot(ARRAY[v_job2])
  WHERE role_key = 'dealer' AND time_slot = '18:00' AND work_date = '2026-07-01';
  IF v_cnt IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'T6: range→18:00 정규화 집계 1 기대, 실제 %', v_cnt; END IF;

  -- T6b) 동일 슬롯 dealer 정원(1) 초과 → MAX_CAPACITY (raw 비교였다면 미발견되어 통과했을 케이스)
  v_ok := false;
  BEGIN
    PERFORM public.confirm_application(v_appE2, v_owner, v_assign_range);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MAX_CAPACITY_REACHED%' THEN v_ok := true; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'T6b: range 슬롯 정원 초과가 차단되지 않음 (슬롯 키 불일치 회귀)'; END IF;

  -- ============================================================
  -- T7) 커스텀 역할 — client 가 role='staff'+customRole='딜러보조' 로 보냄 → 'other:딜러보조' 집계
  -- ============================================================
  v_res := public.confirm_application(v_appC1, v_owner, v_assign_custom);
  IF v_res->>'applicationId' IS NULL THEN RAISE EXCEPTION 'T7: 커스텀 역할 확정 실패: %', v_res; END IF;

  SELECT confirmed_count INTO v_cnt
  FROM public.count_posting_confirmed_by_slot(ARRAY[v_job2])
  WHERE role_key = 'other:딜러보조' AND time_slot = '18:00' AND work_date = '2026-07-01';
  IF v_cnt IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'T7: 커스텀역할 other:딜러보조 집계 1 기대, 실제 % (role=staff 평탄화 회귀)', v_cnt; END IF;

  -- T7b) 동일 커스텀역할 정원(1) 초과 → MAX_CAPACITY
  v_ok := false;
  BEGIN
    PERFORM public.confirm_application(v_appC2, v_owner, v_assign_custom);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MAX_CAPACITY_REACHED%' THEN v_ok := true; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'T7b: 커스텀역할 정원 초과가 차단되지 않음 (역할 키 불일치 회귀)'; END IF;

  -- ============================================================
  -- T8) 단일 payload 내 동일 (date,slot,role) 2행 → overfill 차단 (정원 1)
  -- ============================================================
  v_ok := false;
  BEGIN
    PERFORM public.confirm_application(v_appDup, v_owner, v_assign_dup);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%MAX_CAPACITY_REACHED%' THEN v_ok := true; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'T8: payload 중복행 overfill 이 차단되지 않음 (요청 집계 누락 회귀)'; END IF;

  -- ---- cleanup (역순; ROLLBACK 이중 안전) ----
  DELETE FROM public.work_logs WHERE job_posting_id IN (v_job, v_job2, v_job3);
  DELETE FROM public.applications WHERE job_posting_id IN (v_job, v_job2, v_job3);
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_job;
  DELETE FROM public.job_postings WHERE id IN (v_job, v_job2, v_job3);
  DELETE FROM public.workspaces WHERE id = v_ws;
  DELETE FROM auth.users WHERE id IN (v_owner, v_collab, v_stranger, v_s1, v_s2, v_s3, v_s4, v_s5, v_s6, v_s7, v_s8, v_s9, v_s10);
END $$;

SELECT pass('POSTING_INTEGRITY_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
