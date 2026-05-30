-- ============================================================
-- T2: create_job_posting_with_payment_atomically (서버 cost-calc + 멱등)
-- R1 회귀: flag off → cost=0 → consume 없이 INSERT만 (무료 게시 동등)
-- 멱등: 같은 posting_id 2회 → 1 공고, 차감 1회
-- round-trip: 삽입 행이 payload 필드 보존
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_pid   uuid := gen_random_uuid();
  v_payload jsonb;
  v_res   jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_cp_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"CP"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_cp_owner@test.local', 'fixture', 'employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_cp_ws', v_owner, now(), now());

  v_payload := jsonb_build_object(
    'id', v_pid,
    'workspace_id', v_ws,
    'title', '__sql_fixture: payment test',
    'posting_type', 'urgent',
    'status', 'active',
    'total_positions', 2
  );

  -- (A) flag off (시드 기본) → cost=0 → INSERT만, consume 0
  v_res := public.create_job_posting_with_payment_atomically(v_owner, v_payload, 'consume_job_posting'::wallet_reason);
  PERFORM set_config('test.res_a', v_res::text, false);
  PERFORM set_config('test.pid', v_pid::text, false);
END $$;

-- R1: flag off 무료 게시 동등 — 공고 INSERT 성공
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.pid')::uuid), 1,
  'R1: flag off — posting inserted');
SELECT is(
  (current_setting('test.res_a')::jsonb)->>'total_consumed', '0',
  'R1: flag off — nothing consumed');
-- round-trip: payload 필드 보존
SELECT is(
  (SELECT title FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  '__sql_fixture: payment test', 'round-trip: title preserved');
SELECT is(
  (SELECT posting_type::text FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  'urgent', 'round-trip: posting_type preserved');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  'active', 'round-trip: status (payload-wins over default draft)');
SELECT is(
  (SELECT total_positions FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  2, 'round-trip: total_positions preserved');

-- 멱등: 같은 posting_id 재호출 → 여전히 1 공고
DO $$
DECLARE
  v_owner uuid;
  v_ws uuid;
  v_payload jsonb;
BEGIN
  SELECT owner_id, workspace_id INTO v_owner, v_ws FROM public.job_postings WHERE id = current_setting('test.pid')::uuid;
  v_payload := jsonb_build_object(
    'id', current_setting('test.pid')::uuid,
    'workspace_id', v_ws,
    'title', '__sql_fixture: payment test',
    'posting_type', 'urgent',
    'status', 'active',
    'total_positions', 2
  );
  PERFORM public.create_job_posting_with_payment_atomically(v_owner, v_payload, 'consume_job_posting'::wallet_reason);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.pid')::uuid), 1,
  'idempotent: same posting_id → still 1 posting');

-- 신규 시그니처는 p_cost_diamonds 인자 없음 (구 4-인자 시그니처는 제거됨)
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_job_posting_with_payment_atomically'
     AND p.pronargs = 3), 1,
  'new signature has exactly 3 args (p_cost_diamonds removed)');

SELECT * FROM finish();
ROLLBACK;
