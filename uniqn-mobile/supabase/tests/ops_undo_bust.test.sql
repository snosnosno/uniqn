-- ops 1f — ops_undo_bust: 복원 4필드·좌석 3분기·KO 감소·GREATEST 0·completed 거부(D2)·
--   비busted 거부·undo 후 재bust fp 값 단언(🔨H10)·최신 이벤트 판별(🔨H11 칩 변동)·이벤트 append·
--   actor 가드·비멤버 에러 균일(🔨H1).
-- 시드: active 4명 + 좌석 2개(원좌석/auto 분기 실증). 재진입과의 구분(reentries 불변) 단언 포함.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(19);

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
  PERFORM set_config('ops.seat2',       s.seat2_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  player_ids := public.ops_test_seed_players(s.tournament_id, 3);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
  PERFORM set_config('ops.p3', player_ids[3]::text, true);
  -- p1 착석(원좌석 복원 실증)
  UPDATE public.ops_seats SET participant_id = player_ids[1] WHERE id = s.seat1_id;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── KO bust: p1(칩 30000, seat1) 을 seed 가 KO ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid);
END $$;

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'actor 가드: 비멤버 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 비-busted 거부 (active 참가자) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'UNDO_INVALID_STATE%', '비-busted 참가자 undo 거부');

-- ── undo: 원좌석 복원 + 복원 4필드 + KO 감소 + reentries 불변 ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_chips',  (r->>'restored_chips'), true);
  PERFORM set_config('ops.r_status', (r->>'status'), true);
  PERFORM set_config('ops.r_seated', (r->>'seated'), true);
END $$;
SELECT is(current_setting('ops.r_chips')::int, 30000, 'undo: 칩 = bust 직전 값 복원');   -- [4]
SELECT is(current_setting('ops.r_status'), 'active', 'undo: 원좌석 확보 → active');       -- [5]
SELECT is(                                                                   -- [6]
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.seat1'))::uuid),
  (current_setting('ops.p1'))::uuid, 'undo: 원좌석(seat1) 복원');
SELECT is(                                                                   -- [7]
  (SELECT finish_position IS NULL AND busted_at IS NULL AND prize_amount IS NULL
   FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  true, 'undo: fp/busted_at/prize_amount 전부 NULL');
SELECT is(                                                                   -- [8]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  0, 'undo: eliminator(seed) knockouts 1→0 롤백');
SELECT is(                                                                   -- [9]
  (SELECT reentries FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  0, 'undo: reentries 불변(재진입과 구분)');
SELECT is(                                                                   -- [10]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_bust_undone'
     AND payload->>'seat_restored' = 'original'),
  1, 'undo: player_bust_undone 이벤트 append(seat_restored=original)');

-- ── 🔨H11 최신 이벤트 판별: 리바이로 칩 변동(30000→60000) 후 재bust·undo — 복원값이 60000 이면
--    seq DESC 가 최신 이벤트를 집은 것(과거 이벤트 30000 과 판별. created_at 은 txn 내 동률이라 무력) ──
DO $$ BEGIN
  PERFORM public.ops_add_rebuy((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);  -- rebuy_chips=30000 → chips 60000
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_h11_chips', (r->>'restored_chips'), true);
END $$;
SELECT is(current_setting('ops.r_h11_chips')::int, 60000,                    -- [11]
  'H11: 최신 bust 이벤트(chips_before=60000) 복원 — seq 전순서 판별(과거 30000 아님)');

-- ── GREATEST 0 방어: knockouts=0 인 seed 를 eliminator 로 재-undo 시나리오 —
--    p1 재bust(eliminator=seed) 후 postgres 로 seed.knockouts 를 0 으로 강제 → undo → 0 유지(음수 금지)
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET knockouts = 0
    WHERE id = (current_setting('ops.seed_pid'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(                                                                   -- [12]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  0, 'undo: GREATEST(knockouts-1, 0) — 0 미만 방지(CHECK 위반 방어)');

-- ── auto-seat 분기: p1 의 원좌석을 다른 참가자가 점유 → auto 로 seat2 배정 ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p2'))::uuid
    WHERE id = (current_setting('ops.seat1'))::uuid;  -- 원좌석 선점
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r2_seated', (r->>'seated'), true);
END $$;
SELECT is(current_setting('ops.r2_seated'), 'true', 'undo: 원좌석 점유 시 auto-seat 폴백');  -- [13]
SELECT is(                                                                   -- [14]
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.seat2'))::uuid),
  (current_setting('ops.p1'))::uuid, 'undo: auto 분기 — seat2 배정');

-- ── 🔨H10 재bust fp 값 단언(무좌석 분기 셋업 겸용): p1 은 지금 seat2 에 active ──
-- active 4명(seed·p1·p2·p3)·사용 fp 없음(전부 undo 로 소거) → fp=4 가 미사용 최소값.
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL) INTO r;
  PERFORM set_config('ops.r_refp', (r->>'finish_position'), true);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p3'))::uuid
    WHERE id = (current_setting('ops.seat2'))::uuid;  -- 좌석 전부 점유(seat1=p2, seat2=p3)
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(current_setting('ops.r_refp')::int, 4,                             -- [15]
  'H10: undo 후 재bust — fp=4(미사용 최소값 값 단언, 부분 UNIQUE 무충돌)');

-- ── 무좌석 분기: 빈좌석 0 → checked_in ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r3_status', (r->>'status'), true);
END $$;
SELECT is(current_setting('ops.r3_status'), 'checked_in',                    -- [16]
  'undo: 빈좌석 없음 → checked_in(register v2 관례)');

-- ── completed 거부(D2) — 🔨H12 보류 가드 대응: p1(checked_in) 잔존 시 자동확정이 보류되므로
--    postgres 로 p1 을 busted(fp 미부여)로 정리한 뒤 p2·p3 bust 로 우승 자동확정 도달 ──
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted'
    WHERE id = (current_setting('ops.p1'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM public.ops_bust_participant((current_setting('ops.p3'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;
SELECT is(                                                                   -- [17]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'completed', '전제: 우승 자동확정으로 completed(checked_in 0 이라 보류 미발동)');
SELECT throws_like(                                                          -- [18]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p3'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'INVALID_STATUS%', 'D2: completed 대회 undo 거부(우승 자동확정 시나리오 실증)');

-- ── 🔨H1 비멤버 × completed 대회: status 무관하게 PERMISSION_DENIED(에러 차등 오라클 차단) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [19]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p3'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'PERMISSION_DENIED%', 'H1: 비멤버는 completed 여도 PERMISSION_DENIED(INVALID_STATUS 아님)');

SELECT * FROM finish();
ROLLBACK;
