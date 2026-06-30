-- ops_reenter_participant pgTAP 검증:
--   ① bust→재진입: chips=starting_chips(30000), finish_position/busted_at/prize_amount NULL, status=active
--   ② reentries 정확히 +1 (반환값·DB 2중 확인)
--   ③ reentry_allowed=false → REENTRY_NOT_ALLOWED (P0001)
--   ④ max_reentries=0, reentries=1 → MAX_REENTRIES_EXCEEDED (P0001)
--   ⑤ not-busted(active) 참가자 재진입 → PARTICIPANT_NOT_BUSTED (P0001)
--   ⑥ completed 대회 재진입 → INVALID_STATUS (P0001)
--   ⑦ actor 가드 2종(위조 member·비멤버 outsider) → PERMISSION_DENIED (P0001)
--   auto-seat: 빈좌석 2개 → seated=true / status=active 자동배정
--
-- 패턴: ops_bust_participant.test.sql (set_config 보관·throws_ok P0001)
--       ops_clock_state.test.sql (actor 가드 2종)
-- ⚠️ 시드 주의사항:
--   - ops_test_seed 기본 status='upcoming' → DO 블록(postgres 역할)에서 active 전환 필수
--   - 2명만 active + bust = 우승확정→completed → 정상 재진입 케이스는 3명 이상 필요
--     → ops_test_seed_players(t, 2) 로 총 active 3 확보, 1명 bust 후 2명 잔존
--   - ⑥ 시나리오: 별도 completed 대회 수동 시드(postgres 역할로 직접 INSERT)

BEGIN;
SELECT plan(15);

-- ── 시드 ──────────────────────────────────────────────────────────────────────
-- ops_test_seed: owner·member·outsider·tournament(upcoming)·participant 1명(active)·빈좌석 2개.
-- ops_test_seed_players: active 2명 추가 → 총 3명 (seed_pid + p0 + p1).
-- t2: completed 대회 + busted 참가자 1명(⑥ 시나리오 전용).
DO $$
DECLARE
  s           RECORD;
  player_ids  uuid[];
  v_t2        uuid := gen_random_uuid();
  v_t2_jp     uuid := gen_random_uuid();
  v_t2_p      uuid := gen_random_uuid();
  v_t2_winner uuid := gen_random_uuid();
  v_work_date date := current_date + 14;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',   s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text,    true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text,  true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);

  -- 대회 upcoming → active 전환 (authenticated 역할은 ops_tournaments UPDATE REVOKE됨 → postgres에서 설정)
  UPDATE public.ops_tournaments
    SET status = 'active', reentry_allowed = true, max_reentries = NULL
    WHERE id = s.tournament_id;

  -- active 참가자 2명 추가 → 총 3명 (seed_pid + p0 + p1) → bust 1명 후 2명 잔존(우승확정 안됨)
  player_ids := public.ops_test_seed_players(s.tournament_id, 2);
  PERFORM set_config('ops.p0', player_ids[1]::text, true);
  PERFORM set_config('ops.p1', player_ids[2]::text, true);

  -- ⑥ 시나리오용: completed 대회(t2) 수동 시드 — postgres 역할로 직접 INSERT
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_t2_jp, s.owner_id, 'ops owner', s.workspace_id, 'completed cup posting', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 2, 0, 0, 3, '+82101111112', now(), now()
  );
  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq, status
  ) VALUES (
    v_t2, s.owner_id, v_t2_jp, 'completed cup', 'NLH', 30000, false, 2, 'completed'
  );
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, finish_position)
  VALUES (v_t2_p,      v_t2, 1, 'Busted Player', 'busted', 0, 2),
         (v_t2_winner, v_t2, 2, 'Winner',         'active', 30000, 1);
  PERFORM set_config('ops.t2_pid', v_t2_p::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── ⑦ actor 가드 ─────────────────────────────────────────────────────────────
-- 가드①: 위조 actor — member 가 owner 명의로 호출 → auth.uid() ≠ p_actor_id → PERMISSION_DENIED
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(                                                        -- [1]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  '%PERMISSION_DENIED%',
  '⑦ actor 가드: member→owner 명의 위조 거부 (PERMISSION_DENIED)');

-- 가드②: 비멤버 outsider — 본인 명의라도 is_ops_member=false → PERMISSION_DENIED
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                        -- [2]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  '%PERMISSION_DENIED%',
  '⑦ actor 가드: 비멤버 outsider 거부 (PERMISSION_DENIED)');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── ⑤ not-busted(active) 참가자 재진입 → PARTICIPANT_NOT_BUSTED ──────────────
-- p0 는 현재 active → 재진입 불가
SELECT throws_like(                                                        -- [3]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  '%PARTICIPANT_NOT_BUSTED%',
  '⑤ active 참가자 재진입 거부: PARTICIPANT_NOT_BUSTED');

-- ── p0 탈락 처리 (3명 active → 2명 잔존, 우승확정 안됨) ─────────────────────────
SELECT public.ops_bust_participant(
  (current_setting('ops.p0'))::uuid,
  (current_setting('ops.owner_id'))::uuid);

-- ── ①② p0 재진입 — 상태 복원 + 카운터 + auto-seat ────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_reenter_participant(
    (current_setting('ops.p0'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_reentries', (r->>'reentries'), true);
  PERFORM set_config('ops.r_status',    (r->>'status'),    true);
  PERFORM set_config('ops.r_seated',    (r->>'seated'),    true);
END $$;

-- ① DB 상태 검증: chips=30000, finish_position/busted_at/prize_amount=NULL, status=active
SELECT is(                                                                 -- [4]
  (SELECT chips FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  30000,
  '①: chips = starting_chips(30000) 복원');

SELECT is(                                                                 -- [5]
  (SELECT finish_position FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  NULL::integer,
  '①: finish_position NULL 초기화');

SELECT is(                                                                 -- [6]
  (SELECT busted_at FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  NULL::timestamptz,
  '①: busted_at NULL 초기화');

SELECT is(                                                                 -- [7]
  (SELECT prize_amount FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  NULL::integer,
  '①: prize_amount NULL 초기화');

SELECT is(current_setting('ops.r_status'), 'active',                      -- [8]
  '①: auto-seat 성공 → 반환 status=active (빈좌석 2개 확보됨)');

SELECT is(                                                                 -- [9]
  (SELECT status FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  'active',
  '①: DB status=active 복원');

-- ② reentries 카운터 정확히 +1 (반환값 + DB 2중 확인)
SELECT is(current_setting('ops.r_reentries')::int, 1,                     -- [10]
  '②: 반환값 reentries=1 (최초 재진입)');

SELECT is(                                                                 -- [11]
  (SELECT reentries FROM public.ops_participants
   WHERE id = (current_setting('ops.p0'))::uuid),
  1,
  '②: DB reentries=1 영속화');

-- auto-seat: seated=true (빈좌석 배정 성공)
SELECT is(current_setting('ops.r_seated'), 'true',                        -- [12]
  'auto-seat: seated=true (테이블 open/none, 빈좌석 확보)');

-- ── ③ reentry_allowed=false → REENTRY_NOT_ALLOWED ─────────────────────────────
-- p0 재탈락(3명 active 복귀 확인: seed_pid·p0·p1 → bust p0 → 2명 잔존, 우승확정 안됨)
SELECT public.ops_bust_participant(
  (current_setting('ops.p0'))::uuid,
  (current_setting('ops.owner_id'))::uuid);

-- authenticated 역할은 ops_tournaments UPDATE REVOKE → postgres 역할로 전환 후 설정
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments SET reentry_allowed = false
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

SELECT throws_like(                                                        -- [13]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  '%REENTRY_NOT_ALLOWED%',
  '③ reentry_allowed=false → REENTRY_NOT_ALLOWED');

-- ── ④ max_reentries=0 → MAX_REENTRIES_EXCEEDED ──────────────────────────────
-- p0.reentries=1 (① 에서 1회 재진입) , max_reentries=0 → 1 >= 0 → 초과
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments
  SET reentry_allowed = true, max_reentries = 0
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

SELECT throws_like(                                                        -- [14]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.p0'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  '%MAX_REENTRIES_EXCEEDED%',
  '④ max_reentries=0, reentries=1 → MAX_REENTRIES_EXCEEDED');

-- ── ⑥ completed 대회 재진입 → INVALID_STATUS ──────────────────────────────────
-- t2: 수동 시드된 completed 대회, t2_pid: busted 참가자
-- is_ops_member(t2, owner) = true (t2.owner_id = owner_id) → 멤버십 통과 후 status 검증
SELECT throws_like(                                                        -- [15]
  $$ SELECT public.ops_reenter_participant(
       (current_setting('ops.t2_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  '%INVALID_STATUS%',
  '⑥ completed 대회 재진입 → INVALID_STATUS');

SELECT * FROM finish();
ROLLBACK;
