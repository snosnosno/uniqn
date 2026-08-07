-- ops 결함② — ops_set_participant_no_show: actor 가드·비멤버·미존재·NULL 플래그·
--   상태 게이트(active/busted 거부)·checked_in→no_show 성공·이벤트 payload·
--   live_stats 불변·멱등 no-op(양방향)·되돌리기(no_show→checked_in)·좌석 점유 거부·anon REVOKE.
-- [가드] 최신 이벤트 선별은 seq DESC(전순서 키) — created_at 은 txn 시작 고정이라 동률 시 비결정.
-- [가드] SET CONSTRAINTS ALL IMMEDIATE 없이는 live_stats DEFERRED 트리거가 ROLLBACK 으로 끝나
--   "playing 불변" 단언이 빈 통과한다(ops_live_stats_deferred.test.sql 규율).
-- [가드] RLS 테이블의 "0건"은 "안 보인다"일 수 있다 — 상태·이벤트 단언은 모두 owner 세션에서 한다.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(20);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);  -- active(착석 아님)
  PERFORM set_config('ops.seat1',       s.seat1_id::text, true);
  player_ids := public.ops_test_seed_players(s.tournament_id, 3);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);  -- checked_in 으로 전환해 주 경로에 사용
  PERFORM set_config('ops.p2', player_ids[2]::text, true);  -- busted 로 전환해 게이트 검증
  PERFORM set_config('ops.p3', player_ids[3]::text, true);  -- checked_in + 좌석 점유(fail-closed)
END $$;

-- 주 경로 대상(p1)을 대기 상태로. postgres role 에서 직접 UPDATE(전환 RPC 가 없는 상태를 만든다).
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'checked_in'
    WHERE id IN ((current_setting('ops.p1'))::uuid, (current_setting('ops.p3'))::uuid);
  UPDATE public.ops_participants SET status = 'busted', chips = 0
    WHERE id = (current_setting('ops.p2'))::uuid;
  -- p3 만 좌석 점유(데이터 불일치 재현 — checked_in 은 정의상 미착석)
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p3'))::uuid
    WHERE id = (current_setting('ops.seat1'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── actor 가드: member 세션이 owner 명의로 호출 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');

-- ── 비멤버(outsider) 거부 ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [2]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
       (current_setting('ops.outsider_id'))::uuid, true) $$,
  'PERMISSION_DENIED%', '비멤버는 PERMISSION_DENIED');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 미존재 참가자 ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_set_participant_no_show('00000000-0000-0000-0000-0000000000ff'::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'PARTICIPANT_NOT_FOUND%', '미존재 참가자 거부');

-- ── NULL 플래그: "성공했는데 아무 일도 없음"을 막는다 ──
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, NULL) $$,
  'NO_SHOW_FLAG_INVALID%', 'NULL 플래그 거부');

-- ── 상태 게이트: active 는 노쇼가 아니다(그 경로는 bust) ──
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'PARTICIPANT_NOT_PENDING%', 'active 참가자 노쇼 거부(bust 경로 보호)');

-- ── 상태 게이트: busted 거부 ──
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'PARTICIPANT_NOT_PENDING%', 'busted 참가자 노쇼 거부');

-- ── 좌석 점유 fail-closed ──
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.p3'))::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'PARTICIPANT_SEATED%', '좌석 점유 참가자는 노쇼 거부(유령 좌석 방지)');

-- ── 주 경로: checked_in → no_show ──
DO $$
DECLARE r jsonb; v_playing int;
BEGIN
  SELECT playing INTO v_playing FROM public.ops_live_stats
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid;
  PERFORM set_config('ops.playing_before', v_playing::text, true);
  SELECT public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, true) INTO r;
  PERFORM set_config('ops.mark_before', (r->>'status_before'), true);
  PERFORM set_config('ops.mark_after',  (r->>'status'), true);
END $$;
SELECT is(                                                                   -- [8]
  (SELECT status::text FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  'no_show', 'checked_in → no_show 반영');
SELECT is(current_setting('ops.mark_before'), 'checked_in',                   -- [9]
  '반환 status_before=checked_in');
SELECT is(current_setting('ops.mark_after'), 'no_show', '반환 status=no_show'); -- [10]
SELECT is(                                                                   -- [11]
  (SELECT payload->>'status_before' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_no_show'
   ORDER BY seq DESC LIMIT 1),
  'checked_in', 'player_no_show payload.status_before(원장 레벨)');
SELECT is(                                                                   -- [12]
  (SELECT payload->>'status_after' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_no_show'
   ORDER BY seq DESC LIMIT 1),
  'no_show', 'player_no_show payload.status_after(원장 레벨)');
-- live_stats 는 active 만 센다 → checked_in↔no_show 왕복은 집계에 영향이 없어야 한다.
SELECT is(                                                                   -- [13]
  (SELECT playing FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.playing_before'))::int,
  'live_stats.playing 불변(active 만 세므로 checked_in→no_show 는 무영향)');

-- ── 멱등: 이미 no_show 인데 다시 true ──
DO $$
DECLARE v_cnt int; r jsonb;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_no_show';
  PERFORM set_config('ops.evt_before', v_cnt::text, true);
  SELECT public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, true) INTO r;
  -- no-op 은 변경 경로와 별도의 RETURN 이라 키가 따로 썩을 수 있다(결함① 교훈).
  PERFORM set_config('ops.noop_before', COALESCE(r->>'status_before', '<missing>'), true);
  PERFORM set_config('ops.noop_status', COALESCE(r->>'status', '<missing>'), true);
END $$;
SELECT is(                                                                   -- [14]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_no_show'),
  (current_setting('ops.evt_before'))::int, '이미 no_show 면 이벤트 0행(감사 로그 오염 방지)');
SELECT is(current_setting('ops.noop_before'), 'no_show',                      -- [15]
  'no-op 반환에도 status_before 포함(클라 zod 필수 키)');
SELECT is(current_setting('ops.noop_status'), 'no_show', 'no-op 반환에도 status 포함'); -- [16]

-- ── 되돌리기: no_show → checked_in (active 가 아니다) ──
DO $$ BEGIN
  PERFORM public.ops_set_participant_no_show((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, false);
END $$;
SELECT is(                                                                   -- [17]
  (SELECT status::text FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  'checked_in', '되돌리기는 대기열(checked_in)로 — 좌석 없는 active 를 만들지 않는다');
SELECT is(                                                                   -- [18]
  (SELECT payload->>'status_after' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_no_show_undone'
   ORDER BY seq DESC LIMIT 1),
  'checked_in', 'player_no_show_undone payload.status_after');

-- ── 되돌리기 대상이 아닌 상태에서 취소 시도 ──
SELECT throws_like(                                                          -- [19]
  $$ SELECT public.ops_set_participant_no_show((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, false) $$,
  'PARTICIPANT_NOT_NO_SHOW%', 'active 참가자에게 노쇼 취소는 거부');

-- ── 권한: anon REVOKE (=2 불변 계약) ──
SELECT ok(                                                                   -- [20]
  NOT has_function_privilege('anon',
    'public.ops_set_participant_no_show(uuid,uuid,boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated',
    'public.ops_set_participant_no_show(uuid,uuid,boolean)', 'EXECUTE'),
  'anon 은 EXECUTE 불가 / authenticated 는 가능');

SELECT * FROM finish();
ROLLBACK;
