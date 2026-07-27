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
-- pgTAP wrap: pg_prove 호환을 위해 BEGIN/plan/finish/ROLLBACK 추가.
-- schema drift fix: check_in_time/check_out_time → check_in_ts/check_out_ts
-- (2026-04-21 work_logs timestamptz 전환에서 jsonb 컬럼 DROP)
-- =============================================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_other_staff_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
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

  -- public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace seed (job_postings.workspace_id NOT NULL 충족 — PR #88 schema 변경)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_qr_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: qr atomicity', 5, 1, 'active', now(), now());

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
  -- [#195 가드] 호출자 바인딩: 직원 본인 셀프스캔(p_staff_id=v_staff_id) 로 jwt sub 세팅
  -- [P1#7 클램프] 5분 초과 과거 시각은 서버 now() 로 대체되므로 now() 로 호출하고,
  -- S2 의 2시간 duration 시나리오는 아래에서 check_in_ts 직접 시드로 구성한다.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), to_char(now(), 'YYYY-MM-DD')
  );
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'S1 fail: %', v_result; END IF;
  IF v_result->>'action' != 'checkIn' THEN RAISE EXCEPTION 'S1 action: %', v_result; END IF;
  IF (SELECT status::text FROM public.work_logs WHERE id = v_work_log_id) != 'checked_in' THEN
    RAISE EXCEPTION 'S1 side: status';
  END IF;

  -- S2 준비: 2시간 전 출근 상태를 직접 시드 (클램프 때문에 RPC 로는 과거 시각 기록 불가.
  -- check_in_ts 는 protect_work_log_payroll_columns 차단목록에 없어 superuser 컨텍스트 UPDATE 가능)
  UPDATE public.work_logs SET check_in_ts = v_check_in_time WHERE id = v_work_log_id;

  -- ----------------------------------------------------------
  -- S5: 이중 checkIn → already_checked_in
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'already_checked_in' THEN
    RAISE EXCEPTION 'S5 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S2: checkOut happy path (S1 직후, 약 2시간 경과)
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
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
    status = 'scheduled', check_in_ts = NULL, check_out_ts = NULL, work_duration = 0
  WHERE id = v_work_log_id;

  -- 호출자(v_other_staff_id)가 본인 명의로 인증(가드 통과) → work_log.staff_id 불일치로 staff_id_mismatch (업무 체크 검증 유지)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_other_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'staff_id_mismatch' THEN
    RAISE EXCEPTION 'S4 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S6: scheduled에서 checkOut → not_checked_in
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkOut', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'not_checked_in' THEN
    RAISE EXCEPTION 'S6 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S3: payroll completed → already_settled
  -- ----------------------------------------------------------
  -- protect_work_log_payroll_columns trigger 가 staff 직접 payroll UPDATE 차단.
  -- 본 fixture 는 superuser context (auth.jwt() null) 이라 v_role='' → staff 로 인식.
  -- service_role 권한 설정 후 UPDATE (ROLLBACK 으로 무효화).
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.work_logs SET payroll_status = 'completed' WHERE id = v_work_log_id;
  PERFORM set_config('request.jwt.claim.role', '', true);
  -- 호출자 바인딩: 직원 본인(p_staff_id=v_staff_id) 으로 jwt sub 세팅
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.process_qr_checkin_atomically(
    v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL
  );
  IF (v_result->>'success')::bool OR v_result->>'error' != 'already_settled' THEN
    RAISE EXCEPTION 'S3 fail: %', v_result;
  END IF;

  -- ----------------------------------------------------------
  -- S7~S10: 출근 상태 화이트리스트 (RPC-1, W1-8)
  -- 과거 가드는 IN ('checked_in','checked_out') 블랙리스트라 no_show/cancelled/completed 가
  -- 전부 통과했다. 노쇼는 check_in_ts 를 안 남기므로 직접 호출로 checked_in 을 만든 뒤에는
  -- 정상 인앱 스캔만으로 퇴근까지 완료돼 없던 유급 근무가 생겼다.
  -- ----------------------------------------------------------
  -- 앞선 케이스(S3)가 payroll_status='completed' 를 남겨 already_settled 가드가 먼저 걸린다.
  -- payroll_* 컬럼은 protect_work_log_payroll_columns 가 staff 컨텍스트 쓰기를 막으므로
  -- 구인자 컨텍스트에서 한 번만 초기화한다.
  -- protect_work_log_payroll_columns 는 app_metadata.role 로 employer 를 판정한다 —
  -- 최상위 role 만 넣으면 통과하지 못한다.
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_owner_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'employer'))::text, true);
  UPDATE public.work_logs SET payroll_status = 'pending' WHERE id = v_work_log_id;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);

  -- S7: cancelled → 거부 (구분된 코드)
  UPDATE public.work_logs SET status = 'cancelled', check_in_ts = NULL, check_out_ts = NULL WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'work_log_cancelled' THEN
    RAISE EXCEPTION 'S7 fail (cancelled 가 출근 통과): %', v_result;
  END IF;

  -- S8: completed → 거부 (구분된 코드)
  UPDATE public.work_logs SET status = 'completed', check_in_ts = now(), check_out_ts = now() WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'work_log_completed' THEN
    RAISE EXCEPTION 'S8 fail (completed 가 출근 통과): %', v_result;
  END IF;

  -- S9: no_show → **구제 허용**(제품 결정). 되돌린 사실이 이력에 남아야 한다.
  UPDATE public.work_logs SET status = 'no_show', check_in_ts = NULL, check_out_ts = NULL,
    modification_history = '[]'::jsonb WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL);
  IF NOT (v_result->>'success')::bool THEN RAISE EXCEPTION 'S9 fail (노쇼 구제 거부됨): %', v_result; END IF;
  IF NOT (v_result->>'no_show_recovered')::bool THEN RAISE EXCEPTION 'S9 flag: %', v_result; END IF;
  IF (SELECT status::text FROM public.work_logs WHERE id = v_work_log_id) != 'checked_in' THEN
    RAISE EXCEPTION 'S9 side: status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.work_logs w, jsonb_array_elements(w.modification_history) e
    WHERE w.id = v_work_log_id AND e->>'type' = 'no_show_recovered_by_qr'
  ) THEN
    RAISE EXCEPTION 'S9 audit: 노쇼 구제 이력이 남지 않았다';
  END IF;

  -- S10: 일반 scheduled 출근은 이력을 남기지 않는다(구제 이력 오염 방지)
  UPDATE public.work_logs SET status = 'scheduled', check_in_ts = NULL, check_out_ts = NULL,
    modification_history = '[]'::jsonb WHERE id = v_work_log_id;
  v_result := public.process_qr_checkin_atomically(v_work_log_id, v_staff_id, v_job_id, 'checkIn', now(), NULL);
  IF NOT (v_result->>'success')::bool THEN RAISE EXCEPTION 'S10 fail: %', v_result; END IF;
  IF (v_result->>'no_show_recovered')::bool THEN RAISE EXCEPTION 'S10 flag: %', v_result; END IF;
  IF jsonb_array_length((SELECT w.modification_history FROM public.work_logs w WHERE w.id = v_work_log_id)) != 0 THEN
    RAISE EXCEPTION 'S10 audit: 일반 출근이 이력을 남겼다';
  END IF;


  -- Cleanup (역순)
  DELETE FROM public.work_logs WHERE id = v_work_log_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  -- owner 기준으로 workspace 삭제 — handle_new_user(employer 기본 워크스페이스
  -- 자동생성, 20260519223300) 트리거가 활성인 스택에서는 test-ws 외에 auto-ws 도
  -- 생기므로, auth.users 삭제 전 owner 소유 전체를 정리한다(workspaces_owner_id_fkey
  -- ON DELETE RESTRICT). CI(auth 트리거 미작동)에서는 test-ws 만 대상 = 무해.
  DELETE FROM public.workspaces WHERE owner_id = v_owner_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_staff_id);
END $$;

SELECT pass('QR_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
