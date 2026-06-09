-- Q2 라운딩 정정: rate=0.5(24h 경과) 다중 1-하트 lot 환불
-- 시나리오: 1하트 lot 3개(만료 +45/+50/+55d)로 게시, 25h 후 취소 환불.
--   기대(GREEN): aggregate FLOOR(3*0.5)=1 → 1하트를 **가장 임박한 +45d** lot로 복원.
--   회귀(RED, per-lot) 였다면: 각 FLOOR(1*0.5)=0 → 하트 환불 총 0.
-- 안전: BEGIN/ROLLBACK
BEGIN;
SELECT plan(5);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_pid   uuid := gen_random_uuid();
  v_e1    timestamptz := now() + interval '45 days';
  v_e2    timestamptz := now() + interval '50 days';
  v_e3    timestamptz := now() + interval '55 days';
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_r50_owner@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"R50"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_r50_owner@test.local', 'fixture','employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_r50_ws', v_owner, now(), now());
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES (v_pid, v_owner, v_ws, '__fx: r50', 1, 0, 'active', 'urgent', now(), now());

  -- 소비된 하트 lot 3개(amount_remaining=0) + 지갑 0
  INSERT INTO public.heart_lots(user_id, amount_initial, amount_remaining, expires_at, source)
  VALUES (v_owner, 1, 0, v_e1, 'grant_signup'),
         (v_owner, 1, 0, v_e2, 'grant_signup'),
         (v_owner, 1, 0, v_e3, 'grant_signup');
  INSERT INTO public.wallets(user_id, heart_balance, diamond_balance)
  VALUES (v_owner, 0, 0) ON CONFLICT (user_id) DO UPDATE SET heart_balance = 0, diamond_balance = 0;

  -- 25h 전 소비 ledger row(하트 3) + lot 메타데이터(만료일 보존용). rate=0.5 유도.
  INSERT INTO public.wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                                    balance_after_heart, balance_after_diamond, metadata, created_at)
  VALUES (v_owner, 'heart', -3, 'consume_job_posting', v_pid, 'job_posting', 0, 0,
          jsonb_build_object('heart_lots_consumed', jsonb_build_array(
            jsonb_build_object('expires_at', v_e1, 'amount', 1),
            jsonb_build_object('expires_at', v_e2, 'amount', 1),
            jsonb_build_object('expires_at', v_e3, 'amount', 1)
          )),
          now() - interval '25 hours');

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.pid',   v_pid::text,   false);
  PERFORM set_config('test.e1',    v_e1::text,    false);
END $$;

SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);

SELECT set_config('test.refund',
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid')::uuid, current_setting('test.owner')::uuid))::text, false);

-- (1) aggregate FLOOR(3*0.5)=1 하트 환불 (per-lot이면 0)
SELECT is((current_setting('test.refund')::jsonb)->>'refunded_hearts', '1', 'rate=0.5 다중lot: 하트 1 환불(aggregate)');
-- (2) refund_rate 0.5
SELECT is((current_setting('test.refund')::jsonb)->>'refund_rate', '0.5', 'rate=0.5 적용');
-- (3) 하트 잔액 1 복원
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  1, 'heart_balance restored to 1');
-- (4) 복원 lot 1건(amount=1)
SELECT is(
  (SELECT count(*)::int FROM public.heart_lots
   WHERE user_id = current_setting('test.owner')::uuid AND source = 'refund_job_cancelled' AND amount_remaining = 1),
  1, 'one restored heart_lot (amount 1)');
-- (5) 복원 lot 만료일 = 가장 임박(+45d, soonest-first 분배)
SELECT is(
  (SELECT expires_at FROM public.heart_lots
   WHERE user_id = current_setting('test.owner')::uuid AND source = 'refund_job_cancelled' LIMIT 1),
  current_setting('test.e1')::timestamptz,
  'restored lot uses soonest expiry (+45d)');

SELECT * FROM finish();
ROLLBACK;
