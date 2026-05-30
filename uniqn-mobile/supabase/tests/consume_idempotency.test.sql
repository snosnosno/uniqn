-- ============================================================
-- T3: consume_diamonds_atomically 멱등성
-- 같은 (user, ref_id, consume_job_posting) 2회 → 1회만 차감
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_ref  uuid := gen_random_uuid();
  v_r1   jsonb;
  v_r2   jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_ci_user@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"CI"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_ci_user@test.local', 'fixture', 'employer', true, now(), now());
  -- 다이아 10개 충전 (wallet 캐시 직접 세팅)
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_user, 10)
    ON CONFLICT (user_id) DO UPDATE SET diamond_balance = 10;

  v_r1 := public.consume_diamonds_atomically(v_user, 3, 'consume_job_posting'::wallet_reason, v_ref, 'job_posting');
  v_r2 := public.consume_diamonds_atomically(v_user, 3, 'consume_job_posting'::wallet_reason, v_ref, 'job_posting');

  PERFORM set_config('test.user', v_user::text, false);
  PERFORM set_config('test.ref', v_ref::text, false);
  PERFORM set_config('test.r1', v_r1::text, false);
  PERFORM set_config('test.r2', v_r2::text, false);
END $$;

SELECT is((current_setting('test.r1')::jsonb)->>'diamond_consumed', '3', 'first call consumes 3');
SELECT is((current_setting('test.r2')::jsonb)->>'idempotent', 'true', 'second call returns idempotent');
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.user')::uuid), 7,
  'balance debited once (10-3=7)');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger
   WHERE user_id = current_setting('test.user')::uuid
     AND ref_id = current_setting('test.ref')::uuid
     AND reason = 'consume_job_posting'), 1,
  'only one consume ledger row');

SELECT * FROM finish();
ROLLBACK;
