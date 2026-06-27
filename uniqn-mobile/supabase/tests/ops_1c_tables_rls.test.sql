-- ops 1c 테이블 RLS + init 트리거: 존재·RLS forced·member SELECT/outsider 0·authenticated DML 거부·
--   신규 대회 INSERT 시 clock+live_stats 자동생성.
-- 패턴: ops_tables_rls.test.sql(멤버십 RLS) + ops_entry_number_allocation.test.sql(postgres 역할전환).
BEGIN;
SELECT plan(17);

-- ─── (a) 세 테이블 존재 ───
SELECT has_table('public', 'ops_blind_levels', 'ops_blind_levels exists');
SELECT has_table('public', 'ops_clock',        'ops_clock exists');
SELECT has_table('public', 'ops_live_stats',   'ops_live_stats exists');

-- ─── (a) RLS enabled + forced (pg_class relrowsecurity AND relforcerowsecurity) ───
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.ops_blind_levels'::regclass),
  'ops_blind_levels RLS enabled+forced');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.ops_clock'::regclass),
  'ops_clock RLS enabled+forced');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.ops_live_stats'::regclass),
  'ops_live_stats RLS enabled+forced');

-- 시드 + 블라인드 레벨 1개(postgres 직접 — RLS 가시성 테스트 데이터).
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
  INSERT INTO public.ops_blind_levels (tournament_id, level, small_blind, big_blind, duration_sec, sort)
  VALUES (s.tournament_id, 1, 100, 200, 600, 1);
END $$;

-- ─── (b) member(owner): clock/live_stats/blind_levels 각 1행 보임 ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_clock        WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees clock');
SELECT is((SELECT count(*)::int FROM public.ops_live_stats   WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees live_stats');
SELECT is((SELECT count(*)::int FROM public.ops_blind_levels WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees blind_levels');

-- ─── (b) outsider: 0행 ───
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_clock        WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 0, 'outsider sees no clock');
SELECT is((SELECT count(*)::int FROM public.ops_live_stats   WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 0, 'outsider sees no live_stats');
SELECT is((SELECT count(*)::int FROM public.ops_blind_levels WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 0, 'outsider sees no blind_levels');

-- ─── (c) authenticated 직접 DML 거부 ───
-- ⚠️ fixture(ops_helpers.sql)가 GRANT ALL ON ALL TABLES → 마이그 REVOKE 가 로컬에선 마스킹됨.
--    실제 방어는 RLS: INSERT 는 정책 부재로 하드거부(42501), UPDATE/DELETE 는 정책 부재로 0행 소프트거부(무예외).
--    → INSERT 는 throws_ok, UPDATE 는 '값 불변'으로 쓰기차단을 검증(prod REVOKE/fixture RLS 양쪽 견고).
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_ok(
  $$ INSERT INTO public.ops_blind_levels (tournament_id, level, duration_sec, sort)
     VALUES ((current_setting('ops.tournament_id'))::uuid, 2, 600, 2) $$,
  '42501', NULL, 'authenticated direct INSERT ops_blind_levels rejected (RLS no INSERT policy)');

-- UPDATE 시도 → RLS(UPDATE 정책 없음) 0행. prod 에선 REVOKE 로 42501 — 예외/0행 모두 흡수 후 값 불변 단언.
DO $$
BEGIN
  UPDATE public.ops_clock SET is_running = true
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
  UPDATE public.ops_live_stats SET playing = 99
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
SELECT is(
  (SELECT is_running FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  false, 'authenticated cannot mutate ops_clock (value unchanged: is_running stays false)');
SELECT is(
  (SELECT playing FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  1, 'authenticated cannot mutate ops_live_stats (value unchanged: playing stays 1 from seed)');

-- ─── (d) 신규 대회 INSERT → init 트리거가 clock + live_stats 자동 생성 ───
DO $$
DECLARE v_new_t uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('role', 'postgres', true);  -- ops_tournaments DML 은 REVOKE → 직접 INSERT 는 postgres 로.
  INSERT INTO public.ops_tournaments (id, owner_id, name)
  VALUES (v_new_t, (current_setting('ops.owner_id'))::uuid, 'init trigger test');
  PERFORM set_config('ops.new_t', v_new_t::text, true);
END $$;
SELECT is((SELECT count(*)::int FROM public.ops_clock      WHERE tournament_id = (current_setting('ops.new_t'))::uuid), 1, 'new tournament auto-creates ops_clock');
SELECT is((SELECT count(*)::int FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.new_t'))::uuid), 1, 'new tournament auto-creates ops_live_stats');

SELECT * FROM finish();
ROLLBACK;
