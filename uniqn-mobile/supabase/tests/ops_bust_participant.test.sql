-- ops_bust_participant pgTAP 검증:
--   ① finish_position 단조, ② 이중bust 거부, ③ 부분UNIQUE 23505, ④ 우승자동확정,
--   ⑤ tournament completed, ⑥ live_stats.playing 감소, ⑦ 마지막생존자 거부,
--   ⑧ ITM prize 매핑, ⑨ 재진입후 재탈락 충돌없음, actor 가드 3종
-- 패턴: ops_clock_state.test.sql (set_config/actor 가드·throws_ok),
--       ops_entry_number_allocation.test.sql (UNIQUE 충돌·역할 전환).
-- 주의: pgTAP 단일 트랜잭션 → ROLLBACK 으로 시드 정리.
--   plan(N) = 실제 SELECT 단언 수와 정확히 일치(불일치 시 pgTAP fail).

BEGIN;
SELECT plan(22);

-- ── 시드 ──────────────────────────────────────────────────────────────────────
-- ops_test_seed: owner(employer)·member(employer)·outsider(staff)·tournament·participant 1명(active).
-- ops_test_seed_players: active 참가자 4명 추가 → 총 5명 active.
DO $$
DECLARE
  s          RECORD;
  player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',   s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text,    true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text,  true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);

  -- 대회 upcoming → active 전환 (ops_test_seed 기본값=upcoming, bust 는 active 만 허용).
  -- 초기 DO 블록(postgres 역할)에서 실행 — authenticated 는 ops_tournaments UPDATE REVOKE.
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;

  player_ids := public.ops_test_seed_players(s.tournament_id, 4);
  PERFORM set_config('ops.p0', player_ids[1]::text, true);
  PERFORM set_config('ops.p1', player_ids[2]::text, true);
  PERFORM set_config('ops.p2', player_ids[3]::text, true);
  PERFORM set_config('ops.p3', player_ids[4]::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 상금 구조 설정: rank 1-4 (rank 5 는 미설정 → out of money)
SELECT public.ops_set_prize_structure(
  (current_setting('ops.t_id'))::uuid,
  (current_setting('ops.owner_id'))::uuid,
  '[{"rank":1,"amount":500000},{"rank":2,"amount":300000},
    {"rank":3,"amount":200000},{"rank":4,"amount":100000}]'::jsonb);

-- ── A. actor 가드 ─────────────────────────────────────────────────────────────
-- 가드(1): 위조 actor — member 가 owner 명의로 호출 → auth.uid() IS DISTINCT FROM p_actor_id → P0001
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_bust_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL,
  'actor 가드: member→owner 명의 위조 거부 (PERMISSION_DENIED P0001)');

-- 가드(2): 비멤버 outsider — 본인 명의라도 is_ops_member=false → P0001
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_bust_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL,
  'actor 가드: 비멤버 outsider 거부 (PERMISSION_DENIED P0001)');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── B. Bust p0: 5명 active → finish_position=5, prize=NULL, winner_finalized=false ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant(
    (current_setting('ops.p0'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_fp',     (r->>'finish_position'),              true);
  PERFORM set_config('ops.r_prize',  COALESCE(r->>'prize_amount', 'null'), true);
  PERFORM set_config('ops.r_winner', (r->>'winner_finalized'),             true);
END $$;

SELECT is(current_setting('ops.r_fp')::int, 5,                              -- [3]
  'bust#1: 5명 active → finish_position=5 (단조 시작)');

SELECT is(current_setting('ops.r_prize'), 'null',                           -- [4]
  'bust#1: rank 5 상금 미설정 → prize_amount null (out of money)');

SELECT is(current_setting('ops.r_winner'), 'false',                         -- [5]
  'bust#1: winner_finalized=false (잔존 4명)');

-- ── C. live_stats.playing 감소 확인 ───────────────────────────────────────────
SELECT is(                                                                   -- [6]
  (SELECT playing FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  4,
  'live_stats.playing=4: 1차 bust 후 (트리거 재계산)');

-- ── D. 이중bust 거부 ───────────────────────────────────────────────────────────
SELECT throws_ok(                                                            -- [7]
  $$ SELECT public.ops_bust_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL,
  '이중bust 거부: PARTICIPANT_ALREADY_BUSTED (P0001)');

-- ── E. 부분UNIQUE (tournament_id, finish_position) 직접 충돌 → 23505 ──────────
-- 이미 finish_position=5 가 p0 에 사용됨 → 동일 조합 INSERT 는 23505.
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
SELECT throws_ok(                                                            -- [8]
  $$ INSERT INTO public.ops_participants
       (tournament_id, entry_number, name, status, chips, finish_position)
     VALUES (
       (current_setting('ops.t_id'))::uuid,
       999, 'dup_fp_test', 'busted', 0, 5) $$,
  '23505', NULL,
  '부분UNIQUE: (tournament_id, finish_position=5) 중복 INSERT → 23505');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── F. ITM prize 매핑: bust p1 (4명 active → fp=4, prize=100000) ──────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant(
    (current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r1_fp',    (r->>'finish_position'),              true);
  PERFORM set_config('ops.r1_prize', COALESCE(r->>'prize_amount', 'null'), true);
END $$;

SELECT is(current_setting('ops.r1_fp')::int, 4,                            -- [NEW-m1]
  'bust#2: 4명 active → finish_position=4 (단조 직접 단언)');

SELECT is(current_setting('ops.r1_prize'), '100000',                        -- [9]
  'ITM prize: bust p1 rank4 → prize_amount=100000 (반환값)');

SELECT is(                                                                   -- [10]
  (SELECT prize_amount FROM public.ops_participants
   WHERE id = (current_setting('ops.p1'))::uuid),
  100000,
  'ITM prize: participant.prize_amount=100000 DB 반영');

-- ── G. 단조 확인 + live_stats: bust p2 (3명 active → fp=3, prize=200000) ───────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant(
    (current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r2_fp', (r->>'finish_position'), true);
END $$;

SELECT is(current_setting('ops.r2_fp')::int, 3,                             -- [11]
  '단조: 3명 active → finish_position=3 (5>4>3 단조 감소)');

SELECT is(                                                                   -- [12]
  (SELECT playing FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  2,
  'live_stats.playing=2: 3차 bust 후 (seed·p3 잔존)');

-- ── H. 마지막생존자 거부 ───────────────────────────────────────────────────────
-- p3 를 임시 busted 로 직접 세팅(RPC 우회) → seed 만 active(1명) → LAST_SURVIVOR 트리거.
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_participants SET status = 'busted'
  WHERE id = (current_setting('ops.p3'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

SELECT throws_ok(                                                            -- [13]
  $$ SELECT public.ops_bust_participant(
       (current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL,
  '마지막생존자 거부: active 1명 → PARTICIPANT_LAST_SURVIVOR (P0001)');

-- p3 복구 → active 2명 (seed·p3) 복원
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_participants SET status = 'active'
  WHERE id = (current_setting('ops.p3'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── I. 재진입후 재탈락 충돌없음 ───────────────────────────────────────────────
-- p1(busted fp=4) 재진입 → fp 초기화(NULL)·active 복귀 → 총 3명 active(seed·p1·p3).
-- 재진입+재bust 전체를 lives_ok 로 감싸 pgTAP 리포트에 23505 미발생을 명시.
-- 사용 fp={3,5}; generate_series(3,5)→ 3(사용)·4(빈)·5(사용) → fp=4.
-- 부분UNIQUE 인덱스에 fp=4 는 이미 p1 이 소거(NULL)했으므로 충돌 없음.
SELECT lives_ok($TEST$                                                       -- [NEW-I2]
  DO $$
  DECLARE r jsonb;
  BEGIN
    PERFORM public.ops_reenter_participant(
      (current_setting('ops.p1'))::uuid,
      (current_setting('ops.owner_id'))::uuid);
    SELECT public.ops_bust_participant(
      (current_setting('ops.p1'))::uuid,
      (current_setting('ops.owner_id'))::uuid) INTO r;
    PERFORM set_config('ops.r3_fp', (r->>'finish_position'), true);
  END $$
$TEST$, '재진입후 재탈락: 부분UNIQUE 23505 미발생');

SELECT is(current_setting('ops.r3_fp')::int, 4,                             -- [14]
  '재진입후 재탈락: finish_position=4 (부분UNIQUE 충돌없음, 이전 fp 소거됨)');

-- ── J. 우승자동확정 + tournament completed ──────────────────────────────────────
-- bust p3 (2명 active: seed·p3 → 1명 남음 → 우승 자동확정).
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant(
    (current_setting('ops.p3'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r4_winner', (r->>'winner_finalized'), true);
END $$;

SELECT is(current_setting('ops.r4_winner'), 'true',                         -- [15]
  '우승자동확정: bust p3 후 winner_finalized=true (active 1명 잔존)');

SELECT is(                                                                   -- [16]
  (SELECT status::text FROM public.ops_tournaments
   WHERE id = (current_setting('ops.t_id'))::uuid),
  'completed',
  'tournament.status=completed: 우승 확정 후 자동 전환');

-- [I1] 우승자 DB 상태 3종 검증: finish_position=1·prize_amount=500000·status=active
SELECT is(                                                                   -- [NEW-I1-a]
  (SELECT finish_position FROM public.ops_participants
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND status = 'active'),
  1,
  '우승자 finish_position=1: 우승 자동확정 후 DB 반영');

SELECT is(                                                                   -- [NEW-I1-b]
  (SELECT prize_amount FROM public.ops_participants
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND status = 'active'),
  500000,
  '우승자 prize_amount=500000: rank1 상금 DB 반영');

SELECT is(                                                                   -- [NEW-I1-c]
  (SELECT status::text FROM public.ops_participants
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND finish_position = 1),
  'active',
  '우승자 status=active: 우승자는 busted 처리 안됨');

-- ── K. 비-active(completed) 대회 bust 거부 ────────────────────────────────────
-- tournament completed 상태 → INVALID_STATUS P0001.
SELECT throws_ok(                                                            -- [17]
  $$ SELECT public.ops_bust_participant(
       (current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL,
  '비-active 대회 bust 거부: completed → INVALID_STATUS (P0001)');

SELECT * FROM finish();
ROLLBACK;
