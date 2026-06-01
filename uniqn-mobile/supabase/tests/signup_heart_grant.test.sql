-- ============================================================
-- T4: handle_new_user grant_signup +10 + 백필
-- 신규 가입 → heart 10 / 트리거 재실행(이미 users 존재) → 무적립
-- 안전: BEGIN/ROLLBACK
-- 주의: 로컬/CI에서 auth.users INSERT 트리거가 자동 등록되지 않으므로
--       이 테스트 내에서 임시 트리거를 생성하고 ROLLBACK으로 정리
-- ============================================================
BEGIN;
SELECT plan(4);

-- 테스트용 임시 트리거 등록 (ROLLBACK으로 자동 정리)
CREATE TRIGGER test_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 신규 auth.users INSERT → 트리거 → grant_signup 10
DO $$
DECLARE v_new uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_new, '__sql_fixture_sg_new@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"SG"}'::jsonb, now(), now());
  PERFORM set_config('test.new', v_new::text, false);
END $$;

SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.new')::uuid), 10,
  'new signup grants 10 hearts');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger WHERE user_id = current_setting('test.new')::uuid AND reason='grant_signup'), 1,
  'exactly one grant_signup ledger');

-- 멱등: backfill_signup_hearts 재호출 시 이미 받은 유저는 skip
DO $$
BEGIN
  PERFORM public.backfill_signup_hearts();
END $$;
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.new')::uuid), 10,
  'backfill does not double-grant existing recipient');

-- 백필: grant_signup 없는 기존 유저에게 10 적립
DO $$
DECLARE v_old uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_old, '__sql_fixture_sg_old@test.local', 'authenticated', 'authenticated', '', '{}'::jsonb, '{}'::jsonb, now(), now());
  -- 트리거가 이미 grant 했으므로, 백필 검증 위해 ledger/wallet/lots 초기화 (백필 대상 모사)
  DELETE FROM public.wallet_ledger WHERE user_id = v_old;
  UPDATE public.wallets SET heart_balance=0 WHERE user_id = v_old;
  DELETE FROM public.heart_lots WHERE user_id = v_old;
  PERFORM public.backfill_signup_hearts();
  PERFORM set_config('test.old', v_old::text, false);
END $$;
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.old')::uuid), 10,
  'backfill grants 10 to user without grant_signup');

SELECT * FROM finish();
ROLLBACK;
