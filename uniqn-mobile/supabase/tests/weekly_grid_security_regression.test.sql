-- ============================================================
-- 주간 배치 그리드 — 보안 회귀(M1/M3 전체리뷰 적출 보강)
-- ============================================================
-- 검증:
--   A. anon EXECUTE 차단(S2) — 그리드 8 RPC 전부 has_function_privilege('anon',...,'EXECUTE')=false
--      (get_or_create_venue_container / venue_span_posting_ids / get_venue_grid_summary /
--       get_venue_day_slots / set_venue_soft_target / search_users_by_phone /
--       add_direct_staff / remove_direct_staff)
--   B. SECDEF search_path 하드닝 — pg_temp 사용 7 RPC 의 proconfig 가 'public' 우선 + 'pg_temp' 후행
--      (pg_temp 마스킹 차단; search_users_by_phone 은 설계상 'public' 단독이라 대상 제외)
--   C. venue_span_posting_ids INVOKER fail-closed —
--      C1(non-vacuous control): postgres(RLS 우회)는 컨테이너 스팬 >= 1 (데이터 실재)
--      C2(fail-closed): 외부인(타 워크스페이스 authenticated)은 RLS 로 0행
--   D. M1 유령행 차단(전체리뷰 핵심) — 타 워크스페이스 공고가 venue_id=피해자컨테이너로
--      박은 work_log 는 읽기 RPC 집계/슬롯에서 제외(workspace 재필터):
--      D1: get_venue_grid_summary headcount=1(합법행만, 유령 제외)
--      D2: get_venue_day_slots 행수=1(합법행만, 유령 제외)
--      ↳ M1 미적용(구 본문)이면 둘 다 2 가 되어 red(테스트가 결함을 잡음).
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_sec_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(19);

-- ── A. anon EXECUTE 차단(8) ─────────────────────────────────────────────
SELECT ok(NOT has_function_privilege('anon',
  'public.get_or_create_venue_container(uuid, text, text, jsonb)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): get_or_create_venue_container');
SELECT ok(NOT has_function_privilege('anon',
  'public.venue_span_posting_ids(uuid)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): venue_span_posting_ids');
SELECT ok(NOT has_function_privilege('anon',
  'public.get_venue_grid_summary(uuid, text, text)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): get_venue_grid_summary');
SELECT ok(NOT has_function_privilege('anon',
  'public.get_venue_day_slots(uuid, text)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): get_venue_day_slots');
SELECT ok(NOT has_function_privilege('anon',
  'public.set_venue_soft_target(uuid, text, integer)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): set_venue_soft_target');
SELECT ok(NOT has_function_privilege('anon',
  'public.search_users_by_phone(text)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): search_users_by_phone');
SELECT ok(NOT has_function_privilege('anon',
  'public.add_direct_staff(uuid, uuid, jsonb)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): add_direct_staff');
SELECT ok(NOT has_function_privilege('anon',
  'public.remove_direct_staff(uuid)'::regprocedure, 'EXECUTE'),
  'anon EXECUTE 차단(S2): remove_direct_staff');

-- ── B. proconfig: 'public' 우선 + 'pg_temp' 후행(마스킹 차단) (7) ────────
-- 추출한 search_path 설정이 `search_path=public` 으로 시작(public 우선)하고
-- 끝이 `pg_temp` (후행)인지 검증 — pg_temp 를 앞에 두는 마스킹 회귀를 차단한다.
CREATE TEMP TABLE _spcfg AS
  SELECT p.proname,
         (SELECT cfg FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%' LIMIT 1) AS sp
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_venue_grid_summary','get_venue_day_slots','venue_span_posting_ids',
                      'get_or_create_venue_container','set_venue_soft_target',
                      'add_direct_staff','remove_direct_staff');

SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='get_venue_grid_summary'),
  'search_path public 우선 + pg_temp 후행: get_venue_grid_summary');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='get_venue_day_slots'),
  'search_path public 우선 + pg_temp 후행: get_venue_day_slots');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='venue_span_posting_ids'),
  'search_path public 우선 + pg_temp 후행: venue_span_posting_ids');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='get_or_create_venue_container'),
  'search_path public 우선 + pg_temp 후행: get_or_create_venue_container');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='set_venue_soft_target'),
  'search_path public 우선 + pg_temp 후행: set_venue_soft_target');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='add_direct_staff'),
  'search_path public 우선 + pg_temp 후행: add_direct_staff');
SELECT ok((SELECT sp ~ '^search_path=public' AND sp ~ '[, ]pg_temp$' FROM _spcfg WHERE proname='remove_direct_staff'),
  'search_path public 우선 + pg_temp 후행: remove_direct_staff');

-- ── C. venue_span_posting_ids INVOKER fail-closed (2) ───────────────────
CREATE TEMP TABLE _sec (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws       uuid := gen_random_uuid();
  v_c        uuid;
  v_super_cnt    int;
  v_stranger_cnt int;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 아래 public.users upsert role 과 일치시킴
  -- (on_auth_user_created 트리거 선점 행의 role 이 다르면 prevent_role_escalation 트리거가
  -- ON CONFLICT DO UPDATE 의 role 변경을 ROLE_CHANGE_DENIED 로 거부한다).
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner,   '__sql_fixture_sec_owner@test.local',   'authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_stranger,'__sql_fixture_sec_stranger@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner,   '__sql_fixture_sec_owner@test.local',   'SEC_OWNER',   'employer',true,now(),now()),
    (v_stranger,'__sql_fixture_sec_stranger@test.local','SEC_STRANGER','employer',true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at)
    VALUES (v_ws,'__sql_fixture_sec_ws',v_owner,now(),now());

  -- 컨테이너만 생성(공개 가시 active 공고 없음 → 스팬 = 컨테이너 단독, RLS 로 외부인에게 비가시)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_c := (public.get_or_create_venue_container(v_ws, '운영처SEC', 'dated') ->> 'containerId')::uuid;

  -- C1 non-vacuous: postgres(RLS 우회)는 스팬 비어있지 않음(컨테이너 1)
  SELECT count(*) INTO v_super_cnt FROM public.venue_span_posting_ids(v_c);

  -- C2 fail-closed: 외부인(타 워크스페이스 authenticated) → RLS 적용 → 0행
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_stranger_cnt FROM public.venue_span_posting_ids(v_c);
  SET LOCAL ROLE postgres;

  INSERT INTO _sec VALUES ('span_super', v_super_cnt::text), ('span_stranger', v_stranger_cnt::text);
END $$;

SELECT ok((SELECT v::int FROM _sec WHERE k='span_super') >= 1,
  'C1 non-vacuous: venue_span_posting_ids 스팬 비어있지 않음(postgres RLS 우회)');
SELECT is((SELECT v FROM _sec WHERE k='span_stranger'), '0',
  'C2 fail-closed: 외부인(타 워크스페이스 authenticated)은 INVOKER+RLS 로 0행');

-- ── D. M1 유령행 차단 — 읽기 RPC workspace 재필터 (2) ───────────────────
DO $$
DECLARE
  v_owner_a uuid := gen_random_uuid();   -- 피해자 워크스페이스 소유자
  v_owner_b uuid := gen_random_uuid();   -- 공격자(타 워크스페이스 소유자)
  v_staff   uuid := gen_random_uuid();
  v_ws_a uuid := gen_random_uuid();
  v_ws_b uuid := gen_random_uuid();
  v_c_a uuid;                            -- 피해자 컨테이너
  v_p_b uuid := gen_random_uuid();       -- 공격자 공고(venue_id=피해자컨테이너 주입)
  v_d text := '2026-07-15';
  v_hc int;
  v_slots int;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 아래 public.users upsert role 과 일치시킴
  -- (on_auth_user_created 트리거 선점 행의 role 이 다르면 prevent_role_escalation 트리거가
  -- ON CONFLICT DO UPDATE 의 role 변경을 ROLE_CHANGE_DENIED 로 거부한다).
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner_a,'__sql_fixture_sec_owa@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_owner_b,'__sql_fixture_sec_owb@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_staff,  '__sql_fixture_sec_stf@test.local','authenticated','authenticated','','{"role":"staff"}'::jsonb,now(),now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner_a,'__sql_fixture_sec_owa@test.local','SEC_OWA','employer',true,now(),now()),
    (v_owner_b,'__sql_fixture_sec_owb@test.local','SEC_OWB','employer',true,now(),now()),
    (v_staff,  '__sql_fixture_sec_stf@test.local','SEC_STF','staff',   true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at) VALUES
    (v_ws_a,'__sql_fixture_sec_wsa',v_owner_a,now(),now()),
    (v_ws_b,'__sql_fixture_sec_wsb',v_owner_b,now(),now());

  -- 피해자 컨테이너(워크스페이스 A) 생성 + 합법 work_log(컨테이너 직접배치)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role','authenticated')::text, true);
  v_c_a := (public.get_or_create_venue_container(v_ws_a, '운영처A_M1', 'dated') ->> 'containerId')::uuid;
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role)
  VALUES (v_staff, v_c_a, v_d, 'scheduled'::work_log_status, 'dealer'::staff_role);

  -- 공격: 타 워크스페이스(B) 공고에 venue_id=피해자컨테이너 주입(FK 가 workspace 일치를 강제 안 함)
  --  + 그 공고에 유령 work_log. (직접 INSERT = postgres RLS 우회로 공격 상태 재현)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, venue_id, total_positions, created_at, updated_at)
  VALUES (v_p_b, v_owner_b, v_ws_b, '__sql_fixture_sec_ghost', 'active'::posting_status, 'regular'::posting_type, v_c_a, 1, now(), now());
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role)
  VALUES (v_staff, v_p_b, v_d, 'scheduled'::work_log_status, 'dealer'::staff_role);

  -- 피해자 owner A 로 읽기 RPC 호출 → 유령행 제외 검증
  SELECT headcount INTO v_hc FROM public.get_venue_grid_summary(v_c_a, v_d, v_d) WHERE d = v_d;
  SELECT count(*) INTO v_slots FROM public.get_venue_day_slots(v_c_a, v_d);

  INSERT INTO _sec VALUES ('m1_headcount', COALESCE(v_hc,0)::text), ('m1_slots', v_slots::text);
END $$;

SELECT is((SELECT v FROM _sec WHERE k='m1_headcount'), '1',
  'D1 M1: get_venue_grid_summary 가 타 워크스페이스 유령행 제외(headcount=1)');
SELECT is((SELECT v FROM _sec WHERE k='m1_slots'), '1',
  'D2 M1: get_venue_day_slots 가 타 워크스페이스 유령행 제외(행수=1)');

SELECT * FROM finish();
ROLLBACK;
