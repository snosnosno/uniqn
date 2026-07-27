-- ============================================================
-- 근무표 — QR 체크인 트리밍 회귀 (S5/R4)
-- ============================================================
-- 검증:
--   1. 컨테이너 공고(status='container') QR checkIn 허용(기존엔 active 만 허용→거부)
--   2. auto 분기: scheduled→auto→checkIn 도출
--   3. auto 분기: checked_in→auto→checkOut 도출
--   4. 원본보존: 기존 clocked_out_raw(비NULL) 는 checkOut 시 불변(덮어쓰기 금지)
--   5. checkOut 시 end_time_source='qr'
--   6. 무회귀: clocked_out_raw NULL→checkOut 시 세팅됨(원본보존 분기)
--   7. 무회귀: 일반 active 공고 checkIn 여전히 허용
--   8. 음성단언: closed 공고 work_log QR → error='job_posting_inactive'
--      (컨테이너/active 만 허용; 가드 완화가 닫힌 공고까지 열지 않음 확인)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_qrc_*@test.local)
-- 호출자 바인딩(#195): SECDEF 함수의 auth.uid() = jwt sub 세팅(직원 본인 셀프스캔)
-- ============================================================

BEGIN;
SELECT plan(10);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_container uuid;
  v_normal uuid := gen_random_uuid();
  v_closed uuid := gen_random_uuid();
  v_wl_closed uuid := gen_random_uuid();
  v_d text := to_char(now(), 'YYYY-MM-DD');
  v_add jsonb;
  v_wl_container uuid;
  v_wl_normal uuid := gen_random_uuid();
  v_wl_auto uuid := gen_random_uuid();
  v_wl_raw uuid := gen_random_uuid();
  v_result jsonb;
  v_fixed_raw timestamptz := '2026-01-01 00:00:00+00';
  v_checkin timestamptz := now() - interval '2 hours';
BEGIN
  -- seed: owner(employer) + staff + workspace
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_qrc_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"QRC_OWNER"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_qrc_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"QRC_STAFF"}'::jsonb, now(), now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_qrc_owner@test.local', 'QRC_OWNER', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_qrc_staff@test.local', 'QRC_STAFF', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_qrc_ws', v_owner, now(), now());

  -- owner 컨텍스트: 컨테이너 생성 + 컨테이너에 스태프 직접배치(work_log)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_container := (public.get_or_create_venue_container(v_ws, 'QRC운영처', 'dated') ->> 'containerId')::uuid;
  v_add := public.add_direct_staff(
    v_container, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl_container := (v_add->'workLogIds'->>0)::uuid;

  -- 일반 active 공고 + work_log 3종(직접 INSERT)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_normal, v_owner, v_ws, '__sql_fixture_qrc_normal', 'active'::posting_status, 'regular'::posting_type, 5, 1, now(), now());

  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, date, status, role, is_fixed_posting, payroll_status, created_at, updated_at)
  VALUES
    (v_wl_normal, NULL, v_staff, v_normal, v_d, 'scheduled', 'staff', false, 'pending', now(), now()),
    (v_wl_auto,   NULL, v_staff, v_normal, v_d, 'scheduled', 'staff', false, 'pending', now(), now());

  -- 원본보존 검증용: 이미 clocked_out_raw 가 세팅된 checked_in work_log
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, date, status, role, is_fixed_posting, payroll_status, check_in_ts, clocked_out_raw, end_time_source, created_at, updated_at)
  VALUES (v_wl_raw, NULL, v_staff, v_normal, v_d, 'checked_in', 'staff', false, 'pending', v_checkin, v_fixed_raw, 'manual', now(), now());

  -- (8) 음성단언용: closed 공고 + 그 위의 scheduled work_log (가드 완화가 닫힌 공고는 열지 않아야 함)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_closed, v_owner, v_ws, '__sql_fixture_qrc_closed', 'closed'::posting_status, 'regular'::posting_type, 5, 1, now(), now());
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, date, status, role, is_fixed_posting, payroll_status, created_at, updated_at)
  VALUES (v_wl_closed, NULL, v_staff, v_closed, v_d, 'scheduled', 'staff', false, 'pending', now(), now());

  -- staff 컨텍스트(직원 본인 셀프스캔)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  -- (1) 컨테이너 공고 QR checkIn 허용
  v_result := public.process_qr_checkin_atomically(v_wl_container, v_staff, v_container, 'checkIn', now(), v_d);
  INSERT INTO _t VALUES
    ('container_ok', (v_result->>'success')),
    ('container_status', (SELECT status::text FROM public.work_logs WHERE id = v_wl_container));

  -- (2) auto: scheduled → checkIn
  v_result := public.process_qr_checkin_atomically(v_wl_auto, v_staff, v_normal, 'auto', now(), v_d);
  INSERT INTO _t VALUES
    ('auto_in_action', (v_result->>'action')),
    ('auto_in_status', (SELECT status::text FROM public.work_logs WHERE id = v_wl_auto));

  -- (3) auto: checked_in → checkOut
  v_result := public.process_qr_checkin_atomically(v_wl_auto, v_staff, v_normal, 'auto', now(), v_d);
  INSERT INTO _t VALUES
    ('auto_out_action', (v_result->>'action')),
    ('auto_out_status', (SELECT status::text FROM public.work_logs WHERE id = v_wl_auto));

  -- (4/5) 원본보존 + end_time_source
  v_result := public.process_qr_checkin_atomically(v_wl_raw, v_staff, v_normal, 'checkOut', now(), v_d);
  INSERT INTO _t
    SELECT 'raw_preserved', (clocked_out_raw = v_fixed_raw)::text FROM public.work_logs WHERE id = v_wl_raw;
  INSERT INTO _t
    SELECT 'raw_end_source', end_time_source FROM public.work_logs WHERE id = v_wl_raw;

  -- (6) NULL clocked_out_raw → checkOut 시 세팅(무회귀)
  v_result := public.process_qr_checkin_atomically(v_wl_normal, v_staff, v_normal, 'checkIn', v_checkin, v_d);
  v_result := public.process_qr_checkin_atomically(v_wl_normal, v_staff, v_normal, 'checkOut', now(), v_d);
  INSERT INTO _t
    SELECT 'null_raw_set', (clocked_out_raw IS NOT NULL)::text FROM public.work_logs WHERE id = v_wl_normal;

  -- (8) 음성단언: closed 공고 QR → job_posting_inactive (컨테이너/active 만 허용)
  v_result := public.process_qr_checkin_atomically(v_wl_closed, v_staff, v_closed, 'checkIn', now(), v_d);
  INSERT INTO _t VALUES ('closed_error', (v_result->>'error'));
END $$;

SELECT is((SELECT v FROM _t WHERE k = 'container_ok'), 'true',
  '컨테이너 공고(status=container) QR checkIn 허용');
SELECT is((SELECT v FROM _t WHERE k = 'container_status'), 'checked_in',
  '컨테이너 work_log status=checked_in');
SELECT is((SELECT v FROM _t WHERE k = 'auto_in_action'), 'checkIn',
  'auto 분기: scheduled→checkIn 도출');
SELECT is((SELECT v FROM _t WHERE k = 'auto_in_status'), 'checked_in',
  'auto checkIn 후 status=checked_in');
SELECT is((SELECT v FROM _t WHERE k = 'auto_out_action'), 'checkOut',
  'auto 분기: checked_in→checkOut 도출');
SELECT is((SELECT v FROM _t WHERE k = 'auto_out_status'), 'checked_out',
  'auto checkOut 후 status=checked_out');
SELECT is((SELECT v FROM _t WHERE k = 'raw_preserved'), 'true',
  'checkOut 시 기존 clocked_out_raw 원본 불변(덮어쓰기 금지)');
SELECT is((SELECT v FROM _t WHERE k = 'raw_end_source'), 'qr',
  'checkOut 시 end_time_source=qr');
SELECT is((SELECT v FROM _t WHERE k = 'null_raw_set'), 'true',
  'clocked_out_raw NULL→checkOut 시 세팅(원본보존 분기 무회귀)');
SELECT is((SELECT v FROM _t WHERE k = 'closed_error'), 'job_posting_inactive',
  '음성단언: closed 공고 QR 거부(컨테이너/active 만 허용, 가드 완화 비누수)');

SELECT * FROM finish();
ROLLBACK;
