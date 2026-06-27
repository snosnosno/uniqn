-- ops_clock 상태전이: 블라인드없는 start 거부·start/pause/재개 잔여보존·±60s adjust 부호(running/paused)·
--   set_level invalid 거부. §0.5 B7
-- 주의: pgTAP 단일 트랜잭션 내 now()=transaction_timestamp 고정 → 잔여시간 계산 결정적.
--   잔여 = duration_sec - EXTRACT(EPOCH FROM (now() - level_started_at)).
BEGIN;
SELECT plan(10);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 0) 블라인드 미설정 start → throws OPS_NO_BLIND_LEVELS
SELECT throws_ok(
  $$ SELECT public.ops_clock_start(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'start without blind levels rejected (OPS_NO_BLIND_LEVELS)');

-- 블라인드 3레벨(각 600초) 설정
SELECT public.ops_set_blind_levels(
  (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600}]'::jsonb);

-- 1) start → is_running, level_started_at NOT NULL, 잔여 = duration(600)
SELECT public.ops_clock_start((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
SELECT is(
  (SELECT is_running FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  true, 'clock running after start');
SELECT isnt(
  (SELECT level_started_at FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  NULL, 'level_started_at set after start');
SELECT is(
  (SELECT (bl.duration_sec - EXTRACT(EPOCH FROM (now() - c.level_started_at)))::int
     FROM public.ops_clock c
     JOIN public.ops_blind_levels bl ON bl.tournament_id = c.tournament_id AND bl.sort = c.current_level_sort
     WHERE c.tournament_id = (current_setting('ops.tournament_id'))::uuid),
  600, 'remaining = duration (600) right after fresh start');

-- 2) running + adjust(+60) → 잔여 660 (부호 규약: +delta = 잔여 증가)
SELECT public.ops_clock_adjust((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 60);
SELECT is(
  (SELECT (bl.duration_sec - EXTRACT(EPOCH FROM (now() - c.level_started_at)))::int
     FROM public.ops_clock c
     JOIN public.ops_blind_levels bl ON bl.tournament_id = c.tournament_id AND bl.sort = c.current_level_sort
     WHERE c.tournament_id = (current_setting('ops.tournament_id'))::uuid),
  660, 'running adjust(+60) increases remaining to 660');

-- 3) pause → is_running false, paused_remaining_sec = 660 (조정된 잔여 보존)
SELECT public.ops_clock_pause((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
SELECT is(
  (SELECT is_running FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  false, 'clock paused after pause');
SELECT is(
  (SELECT paused_remaining_sec FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  660, 'paused_remaining_sec snapshot = 660');

-- 4) paused + adjust(+60) → paused_remaining_sec 720
SELECT public.ops_clock_adjust((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 60);
SELECT is(
  (SELECT paused_remaining_sec FROM public.ops_clock WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  720, 'paused adjust(+60) increases paused_remaining to 720');

-- 5) 재개(start) → 남은시간(720) 보존: 잔여 = 720
SELECT public.ops_clock_start((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
SELECT is(
  (SELECT (bl.duration_sec - EXTRACT(EPOCH FROM (now() - c.level_started_at)))::int
     FROM public.ops_clock c
     JOIN public.ops_blind_levels bl ON bl.tournament_id = c.tournament_id AND bl.sort = c.current_level_sort
     WHERE c.tournament_id = (current_setting('ops.tournament_id'))::uuid),
  720, 'resume preserves paused remaining (720)');

-- 6) set_level 존재않는 sort → throws OPS_INVALID_LEVEL
SELECT throws_ok(
  $$ SELECT public.ops_clock_set_level(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 99) $$,
  'P0001', NULL, 'set_level with nonexistent sort rejected (OPS_INVALID_LEVEL)');

SELECT * FROM finish();
ROLLBACK;
