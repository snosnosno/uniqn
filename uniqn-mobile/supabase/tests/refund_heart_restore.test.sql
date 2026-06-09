-- ============================================================
-- M2: 하트→다이아 환불 세탁 봉쇄
-- 시나리오: 하트 5(만료 +45d)로 공고 게시(consume) → 24h내 취소 환불
--   기대(GREEN): 하트 5가 **원래 만료일(+45d)** heart_lot로 복원, 다이아 0(세탁 없음).
--   회귀(RED) 였다면: 합산 5가 'diamond'로 적립 → diamond_balance=5 (세탁).
-- 안전: BEGIN/ROLLBACK. auth.uid() = request.jwt.claim.sub
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_pid   uuid := gen_random_uuid();
  v_exp   timestamptz := now() + interval '45 days';
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_rfheart_owner@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"RH"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_rfheart_owner@test.local', 'fixture','employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_rfheart_ws', v_owner, now(), now());
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES (v_pid, v_owner, v_ws, '__sql_fixture: rf heart', 1, 0, 'active', 'urgent', now(), now());

  -- 하트 5 (만료 +45d) + 다이아 0. wallet 캐시 = lot 합.
  INSERT INTO public.heart_lots(user_id, amount_initial, amount_remaining, expires_at, source)
  VALUES (v_owner, 5, 5, v_exp, 'grant_signup');
  INSERT INTO public.wallets(user_id, heart_balance, diamond_balance)
  VALUES (v_owner, 5, 0) ON CONFLICT (user_id) DO UPDATE SET heart_balance = 5, diamond_balance = 0;

  -- 실제 consume RPC로 게시(M1 metadata 기록) → heart 5 소비, heart_balance 0
  PERFORM public.consume_diamonds_atomically(v_owner, 5, 'consume_job_posting'::wallet_reason, v_pid, 'job_posting');

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.pid',   v_pid::text,   false);
  PERFORM set_config('test.exp',   v_exp::text,   false);
END $$;

SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);

-- 1차 환불 (1시간 미만 경과 → 100%) → 결과 캡처
SELECT set_config('test.refund',
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid')::uuid, current_setting('test.owner')::uuid))::text, false);

-- (1) 하트 5 환불
SELECT is((current_setting('test.refund')::jsonb)->>'refunded_hearts', '5', '하트 5 환불');
-- (2) 다이아 0 환불 (세탁 없음)
SELECT is((current_setting('test.refund')::jsonb)->>'refunded_diamonds', '0', '다이아 환불 0 (세탁 없음)');
-- (3) 다이아 잔액 = 0 (RED였다면 5로 세탁)
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  0, 'diamond_balance = 0 (하트가 다이아로 세탁되지 않음)');
-- (4) 하트 잔액 = 5 복원
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  5, 'heart_balance restored to 5');
-- (5) 복원 heart_lot 1건 (source=refund_job_cancelled, amount=5, ref=posting)
SELECT is(
  (SELECT count(*)::int FROM public.heart_lots
   WHERE user_id = current_setting('test.owner')::uuid
     AND source = 'refund_job_cancelled'
     AND amount_remaining = 5
     AND source_ref_id = current_setting('test.pid')::uuid),
  1, 'one restored heart_lot (5, source=refund)');
-- (6) 복원 lot 만료일 = 원래 만료일(+45d) 보존
SELECT is(
  (SELECT expires_at FROM public.heart_lots
   WHERE user_id = current_setting('test.owner')::uuid
     AND source = 'refund_job_cancelled'
   LIMIT 1),
  current_setting('test.exp')::timestamptz,
  'restored lot preserves original expiry (+45d)');
-- (7) heart 환불 ledger row delta=+5
SELECT is(
  (SELECT delta FROM public.wallet_ledger
   WHERE user_id = current_setting('test.owner')::uuid
     AND ref_id = current_setting('test.pid')::uuid
     AND reason = 'refund_job_cancelled'
     AND currency_type = 'heart'),
  5, 'heart refund ledger row delta = +5');
-- (8) 2차 환불 → idempotent (이중 복원 없음)
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid')::uuid, current_setting('test.owner')::uuid))->>'idempotent',
  'true', 'second refund idempotent (no double restore)');

SELECT * FROM finish();
ROLLBACK;
