-- fn_ops_recompute_live_stats: 집계 정확성 + §0.5 B1(avg_stack_bb NOT NULL 가드: 미설정/브레이크 0) +
--   cross-tenant 격리 + CASCADE 가드(대회 삭제 회귀).
-- 통제된 대회 A/B/C 를 직접 구성(postgres) 후 RPC/직접변이 → live_stats 단언.
BEGIN;
-- 1f: live_stats 트리거가 DEFERRED 로 전환됨 — 이 파일은 같은 txn 에서 live_stats 를 단언하므로 즉시 발화 강제.
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(13);

-- ─── 셋업: 시드(owner 확보) + 통제 대회 A(코스트 고정, 2명 active chips 100/200, bb=400) ───
DO $$
DECLARE s RECORD; v_a uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('role', 'postgres', true);

  INSERT INTO public.ops_tournaments (id, owner_id, name, starting_chips, buy_in_cost, rebuy_cost, addon_cost)
  VALUES (v_a, s.owner_id, 'recompute A', 0, 50000, 30000, 20000);
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES (v_a, 1, 'P1', 'active', 100),
         (v_a, 2, 'P2', 'active', 200);
  INSERT INTO public.ops_blind_levels (tournament_id, level, small_blind, big_blind, duration_sec, sort)
  VALUES (v_a, 1, 200, 400, 600, 1);
  PERFORM public.fn_ops_recompute_live_stats(v_a);  -- 명시 재계산(트리거와 동일 결과, 결정성)
  PERFORM set_config('ops.a', v_a::text, true);

  -- 대회 B: 블라인드 미설정(avg_stack_bb=0 가드 검증용). auto_seat off → 좌석 불요.
  PERFORM set_config('ops.b', gen_random_uuid()::text, true);
  INSERT INTO public.ops_tournaments (id, owner_id, name, starting_chips, registration_open, auto_seat_on_register)
  VALUES ((current_setting('ops.b'))::uuid, s.owner_id, 'recompute B noblind', 30000, true, false);

  -- 대회 C: 브레이크 레벨(bb=0) + active 참가자(리바이 검증용).
  PERFORM set_config('ops.c',  gen_random_uuid()::text, true);
  PERFORM set_config('ops.pc', gen_random_uuid()::text, true);
  INSERT INTO public.ops_tournaments (id, owner_id, name, starting_chips, rebuy_chips)
  VALUES ((current_setting('ops.c'))::uuid, s.owner_id, 'recompute C break', 30000, 30000);
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.pc'))::uuid, (current_setting('ops.c'))::uuid, 1, 'BreakP', 'active', 30000);
  INSERT INTO public.ops_blind_levels (tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort)
  VALUES ((current_setting('ops.c'))::uuid, 0, 0, 0, 0, 300, true, 1);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ─── A: 집계 정확성 ───
SELECT is((SELECT playing       FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 2,            'A playing=2');
SELECT is((SELECT entries       FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 2,            'A entries=2');
SELECT is((SELECT total_chips   FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 300::bigint,  'A total_chips=300');
SELECT is((SELECT average_stack FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 150::bigint,  'A average_stack=150');
SELECT is((SELECT avg_stack_bb  FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 0.375::numeric,'A avg_stack_bb=150/400=0.375');
SELECT is((SELECT prize_pool    FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid), 100000::bigint,'A prize_pool=2*buy_in_cost(50000)');

-- ─── B(§0.5 B1): 블라인드 미설정 워크인 등록 성공(23502 없음) + avg_stack_bb=0 ───
SELECT lives_ok(
  $$ SELECT public.ops_register_participant(
       (current_setting('ops.b'))::uuid, (current_setting('ops.owner_id'))::uuid, 'NoBlind', NULL, NULL, NULL) $$,
  'register succeeds with no blind levels (no 23502 NOT NULL rollback)');
SELECT is(
  (SELECT avg_stack_bb FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.b'))::uuid),
  0::numeric, 'B avg_stack_bb=0 when no blind levels');

-- ─── C(§0.5 B1): 브레이크(bb=0) 중 리바이 성공 + avg_stack_bb=0 ───
SELECT lives_ok(
  $$ SELECT public.ops_add_rebuy(
       (current_setting('ops.pc'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'rebuy succeeds during break (bb=0, no 23502)');
SELECT is(
  (SELECT avg_stack_bb FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.c'))::uuid),
  0::numeric, 'C avg_stack_bb=0 during break (bb=0)');

-- ─── cross-tenant 격리: A 변이가 B live_stats 불변 ───
DO $$
DECLARE v_before int;
BEGIN
  SELECT entries INTO v_before FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.b'))::uuid;
  PERFORM set_config('ops.b_entries_before', v_before::text, true);
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.a'))::uuid, 3, 'P3', 'active', 500);
END $$;
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.b'))::uuid),
  (current_setting('ops.b_entries_before'))::int,
  'B live_stats.entries unchanged after A mutation (cross-tenant isolation)');
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.a'))::uuid),
  3, 'A live_stats.entries=3 after adding P3');

-- ─── CASCADE 가드: 대회 삭제 시 자식 DELETE 트리거 recompute 가 FK 위반 없이 통과 ───
DO $$
DECLARE v_del uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_tournaments (id, owner_id, name, starting_chips)
  VALUES (v_del, (current_setting('ops.owner_id'))::uuid, 'to delete', 1000);
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES (v_del, 1, 'DelP', 'active', 1000);
  PERFORM set_config('ops.del', v_del::text, true);
END $$;
SELECT lives_ok(
  $$ DELETE FROM public.ops_tournaments WHERE id = (current_setting('ops.del'))::uuid $$,
  'deleting tournament cascades without recompute FK violation (CASCADE guard)');

SELECT * FROM finish();
ROLLBACK;
