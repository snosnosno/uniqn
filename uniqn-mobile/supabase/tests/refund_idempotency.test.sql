-- ============================================================
-- Fix-2: 환불 멱등성/이중환불 차단 (20260602000010_refund_idempotency_lock)
-- 부분 UNIQUE 인덱스 존재 + 동일 posting 재환불 시 idempotent(이중 적립 없음) 검증.
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md
-- 안전: BEGIN/ROLLBACK. auth.uid() = request.jwt.claim.sub
-- ============================================================
BEGIN;
SELECT plan(5);

-- (1) DB 최종 방어선: 부분 UNIQUE 인덱스 존재
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='wallet_ledger'
      AND indexname='uq_wallet_ledger_refund_job'
  ),
  'partial UNIQUE index uq_wallet_ledger_refund_job exists'
);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_pid   uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_rfidem_owner@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"RI"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_rfidem_owner@test.local', 'fixture','employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_rfidem_ws', v_owner, now(), now());
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_owner, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES (v_pid, v_owner, v_ws, '__sql_fixture: rf idem', 1, 0, 'active', 'urgent', now(), now());
  -- 10 다이아 차감 (1시간 전 → <24h → 100% 환불)
  INSERT INTO public.wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                                    balance_after_heart, balance_after_diamond, created_at)
  VALUES (v_owner, 'diamond', -10, 'consume_job_posting', v_pid, 'job_posting', 0, 0, now() - interval '1 hour');

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.pid',   v_pid::text,   false);
END $$;

SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);

-- (2) 1차 환불 → 성공, 10 다이아 (100%)
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid')::uuid, current_setting('test.owner')::uuid))->>'refunded_diamonds',
  '10', 'first refund credits 10 diamonds (100% within 24h)');

-- (3) 2차 환불(동일 posting) → idempotent:true (재적립 없음)
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid')::uuid, current_setting('test.owner')::uuid))->>'idempotent',
  'true', 'second refund on same posting returns idempotent');

-- (4) refund_job_cancelled ledger row 는 정확히 1건 (이중환불 차단)
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger
   WHERE ref_id = current_setting('test.pid')::uuid
     AND user_id = current_setting('test.owner')::uuid
     AND reason = 'refund_job_cancelled'),
  1, 'exactly one refund ledger row (no double-refund)');

-- (5) 캐시 잔액 = 0(차감 후) + 10(환불) = 10, 20 아님(이중적립 없음)
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  10, 'wallet diamond_balance = 10 (single refund credit, no drift)');

SELECT * FROM finish();
ROLLBACK;
