-- ============================================================
-- M1: consume_diamonds_atomically 가 소비한 heart_lot {expires_at, amount}를
--     heart ledger row metadata.heart_lots_consumed 에 FIFO 순서로 기록하는지 검증.
-- 시나리오: lot A(2, +30d) + lot B(3, +60d) + 다이아 10 → 8 소비
--           → 하트 5(A2+B3 FIFO) + 다이아 3 폴백.
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(5);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_ref  uuid := gen_random_uuid();
  v_r    jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_m1_user@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"M1"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_m1_user@test.local', 'fixture', 'employer', true, now(), now());

  -- 하트 lot 2종(만료 상이) + 다이아 10. wallet 캐시는 lot 합(5)과 일치시킴.
  INSERT INTO public.heart_lots(user_id, amount_initial, amount_remaining, expires_at, source)
  VALUES (v_user, 2, 2, now() + interval '30 days', 'grant_signup'),
         (v_user, 3, 3, now() + interval '60 days', 'grant_signup');
  INSERT INTO public.wallets(user_id, heart_balance, diamond_balance)
  VALUES (v_user, 5, 10)
    ON CONFLICT (user_id) DO UPDATE SET heart_balance = 5, diamond_balance = 10;

  v_r := public.consume_diamonds_atomically(v_user, 8, 'consume_job_posting'::wallet_reason, v_ref, 'job_posting');

  PERFORM set_config('test.user', v_user::text, false);
  PERFORM set_config('test.ref', v_ref::text, false);
  PERFORM set_config('test.r', v_r::text, false);
END $$;

SELECT is((current_setting('test.r')::jsonb)->>'heart_consumed', '5', '하트 5개 FIFO 소비');
SELECT is((current_setting('test.r')::jsonb)->>'diamond_consumed', '3', '다이아 3개 폴백 소비');

-- heart ledger row의 metadata.heart_lots_consumed 검증
SELECT is(
  (SELECT jsonb_array_length(metadata->'heart_lots_consumed')
   FROM public.wallet_ledger
   WHERE user_id = current_setting('test.user')::uuid
     AND ref_id = current_setting('test.ref')::uuid
     AND currency_type = 'heart'),
  2,
  'metadata.heart_lots_consumed 에 lot 2건 기록');

SELECT is(
  (SELECT SUM((elem->>'amount')::int)::int
   FROM public.wallet_ledger wl,
        jsonb_array_elements(wl.metadata->'heart_lots_consumed') elem
   WHERE wl.user_id = current_setting('test.user')::uuid
     AND wl.ref_id = current_setting('test.ref')::uuid
     AND wl.currency_type = 'heart'),
  5,
  'metadata lot amount 합 = 소비 하트 5');

-- FIFO: 첫 요소가 가장 빨리 만료되는 lot A(amount 2), expires_at 키 존재
SELECT ok(
  (SELECT (metadata->'heart_lots_consumed'->0->>'amount')::int = 2
      AND (metadata->'heart_lots_consumed'->0) ? 'expires_at'
   FROM public.wallet_ledger
   WHERE user_id = current_setting('test.user')::uuid
     AND ref_id = current_setting('test.ref')::uuid
     AND currency_type = 'heart'),
  'FIFO 첫 lot=amount 2 + expires_at 기록됨');

SELECT * FROM finish();
ROLLBACK;
