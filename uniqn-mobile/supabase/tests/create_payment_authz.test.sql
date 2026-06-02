-- ============================================================
-- Fix-1b: create_job_posting_with_payment_atomically 호출자 인가 가드
-- (20260602000001_create_payment_authz_guard)
-- auth.uid()/get_my_role() 를 request.jwt.claims 로 시뮬레이션해 가드 동작 검증.
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(6);

-- 공통 픽스처: owner(+workspace), attacker, admin
DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_ws       uuid := gen_random_uuid();
  v_attacker uuid := gen_random_uuid();
  v_admin    uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
    (v_owner,    '__sql_fixture_authz_owner@test.local',    'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"O"}'::jsonb, now(), now()),
    (v_attacker, '__sql_fixture_authz_attacker@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"A"}'::jsonb, now(), now()),
    (v_admin,    '__sql_fixture_authz_admin@test.local',    'authenticated','authenticated','', '{"role":"admin"}'::jsonb,    '{"name":"AD"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at) VALUES
    (v_owner,    '__sql_fixture_authz_owner@test.local',    'fixture','employer', true, now(), now()),
    (v_attacker, '__sql_fixture_authz_attacker@test.local', 'fixture','employer', true, now(), now()),
    (v_admin,    '__sql_fixture_authz_admin@test.local',    'fixture','admin',    true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_authz_ws', v_owner, now(), now());

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.ws', v_ws::text, false);
  PERFORM set_config('test.attacker', v_attacker::text, false);
  PERFORM set_config('test.admin', v_admin::text, false);
END $$;

-- (1)(2) owner 본인 생성 — 성공
DO $$
DECLARE
  v_owner uuid := current_setting('test.owner')::uuid;
  v_pid   uuid := gen_random_uuid();
  v_res   jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_owner::text, 'app_metadata', jsonb_build_object('role','employer'))::text, true);
  v_res := public.create_job_posting_with_payment_atomically(
    v_owner,
    jsonb_build_object('id', v_pid, 'workspace_id', current_setting('test.ws')::uuid,
                       'title', '__authz self', 'posting_type', 'regular', 'status', 'active'),
    'consume_job_posting'::wallet_reason);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('test.self_pid', v_pid::text, false);
  PERFORM set_config('test.self_res', v_res::text, false);
END $$;
SELECT is((current_setting('test.self_res')::jsonb)->>'success', 'true', 'owner self-create succeeds');
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.self_pid')::uuid), 1,
  'owner self-create inserts posting');

-- (3)(4) attacker(caller<>owner) 가 owner 비용으로 생성 시도 — 차단
DO $$
DECLARE
  v_owner    uuid := current_setting('test.owner')::uuid;
  v_attacker uuid := current_setting('test.attacker')::uuid;
  v_pid      uuid := gen_random_uuid();
  v_blocked  boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_attacker::text, 'app_metadata', jsonb_build_object('role','employer'))::text, true);
  BEGIN
    PERFORM public.create_job_posting_with_payment_atomically(
      v_owner,
      jsonb_build_object('id', v_pid, 'workspace_id', current_setting('test.ws')::uuid,
                         'title', '__authz forge', 'posting_type', 'regular', 'status', 'active'),
      'consume_job_posting'::wallet_reason);
  EXCEPTION WHEN OTHERS THEN
    v_blocked := (SQLERRM LIKE '%PERMISSION_DENIED%');
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('test.forge_blocked', v_blocked::text, false);
  PERFORM set_config('test.forge_pid', v_pid::text, false);
END $$;
SELECT is(current_setting('test.forge_blocked'), 'true', 'attacker (caller<>owner) blocked with PERMISSION_DENIED');
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.forge_pid')::uuid), 0,
  'attacker forge created no posting');

-- (5) staff 역할 — 차단
DO $$
DECLARE
  v_owner uuid := current_setting('test.owner')::uuid;
  v_pid   uuid := gen_random_uuid();
  v_blocked boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_owner::text, 'app_metadata', jsonb_build_object('role','staff'))::text, true);
  BEGIN
    PERFORM public.create_job_posting_with_payment_atomically(
      v_owner,
      jsonb_build_object('id', v_pid, 'workspace_id', current_setting('test.ws')::uuid,
                         'title', '__authz staff', 'posting_type', 'regular', 'status', 'active'),
      'consume_job_posting'::wallet_reason);
  EXCEPTION WHEN OTHERS THEN
    v_blocked := (SQLERRM LIKE '%PERMISSION_DENIED%');
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('test.staff_blocked', v_blocked::text, false);
END $$;
SELECT is(current_setting('test.staff_blocked'), 'true', 'staff role blocked from creating posting');

-- (6) admin 대리 생성 (caller<>owner, role=admin) — 허용 (jp_insert RLS 동치)
DO $$
DECLARE
  v_owner uuid := current_setting('test.owner')::uuid;
  v_admin uuid := current_setting('test.admin')::uuid;
  v_pid   uuid := gen_random_uuid();
  v_res   jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_admin::text, 'app_metadata', jsonb_build_object('role','admin'))::text, true);
  v_res := public.create_job_posting_with_payment_atomically(
    v_owner,
    jsonb_build_object('id', v_pid, 'workspace_id', current_setting('test.ws')::uuid,
                       'title', '__authz admin proxy', 'posting_type', 'regular', 'status', 'active'),
    'consume_job_posting'::wallet_reason);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('test.admin_pid', v_pid::text, false);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.admin_pid')::uuid), 1,
  'admin proxy-create allowed (RLS parity)');

SELECT * FROM finish();
ROLLBACK;
