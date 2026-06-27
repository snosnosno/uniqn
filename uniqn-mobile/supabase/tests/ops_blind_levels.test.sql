-- ops_set_blind_levels: 전체교체(sort 1..N 연속)·빈배열/0duration 거부·스케줄축소 후 클럭 clamp/재앵커. §0.5 B2
BEGIN;
SELECT plan(7);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 1) 3레벨 설정 → count 3 + sort 1,2,3 연속
SELECT is(
  (public.ops_set_blind_levels(
     (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
     '[{"level":1,"small_blind":100,"big_blind":200,"ante":0,"duration_sec":600,"is_break":false},
       {"level":2,"small_blind":200,"big_blind":400,"ante":0,"duration_sec":600,"is_break":false},
       {"level":3,"small_blind":300,"big_blind":600,"ante":50,"duration_sec":600,"is_break":false}]'::jsonb)
   ->> 'count')::int,
  3, 'set_blind_levels with 3 levels returns count 3');

SELECT is(
  (SELECT array_agg(sort ORDER BY sort) FROM public.ops_blind_levels
     WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  ARRAY[1, 2, 3], 'blind level sorts are 1,2,3 contiguous');

-- 2) 빈 배열 → throws OPS_BLIND_LEVELS_INVALID (P0001)
SELECT throws_ok(
  $$ SELECT public.ops_set_blind_levels(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, '[]'::jsonb) $$,
  'P0001', NULL, 'empty blind levels rejected (OPS_BLIND_LEVELS_INVALID)');

-- 2b) duration_sec <= 0 → throws
SELECT throws_ok(
  $$ SELECT public.ops_set_blind_levels(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       '[{"level":1,"big_blind":200,"duration_sec":0}]'::jsonb) $$,
  'P0001', NULL, 'zero duration rejected (OPS_BLIND_LEVELS_INVALID)');

-- 3) 클럭을 sort 3 으로 이동 + 시작 후, 2레벨로 축소 → current_level_sort(3>2) clamp 2 + 재앵커.
SELECT public.ops_clock_set_level((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 3);
SELECT public.ops_clock_start((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid);

SELECT is(
  (public.ops_set_blind_levels(
     (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
     '[{"level":1,"big_blind":200,"duration_sec":600},{"level":2,"big_blind":400,"duration_sec":600}]'::jsonb)
   ->> 'reanchored')::boolean,
  true, 'shrinking schedule below current level re-anchors clock');

SELECT is(
  (SELECT current_level_sort FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  2, 'current_level_sort clamped to new max (2)');

SELECT is(
  (SELECT is_running FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  false, 'clock paused (is_running=false) after safe re-anchor');

SELECT * FROM finish();
ROLLBACK;
