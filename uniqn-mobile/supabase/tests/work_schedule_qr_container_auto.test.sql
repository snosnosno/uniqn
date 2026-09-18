-- ============================================================
-- 근무표 — QR 체크인 트리밍 회귀 (S5/R4)
-- ============================================================
-- 검증:
--   1. 컨테이너 공고(status='container') QR checkIn 허용(기존엔 active 만 허용→거부)
--   2. auto 분기: scheduled→auto→checkIn 도출
--   3. auto 분기: checked_in→auto→checkOut 도출
--   4. checkOut 이 원본 스캔시각 정본(check_out_scanned_at)을 기록
--   5. checkOut 시 end_time_source='qr'
--   6. 무회귀: check_out_scanned_at NULL→checkOut 시 세팅됨
--
-- ⚠️ 2026-09-18 갱신 — 마이그 20260909135618 이 두 가지 계약을 바꿨고, 이 파일은
--   구 계약을 가정한 채 남아 red 였다(DB Tests 4건). 반영 내용:
--     (1) `p_check_time` 은 **무시된다**. 함수는 `clock_timestamp()` 만 신뢰하고 적용
--         시각을 15분 단위로 **올림**한다(디바이스 시계 조작 차단 — 계약 정본은
--         supabase/tests/qr_checkin_time_clamp.test.sql). 따라서 "2시간 전 출근"을
--         인자로 주입할 수 없다 → check_in_ts 를 **직접 UPDATE 로 시드**한다.
--         (올림 때문에 출근 직후 재스캔은 v_applied_time <= check_in_ts 가 되어
--          checkout_too_early 로 막힌다 — 0분 근무 기록 방지. 이건 결함이 아니라
--          의도된 가드이므로, auto 분기 도출을 검증하려면 출근을 과거로 세워야 한다.)
--     (2) `clocked_out_raw` 는 **Deprecated** 다. 원본 퇴근시각 정본은
--         `check_out_scanned_at` 으로 이관됐다(같은 마이그의 COMMENT + 백필).
--         읽는 주체도 0 이다 — 클라 SELECT 목록(src/repositories/supabase/
--         workLogColumns.ts:12)에서 제외됐고, 이 컬럼을 참조하는 DB 함수는
--         process_qr_checkin_atomically(쓰기 전용) 하나뿐이다(2026-09-18 실측).
--         그래서 원본보존 단언을 정본 컬럼 기준으로 옮긴다.
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
  -- 15분 올림 때문에 (2)의 check_in_ts 는 최대 15분 미래다. auto **분기 도출**을
  -- 검증하는 것이 목적이므로 출근을 2시간 전으로 시드해 duration 가드를 피한다.
  UPDATE public.work_logs SET check_in_ts = v_checkin WHERE id = v_wl_auto;
  v_result := public.process_qr_checkin_atomically(v_wl_auto, v_staff, v_normal, 'auto', now(), v_d);
  INSERT INTO _t VALUES
    ('auto_out_action', (v_result->>'action')),
    ('auto_out_status', (SELECT status::text FROM public.work_logs WHERE id = v_wl_auto));

  -- (4/5) 원본보존 + end_time_source
  v_result := public.process_qr_checkin_atomically(v_wl_raw, v_staff, v_normal, 'checkOut', now(), v_d);
  -- 정본(check_out_scanned_at)에 이번 스캔의 서버 원본 시각이 기록돼야 한다.
  -- (deprecated clocked_out_raw 의 "첫 값 보존" 계약은 위 헤더 (2) 참조)
  INSERT INTO _t
    SELECT 'raw_scanned_set',
      (check_out_scanned_at IS NOT NULL AND check_out_scanned_at > v_fixed_raw)::text
    FROM public.work_logs WHERE id = v_wl_raw;
  INSERT INTO _t
    SELECT 'raw_end_source', end_time_source FROM public.work_logs WHERE id = v_wl_raw;

  -- (6) NULL clocked_out_raw → checkOut 시 세팅(무회귀)
  v_result := public.process_qr_checkin_atomically(v_wl_normal, v_staff, v_normal, 'checkIn', v_checkin, v_d);
  -- p_check_time 은 무시되므로(헤더 (1)) 출근을 과거로 직접 시드해야 퇴근이 성립한다.
  UPDATE public.work_logs SET check_in_ts = v_checkin WHERE id = v_wl_normal;
  v_result := public.process_qr_checkin_atomically(v_wl_normal, v_staff, v_normal, 'checkOut', now(), v_d);
  INSERT INTO _t
    SELECT 'null_scanned_set', (check_out_scanned_at IS NOT NULL)::text
    FROM public.work_logs WHERE id = v_wl_normal;

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
SELECT is((SELECT v FROM _t WHERE k = 'raw_scanned_set'), 'true',
  'checkOut 시 원본 스캔시각 정본(check_out_scanned_at) 기록');
SELECT is((SELECT v FROM _t WHERE k = 'raw_end_source'), 'qr',
  'checkOut 시 end_time_source=qr');
SELECT is((SELECT v FROM _t WHERE k = 'null_scanned_set'), 'true',
  'check_out_scanned_at NULL→checkOut 시 세팅(무회귀)');
SELECT is((SELECT v FROM _t WHERE k = 'closed_error'), 'job_posting_inactive',
  '음성단언: closed 공고 QR 거부(컨테이너/active 만 허용, 가드 완화 비누수)');

SELECT * FROM finish();
ROLLBACK;
