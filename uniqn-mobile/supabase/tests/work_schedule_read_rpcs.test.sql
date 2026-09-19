-- ============================================================
-- 근무표 — Phase 2 읽기 RPC (get_venue_grid_summary / get_venue_day_slots)
-- ============================================================
-- 검증:
--   1. 월 요약 D1: headcount=3(컨테이너2+open1), job_count=1 (cancelled 제외)
--   2. 월 요약 D2: headcount=1, job_count=0
--   3. 하루 슬롯 D1: 3행(컨테이너2+open1, cancelled 제외)
--   4. 권한 게이트: 비멤버는 PERMISSION_DENIED
--   5~8. 하루 슬롯이 실적(출퇴근)·정산상태·날짜를 실어 온다 (20260806130000)
--   9. ACL 회귀 가드: PUBLIC/anon EXECUTE 0
-- 안전: BEGIN/ROLLBACK + 마커 이메일
-- ============================================================
BEGIN;
SELECT plan(9);

CREATE TEMP TABLE _wr (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_c uuid; v_open uuid := gen_random_uuid();
  v_d1 text := '2026-07-01'; v_d2 text := '2026-07-02';
  -- D3 은 실적 확인 전용 날짜다 — 월 요약 범위(D1~D2) 밖이라 기존 단언 1~3 을 건드리지 않는다.
  v_d3 text := '2026-07-03';
  v_hc1 int; v_jc1 int; v_hc2 int; v_jc2 int; v_slots1 int;
  v_ci timestamptz; v_co timestamptz; v_ps text; v_dt text;
  v_denied boolean := false;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 아래 public.users upsert role 과 일치시킴
  -- (on_auth_user_created 트리거 선점 행의 role 이 다르면 prevent_role_escalation 트리거가
  -- ON CONFLICT DO UPDATE 의 role 변경을 ROLE_CHANGE_DENIED 로 거부한다).
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_wr_owner@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_staff,'__sql_fixture_wr_staff@test.local','authenticated','authenticated','','{"role":"staff"}'::jsonb,now(),now()),
    (v_stranger,'__sql_fixture_wr_stranger@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_wr_owner@test.local','WR_OWNER','employer',true,now(),now()),
    (v_staff,'__sql_fixture_wr_staff@test.local','WR_STAFF','staff',true,now(),now()),
    (v_stranger,'__sql_fixture_wr_stranger@test.local','WR_STRANGER','employer',true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at) VALUES (v_ws,'__sql_fixture_wr_ws',v_owner,now(),now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_c := (public.get_or_create_venue_container(v_ws, '운영처WR', 'dated') ->> 'containerId')::uuid;

  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,total_positions,created_at,updated_at)
  VALUES (v_open, v_owner, v_ws, '__sql_fixture_wr_open', 'active'::posting_status, 'regular'::posting_type, v_c, 1, now(), now());

  INSERT INTO public.work_logs (staff_id,job_posting_id,date,status,role) VALUES
    (v_staff, v_c,    v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d1, 'scheduled'::work_log_status, 'floor'::staff_role),
    (v_staff, v_open, v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d1, 'cancelled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d2, 'scheduled'::work_log_status, 'dealer'::staff_role);

  -- D3: 출근만 찍고 퇴근은 안 찍은 행 + 정산완료. payroll_status 를 기본값('pending')이 아닌
  -- 'completed' 로 두어 "실제로 읽어 왔는지"와 "기본값이 우연히 맞은 건지"를 구분한다.
  INSERT INTO public.work_logs (staff_id,job_posting_id,date,status,role,check_in_ts,payroll_status) VALUES
    (v_staff, v_c, v_d3, 'checked_in'::work_log_status, 'dealer'::staff_role,
     timestamptz '2026-07-03 09:00:00+00', 'completed'::payroll_status);

  SELECT headcount, job_count INTO v_hc1, v_jc1 FROM public.get_venue_grid_summary(v_c, v_d1, v_d2) WHERE d = v_d1;
  SELECT headcount, job_count INTO v_hc2, v_jc2 FROM public.get_venue_grid_summary(v_c, v_d1, v_d2) WHERE d = v_d2;
  SELECT count(*) INTO v_slots1 FROM public.get_venue_day_slots(v_c, v_d1);
  INSERT INTO _wr VALUES ('d1', v_hc1||'/'||v_jc1), ('d2', v_hc2||'/'||v_jc2), ('slots1', v_slots1::text);

  -- 실적 4열(20260806130000): 근무표가 컨테이너 직속 여부와 무관하게 시간 편집 시트를 열려면
  -- 이 값들이 읽기 RPC 에 실려 와야 한다. 없으면 여기서 컬럼 미존재로 red 가 된다.
  SELECT s.check_in_ts, s.check_out_ts, s.payroll_status, s.date
    INTO v_ci, v_co, v_ps, v_dt
    FROM public.get_venue_day_slots(v_c, v_d3) s;
  INSERT INTO _wr VALUES
    ('ci', COALESCE((v_ci = timestamptz '2026-07-03 09:00:00+00')::text, '∅')),
    ('co', COALESCE(v_co::text, '∅')),
    ('ps', COALESCE(v_ps, '∅')),
    ('dt', COALESCE(v_dt, '∅'));

  -- 권한 게이트: 비멤버(stranger)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.get_venue_grid_summary(v_c, v_d1, v_d2);
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  INSERT INTO _wr VALUES ('denied', v_denied::text);
END $$;

SELECT is((SELECT v FROM _wr WHERE k='d1'), '3/1', '월 요약 D1: headcount=3, job_count=1 (cancelled 제외)');
SELECT is((SELECT v FROM _wr WHERE k='d2'), '1/0', '월 요약 D2: headcount=1, job_count=0');
SELECT is((SELECT v FROM _wr WHERE k='slots1'), '3', '하루 슬롯 D1: 3행(컨테이너2+open1)');
SELECT is((SELECT v FROM _wr WHERE k='denied'), 'true', '권한 게이트: 비멤버는 거부');

-- ── 실적·정산상태·날짜 (20260806130000) ──────────────────────
SELECT is((SELECT v FROM _wr WHERE k='ci'), 'true', '하루 슬롯: check_in_ts 를 그대로 실어 온다');
SELECT is((SELECT v FROM _wr WHERE k='co'), '∅', '하루 슬롯: 미기록 check_out_ts 는 null 로 온다(0시로 뭉개지 않는다)');
SELECT is((SELECT v FROM _wr WHERE k='ps'), 'completed', '하루 슬롯: payroll_status 를 text 로 실어 온다(기본값 pending 아님)');
SELECT is((SELECT v FROM _wr WHERE k='dt'), '2026-07-03', '하루 슬롯: 기준 날짜(YYYY-MM-DD)를 실어 온다');

-- ── ACL 회귀 가드 ────────────────────────────────────────────
-- 🔴 이 함수는 반환 타입 변경 때문에 DROP + CREATE 로만 갱신할 수 있고, DROP 은 PostgreSQL
--    기본값인 PUBLIC EXECUTE 를 되살린다. 회수(REVOKE)를 빠뜨리면 anon 이 SECDEF 를 호출한다.
--    (proacl IS NULL = 기본 ACL = PUBLIC 에게 EXECUTE 가 있는 상태이므로 그것도 실패로 센다.)
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'get_venue_day_slots'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.proacl, '{}'::aclitem[])) a
                     WHERE a::text ~ '^(=|anon=)'))),
  0,
  'get_venue_day_slots 에 PUBLIC/anon EXECUTE 가 없다 (DROP+CREATE 후 기본 PUBLIC 회수 회귀 가드)');

SELECT * FROM finish();
ROLLBACK;
