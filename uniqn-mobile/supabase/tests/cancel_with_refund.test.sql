-- ============================================================
-- M3: cancel_job_posting_with_refund_atomically — 취소+환불 원자성
--   (a) owner 취소 → status=cancelled + 환불 동시 적용
--   (b) 무료공고(차감 없음) → 취소 성공, 환불 row 없음
--   (c) stranger → unauthorized, status 불변
--   (d) 멱등: 재취소 → idempotent
-- 안전: BEGIN/ROLLBACK. auth.uid() = request.jwt.claim.sub
-- ============================================================
BEGIN;
SELECT plan(10);

DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws       uuid := gen_random_uuid();
  v_p1       uuid := gen_random_uuid();  -- 다이아 10 차감
  v_p2       uuid := gen_random_uuid();  -- 무료(차감 없음)
  v_p3       uuid := gen_random_uuid();  -- stranger 시도용
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_m3_owner@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"M3O"}'::jsonb, now(), now()),
         (v_stranger, '__sql_fixture_m3_stranger@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"M3S"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_m3_owner@test.local', 'fixture','employer', true, now(), now()),
         (v_stranger, '__sql_fixture_m3_stranger@test.local', 'fixture','employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_m3_ws', v_owner, now(), now());
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_owner, 0) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES (v_p1, v_owner, v_ws, '__fx: m3 p1', 1, 0, 'active', 'urgent', now(), now()),
         (v_p2, v_owner, v_ws, '__fx: m3 p2', 1, 0, 'active', 'regular', now(), now()),
         (v_p3, v_owner, v_ws, '__fx: m3 p3', 1, 0, 'active', 'urgent', now(), now());

  -- P1: 다이아 10 차감(1시간 전 → <24h → 100%)
  INSERT INTO public.wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                                    balance_after_heart, balance_after_diamond, created_at)
  VALUES (v_owner, 'diamond', -10, 'consume_job_posting', v_p1, 'job_posting', 0, 0, now() - interval '1 hour');

  PERFORM set_config('test.owner',    v_owner::text,    false);
  PERFORM set_config('test.stranger', v_stranger::text, false);
  PERFORM set_config('test.p1', v_p1::text, false);
  PERFORM set_config('test.p2', v_p2::text, false);
  PERFORM set_config('test.p3', v_p3::text, false);
END $$;

-- === owner 컨텍스트 ===
SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);

-- (a) P1 취소 → 성공
SELECT set_config('test.c1',
  (public.cancel_job_posting_with_refund_atomically(
     current_setting('test.p1')::uuid, current_setting('test.owner')::uuid))::text, false);
SELECT is((current_setting('test.c1')::jsonb)->>'success', 'true', 'P1 취소 성공');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE id = current_setting('test.p1')::uuid),
  'cancelled', 'P1 status=cancelled');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger
   WHERE ref_id = current_setting('test.p1')::uuid AND reason='refund_job_cancelled'),
  1, 'P1 환불 ledger row 1건 (취소+환불 원자 적용)');
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  10, 'owner diamond_balance=10 (환불 적립)');

-- (d) P1 재취소 → idempotent
SELECT is(
  (public.cancel_job_posting_with_refund_atomically(
     current_setting('test.p1')::uuid, current_setting('test.owner')::uuid))->>'idempotent',
  'true', 'P1 재취소 idempotent');

-- (b) P2 무료공고 취소 → 성공, 환불 없음
SELECT set_config('test.c2',
  (public.cancel_job_posting_with_refund_atomically(
     current_setting('test.p2')::uuid, current_setting('test.owner')::uuid))::text, false);
SELECT is((current_setting('test.c2')::jsonb)->>'success', 'true', 'P2 무료공고 취소 성공');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE id = current_setting('test.p2')::uuid),
  'cancelled', 'P2 status=cancelled');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger
   WHERE ref_id = current_setting('test.p2')::uuid AND reason='refund_job_cancelled'),
  0, 'P2 환불 row 없음 (차감 없으므로)');

-- (c) stranger 컨텍스트 → P3 취소 거부, status 불변
SELECT set_config('request.jwt.claim.sub', current_setting('test.stranger'), false);
SELECT is(
  (public.cancel_job_posting_with_refund_atomically(
     current_setting('test.p3')::uuid, current_setting('test.owner')::uuid))->>'error',
  'unauthorized', 'stranger 취소 거부');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE id = current_setting('test.p3')::uuid),
  'active', 'P3 status 불변 (active)');

SELECT * FROM finish();
ROLLBACK;
