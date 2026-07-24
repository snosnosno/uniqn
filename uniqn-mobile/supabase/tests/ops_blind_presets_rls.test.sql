-- ops_blind_presets RLS pgTAP(B3): 테이블 존재 · FORCE RLS · owner 스코프 격리.
--   owner A 는 자기 프리셋을 보고, owner B 는 A 의 프리셋을 0행으로 격리(소유자 전용 정책).
-- 패턴: ops_1c_tables_rls.test.sql(존재·FORCE RLS·set_config 로 id 전달·ops_test_set_user 로 role 전환).
-- ⚠️ JWT 주입은 헬퍼(ops_test_set_user) 경유만 — 인라인 set_config 로 request.jwt.* 직접 주입 금지
--    (wiki decisions/wallet-pgtap-caller-binding: singular/plural GUC 동시주입 안 하면 owner 바인딩 42501 오염).
--    ops_test_set_user 는 singular(request.jwt.claim.sub) + plural(request.jwt.claims) 을 모두 세팅한다.
-- 시드 인서트는 set_user 이전(postgres superuser) — RLS 우회로 두 소유자의 프리셋을 직접 적재.
BEGIN;
SELECT plan(4);

-- ─── (1) 테이블 존재 ───
SELECT has_table('public', 'ops_blind_presets', 'ops_blind_presets 테이블 존재');

-- ─── (2) RLS 강제(FORCE) ───
SELECT is(
  (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.ops_blind_presets'::regclass),
  true, 'ops_blind_presets FORCE RLS');

-- 독립 소유자 A/B 시드(각 seed 호출은 새 랜덤 유저 — 서로 무관). 프리셋 1개씩 postgres 로 직접 적재.
DO $$
DECLARE a RECORD; b RECORD;
BEGIN
  SELECT * INTO a FROM ops_test_seed();
  SELECT * INTO b FROM ops_test_seed();
  PERFORM set_config('bp.owner_a', a.owner_id::text, true);
  PERFORM set_config('bp.owner_b', b.owner_id::text, true);
  INSERT INTO public.ops_blind_presets (owner_id, name, levels)
  VALUES (a.owner_id, 'A 프리셋', '[{"level":1,"sb":100,"bb":200,"durationSec":600}]'::jsonb);
  INSERT INTO public.ops_blind_presets (owner_id, name, levels)
  VALUES (b.owner_id, 'B 프리셋', '[{"level":1,"sb":100,"bb":200,"durationSec":600}]'::jsonb);
END $$;

-- ─── (3) owner A 는 자기 프리셋 조회 가능(1행) ───
SELECT ops_test_set_user((current_setting('bp.owner_a'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_blind_presets WHERE owner_id = (current_setting('bp.owner_a'))::uuid),
  1, 'owner A 는 자기 프리셋 1행 조회');

-- ─── (4) owner B 는 A 의 프리셋 조회 불가(0행) ───
SELECT ops_test_set_user((current_setting('bp.owner_b'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_blind_presets WHERE owner_id = (current_setting('bp.owner_a'))::uuid),
  0, 'owner B 는 A 의 프리셋 0행(소유자 격리)');

SELECT * FROM finish();
ROLLBACK;
