-- ops 1f — bust v2: eliminator 가드 4종·knockouts 적립·payload 3필드·구 2인자 시그니처 소멸(E10)·
--   actor 가드·자동확정 보류 가드(🔨H12).
-- 시드: active 3명(seed + 2명) + 좌석 배정 1명(payload freed_seat_id 실증 — 무위 시드 금지).
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;  -- live_stats 단언은 없지만 트리거 발화 시점 고정(결정성)
SELECT plan(15);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);
  PERFORM set_config('ops.seat1',       s.seat1_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  player_ids := public.ops_test_seed_players(s.tournament_id, 2);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
  -- p1 을 seat1 에 착석(freed_seat_id 실증용)
  UPDATE public.ops_seats SET participant_id = player_ids[1] WHERE id = s.seat1_id;
END $$;

-- ── [1] E10: 구 2인자 시그니처 소멸 (오버로딩 우회 차단) ──
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ops_bust_participant'
     AND p.pronargs = 2),
  0, '구 2인자 ops_bust_participant 시그니처 소멸(DROP 확인)');

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, NULL) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── eliminator 가드 4종 (전부 ELIMINATOR_INVALID) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.p1'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 자기 자신 거부');
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, gen_random_uuid()) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 미존재 거부');
-- 타대회: 두 번째 대회 시드(간이 — postgres 직접)
DO $$
DECLARE v_t2 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_tournaments (id, owner_id, name, game_type, starting_chips, status)
  VALUES (v_t2, (current_setting('ops.owner_id'))::uuid, 'other cup', 'NLH', 30000, 'active');
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p2, v_t2, 1, 'Other P', 'active', 30000);
  PERFORM set_config('ops.other_pid', v_p2::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.other_pid'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 타대회 참가자 거부(미존재와 동일 처리)');
-- 비-active eliminator: p2 를 postgres 로 busted 세팅 후 시도
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted'
    WHERE id = (current_setting('ops.p2'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.p2'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 비-active 거부');
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'active'
    WHERE id = (current_setting('ops.p2'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 정상 KO bust: p1(착석·칩 30000) 을 seed 가 눌렀다 ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid) INTO r;
  PERFORM set_config('ops.r_fp', (r->>'finish_position'), true);
END $$;
SELECT is(current_setting('ops.r_fp')::int, 3,                              -- [7]
  'KO bust: 3명 active → finish_position=3 (v1 로직 보존)');
SELECT is(                                                                   -- [8]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  1, 'eliminator(seed) knockouts=1 적립');

-- ── payload 3필드 (undo 복원 소스 계약) ──
SELECT is(                                                                   -- [9]
  (SELECT (payload->>'chips_before')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  30000, 'payload.chips_before=30000 (UPDATE 전 칩)');
SELECT is(                                                                   -- [10]
  (SELECT payload->>'eliminator_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  current_setting('ops.seed_pid'), 'payload.eliminator_id 기록');
SELECT is(                                                                   -- [11]
  (SELECT payload->>'freed_seat_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  current_setting('ops.seat1'), 'payload.freed_seat_id = bust 당시 점유 좌석');

-- ── NULL eliminator + 🔨H12 자동확정 보류: bust(p2) 전에 checked_in 생존자를 만들어
--    "active=1 이어도 checked_in>0 이면 확정 보류" 를 실증(무위 시드 방지 — checked_in 없으면
--    이 bust 가 자동확정·completed 를 유발해 보류 가드가 검증 불가).
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.t_id'))::uuid, 950, 'CheckedIn P', 'checked_in', 30000);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL) INTO r;
  PERFORM set_config('ops.r2_winner', (r->>'winner_finalized'), true);
END $$;
SELECT is(                                                                   -- [12]
  (SELECT sum(knockouts)::int FROM public.ops_participants
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, 'NULL eliminator: knockouts 총합 불변(1 유지)');
SELECT is(                                                                   -- [13]
  (SELECT payload->>'freed_seat_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p2'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  NULL, '무좌석 bust: payload.freed_seat_id IS NULL');
SELECT is(current_setting('ops.r2_winner'), 'false',                         -- [14]
  'H12: active 1 + checked_in 1 → 우승 자동확정 보류(winner_finalized=false)');
SELECT is(                                                                   -- [15]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'active', 'H12: 확정 보류로 대회 status=active 유지(completed 아님)');

SELECT * FROM finish();
ROLLBACK;
