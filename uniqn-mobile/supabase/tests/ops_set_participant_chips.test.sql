-- ops 결함① — ops_set_participant_chips: actor 가드·비멤버·미존재·값 범위(0/음수/상한/NULL)·
--   active 성공(대회 upcoming 이어도 허용 = 대회 status 게이트 없음)·이벤트 payload·
--   live_stats.total_chips 반영·동일값 no-op(이벤트 0행)·checked_in 허용·busted 거부·anon REVOKE.
-- [가드] 최신 player_chips_set 선별은 seq DESC(전순서 키) — created_at 은 txn 시작 고정이라 동률 시 비결정.
-- [가드] SET CONSTRAINTS ALL IMMEDIATE 없이는 live_stats DEFERRED 트리거가 ROLLBACK 으로 끝나
--   "total_chips 반영" 단언이 빈 통과한다(ops_live_stats_deferred.test.sql 규율).
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
  player_ids := public.ops_test_seed_players(s.tournament_id, 2);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── actor 가드: member 세션이 owner 명의로 호출 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 45000) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');

-- ── 비멤버(outsider) 거부 ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [2]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.outsider_id'))::uuid, 45000) $$,
  'PERMISSION_DENIED%', '비멤버는 PERMISSION_DENIED');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 미존재 참가자 ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_set_participant_chips('00000000-0000-0000-0000-0000000000ff'::uuid,
       (current_setting('ops.owner_id'))::uuid, 45000) $$,
  'PARTICIPANT_NOT_FOUND%', '미존재 참가자 거부');

-- ── 값 범위: 0 · 음수 · 상한 초과 · NULL ──
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 0) $$,
  'CHIPS_INVALID%', '0칩 거부(탈락은 bust 경로)');
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, -1) $$,
  'CHIPS_INVALID%', '음수 거부');
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 2000000001) $$,
  'CHIPS_INVALID%', '상한(20억) 초과 거부');
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, NULL) $$,
  'CHIPS_INVALID%', 'NULL 거부');

-- ── active 성공: 시드 대회 status=upcoming 그대로 → 대회 status 게이트가 없음을 실증 ──
DO $$
DECLARE r jsonb; v_total_before bigint;
BEGIN
  SELECT total_chips INTO v_total_before FROM public.ops_live_stats
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid;
  PERFORM set_config('ops.total_before', v_total_before::text, true);
  SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 45000) INTO r;
  PERFORM set_config('ops.r_before', (r->>'chips_before'), true);
END $$;
SELECT is(                                                                   -- [8]
  (SELECT chips FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  45000, 'upcoming 대회 + active 참가자: chips 반영(대회 게이트 없음)');
SELECT is(current_setting('ops.r_before')::int, 30000,                       -- [9]
  '반환 chips_before=30000(시드 starting_chips)');
SELECT is(                                                                   -- [10]
  (SELECT (payload->>'chips_before')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_chips_set'
   ORDER BY seq DESC LIMIT 1),
  30000, 'player_chips_set payload.chips_before(원장 레벨)');
SELECT is(                                                                   -- [11]
  (SELECT (payload->>'chips_after')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_chips_set'
   ORDER BY seq DESC LIMIT 1),
  45000, 'player_chips_set payload.chips_after(원장 레벨)');
SELECT is(                                                                   -- [12]
  (SELECT total_chips FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.total_before'))::bigint + 15000,
  'live_stats.total_chips 자동 재계산(+15000)');

-- ── 동일값 = 멱등 no-op(이벤트 0행 증가) ──
DO $$
DECLARE v_cnt int; r jsonb;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_chips_set';
  PERFORM set_config('ops.evt_before', v_cnt::text, true);
  SELECT public.ops_set_participant_chips((current_setting('ops.seed_pid'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 45000) INTO r;  -- 같은 값
  -- no-op 은 변경 경로와 별도의 RETURN 이라 키가 따로 썩을 수 있다. 클라 zod 가 chips_before 를
  -- 필수로 parse 하므로(OpsParticipantRepository), 누락되면 흔한 '무변경 저장'이 에러 토스트가 된다.
  PERFORM set_config('ops.noop_before', COALESCE(r->>'chips_before', '<missing>'), true);
  PERFORM set_config('ops.noop_chips',  COALESCE(r->>'chips', '<missing>'), true);
END $$;
SELECT is(                                                                   -- [13]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_chips_set'),
  (current_setting('ops.evt_before'))::int, '동일값 재입력은 이벤트 0행(감사 로그 오염 방지)');
SELECT is(current_setting('ops.noop_before'), '45000',                       -- [13b]
  'no-op 반환에도 chips_before 포함(클라 zod 필수 키)');
SELECT is(current_setting('ops.noop_chips'), '45000',                        -- [13c]
  'no-op 반환에도 chips 포함');

-- ── checked_in(대기) 허용 — RedrawModal 재배치 풀에 포함되므로 정정 대상 ──
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'checked_in'
    WHERE id = (current_setting('ops.p2'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_set_participant_chips((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 12345);
END $$;
SELECT is(                                                                   -- [14]
  (SELECT chips FROM public.ops_participants WHERE id = (current_setting('ops.p2'))::uuid),
  12345, 'checked_in(대기) 참가자도 칩 수정 허용');

-- ── busted 거부 ──
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted', chips = 0
    WHERE id = (current_setting('ops.p1'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [15]
  $$ SELECT public.ops_set_participant_chips((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000) $$,
  'PARTICIPANT_NOT_ACTIVE%', 'busted 참가자 거부(bust/undo 원자 경로 보호)');

-- ── 권한: anon REVOKE / authenticated GRANT (=2 불변 계약) ──
SELECT ok(                                                                   -- [16]
  NOT has_function_privilege('anon',
    'public.ops_set_participant_chips(uuid,uuid,integer)', 'EXECUTE'),
  'anon cannot EXECUTE ops_set_participant_chips');
SELECT ok(                                                                   -- [17]
  has_function_privilege('authenticated',
    'public.ops_set_participant_chips(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated can EXECUTE ops_set_participant_chips');

SELECT * FROM finish();
ROLLBACK;
