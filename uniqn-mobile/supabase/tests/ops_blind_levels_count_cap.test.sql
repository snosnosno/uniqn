-- levels 서버 상한(=100) 회귀 가드 — 20260724120000 마이그.
--   ops_set_blind_levels·ops_save_blind_preset 둘 다 101개 거부(P0001) + 정확히 100개는 통과(경계).
-- ⚠️ JWT 주입은 헬퍼(ops_test_set_user) 경유만(wiki decisions/wallet-pgtap-caller-binding).
BEGIN;
SELECT plan(4);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('cap.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('cap.tournament_id', s.tournament_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('cap.owner_id'))::uuid);

-- ─── (1) ops_set_blind_levels: 101개 → P0001 상한 거부 ───
SELECT throws_ok(
  $$ SELECT public.ops_set_blind_levels(
       (current_setting('cap.tournament_id'))::uuid, (current_setting('cap.owner_id'))::uuid,
       (SELECT jsonb_agg(jsonb_build_object(
          'level', i, 'small_blind', 100, 'big_blind', 200, 'ante', 0,
          'duration_sec', 600, 'is_break', false)) FROM generate_series(1, 101) i)) $$,
  'P0001', 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨은 최대 100개입니다',
  'set_blind_levels: 101개 상한 거부(P0001)');

-- ─── (2) ops_set_blind_levels: 정확히 100개 → 통과(count=100, 경계 off-by-one 가드) ───
SELECT is(
  (public.ops_set_blind_levels(
     (current_setting('cap.tournament_id'))::uuid, (current_setting('cap.owner_id'))::uuid,
     (SELECT jsonb_agg(jsonb_build_object(
        'level', i, 'small_blind', 100, 'big_blind', 200, 'ante', 0,
        'duration_sec', 600, 'is_break', false)) FROM generate_series(1, 100) i))
   ->> 'count')::int,
  100, 'set_blind_levels: 정확히 100개 통과(count=100)');

-- ─── (3) ops_save_blind_preset: 101개 → P0001 상한 거부 ───
SELECT throws_ok(
  $$ SELECT public.ops_save_blind_preset(
       (current_setting('cap.owner_id'))::uuid, '상한 초과',
       (SELECT jsonb_agg(jsonb_build_object(
          'level', i, 'smallBlind', 100, 'bigBlind', 200, 'ante', 0,
          'durationSec', 600, 'isBreak', false)) FROM generate_series(1, 101) i)) $$,
  'P0001', '레벨 개수 초과(최대 100)',
  'save_blind_preset: 101개 상한 거부(P0001)');

-- ─── (4) ops_save_blind_preset: 정확히 100개 → 저장 통과(levels 길이 100) ───
DO $$
BEGIN
  PERFORM public.ops_save_blind_preset(
    (current_setting('cap.owner_id'))::uuid, '상한 경계',
    (SELECT jsonb_agg(jsonb_build_object(
       'level', i, 'smallBlind', 100, 'bigBlind', 200, 'ante', 0,
       'durationSec', 600, 'isBreak', false)) FROM generate_series(1, 100) i));
END $$;
SELECT is(
  (SELECT jsonb_array_length(levels) FROM public.ops_blind_presets
    WHERE owner_id = (current_setting('cap.owner_id'))::uuid AND name = '상한 경계'),
  100, 'save_blind_preset: 정확히 100개 저장 통과(levels 길이 100)');

SELECT * FROM finish();
ROLLBACK;
