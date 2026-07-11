-- ============================================================
-- P1#7: process_qr_checkin_atomically 클라 시각 클램프 회귀 테스트
-- ============================================================
-- 목적: 유저플로우 감사(2026-07-10) 클러스터 C — 디바이스 시계 조작으로
--   근무시간(=정산액)을 부풀리는 것을 서버가 차단하는지 검증.
--   마이그레이션 20260711030100_qr_checkin_server_time_clamp.sql 적용 후 실행.
--
-- 계약:
--   p_check_time 이 NULL 이거나 서버 now() 와 5분(300초) 초과 편차 → 서버 now() 로 대체.
--   5분 이내 편차는 그대로 기록(사용자가 화면에서 본 시각과의 일관성).
--
-- 시나리오:
--   C1. 30분 과거 시각 → 클램프(check_in_ts ≈ now())
--   C2. 1분 과거 시각 → 통과(check_in_ts ≈ 전달값)
--   C3. NULL → 서버 now()
--   C4. 미래 +3시간 checkOut 조작 → 클램프되어 duration ≈ 실제(2h), 5h 아님
--
-- 하네스: process_qr_checkin_atomically.test.sql 과 동일(BEGIN/plan/finish/ROLLBACK,
--   마커 이메일 __sql_fixture_qrclamp_*, DO block RAISE EXCEPTION → fail)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_work_log_id uuid := gen_random_uuid();
  v_result jsonb;
  v_recorded timestamptz;
BEGIN
  -- seed (process_qr 하네스와 동일 구조)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_qrclamp_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_qrclamp_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_qrclamp_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: qr clamp', 5, 0, 'active', now(), now());

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

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);

  -- ----------------------------------------------------------
  -- C1: 30분 과거 시각 → 클램프 (check_in_ts ≈ now())
  -- ----------------------------------------------------------
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now() - interval '30 minutes', NULL
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'C1 fail: %', v_result; END IF;
  SELECT check_in_ts INTO v_recorded FROM public.work_logs WHERE id = v_work_log_id;
  IF abs(EXTRACT(EPOCH FROM (v_recorded - now()))) > 60 THEN
    RAISE EXCEPTION 'C1 clamp miss: recorded=% (30분 과거가 그대로 기록됨)', v_recorded;
  END IF;

  -- ----------------------------------------------------------
  -- C2: 1분 과거 시각 → 통과 (전달값 그대로)
  -- ----------------------------------------------------------
  UPDATE public.work_logs SET status = 'scheduled', check_in_ts = NULL WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now() - interval '1 minute', NULL
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'C2 fail: %', v_result; END IF;
  SELECT check_in_ts INTO v_recorded FROM public.work_logs WHERE id = v_work_log_id;
  IF abs(EXTRACT(EPOCH FROM (v_recorded - (now() - interval '1 minute')))) > 5 THEN
    RAISE EXCEPTION 'C2 pass-through miss: recorded=% (1분 편차가 클램프됨)', v_recorded;
  END IF;

  -- ----------------------------------------------------------
  -- C3: NULL → 서버 now()
  -- ----------------------------------------------------------
  UPDATE public.work_logs SET status = 'scheduled', check_in_ts = NULL WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', NULL, NULL
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'C3 fail: %', v_result; END IF;
  SELECT check_in_ts INTO v_recorded FROM public.work_logs WHERE id = v_work_log_id;
  IF v_recorded IS NULL OR abs(EXTRACT(EPOCH FROM (v_recorded - now()))) > 60 THEN
    RAISE EXCEPTION 'C3 null fallback miss: recorded=%', v_recorded;
  END IF;

  -- ----------------------------------------------------------
  -- C4: checkOut 미래 +3h 조작 → 클램프, duration ≈ 실제 2h (5h 아님)
  -- ----------------------------------------------------------
  -- 2시간 전 출근 상태 직접 시드(check_in_ts 는 보호 트리거 차단목록에 없음)
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now() - interval '2 hours',
    check_out_ts = NULL, work_duration = 0 WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkOut', now() + interval '3 hours', NULL
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'C4 fail: %', v_result; END IF;
  IF (v_result->>'work_duration')::numeric <= 1.5 OR (v_result->>'work_duration')::numeric >= 2.5 THEN
    RAISE EXCEPTION 'C4 duration manipulated: % (미래 시각이 그대로 기록됨)', v_result;
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.work_logs WHERE id = v_work_log_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('QR_CLAMP_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
