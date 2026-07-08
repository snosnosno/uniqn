-- ops 1f — ops_correct_participant_prize: active/completed 허용·upcoming 거부·fp NULL 거부·
--   NULL 회수·비ITM 부여·음수 거부·reason 201자 거부·no-op 이벤트·payload(amount_before 포함 🔨H21)·
--   reenter 리셋 계약·actor 가드·비멤버 에러 균일(🔨H1).
-- [가드2] 최신 prize_corrected 선별은 seq DESC(전순서 키) — created_at 은 txn 시작 고정이라 다중 이벤트 동률→비결정.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(17);

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

-- ── upcoming 거부 (시드 기본 status=upcoming) ──
SELECT throws_like(                                                          -- [1]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 100000, NULL) $$,
  'INVALID_STATUS%', 'upcoming 대회 정정 거부');

-- ── 🔨H1 비멤버 × upcoming 대회: status 무관하게 PERMISSION_DENIED(에러 차등 오라클 차단) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [1b]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.outsider_id'))::uuid, 100000, NULL) $$,
  'PERMISSION_DENIED%', 'H1: 비멤버는 upcoming 이어도 PERMISSION_DENIED(INVALID_STATUS 아님)');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- active 전환 + p1 bust(fp=3·상금 없음), 상금 구조 rank1=500000 설정
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tournaments SET status = 'active'
    WHERE id = (current_setting('ops.t_id'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_set_prize_structure((current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid, '[{"rank":1,"amount":500000}]'::jsonb);
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, NULL) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── fp NULL 거부 (active 인 p2) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, NULL) $$,
  'PRIZE_CORRECTION_INVALID%', 'fp NULL(비정산 대상) 거부');

-- ── 값 검증: 음수·201자 reason ──
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, -1, NULL) $$,
  'PRIZE_CORRECTION_INVALID%', '음수 금액 거부');
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, repeat('가', 201)) $$,
  'PRIZE_CORRECTION_INVALID%', 'reason 201자 거부');

-- ── active 중 부여(비ITM자 수동 지급: NULL→50000) + payload ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 50000, '딜러 실수 보상') INTO r;
  PERFORM set_config('ops.r_before', COALESCE(r->>'amount_before', 'null'), true);
  PERFORM set_config('ops.r_after',  (r->>'amount_after'), true);
END $$;
SELECT is(current_setting('ops.r_before'), 'null', '부여: amount_before=null(비ITM)');    -- [6]
SELECT is(current_setting('ops.r_after')::int, 50000, '부여: amount_after=50000');        -- [7]
SELECT is(                                                                   -- [8]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  50000, '부여: DB prize_amount 반영');
SELECT is(                                                                   -- [9]
  (SELECT payload->>'reason' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY seq DESC LIMIT 1),
  '딜러 실수 보상', 'prize_corrected payload.reason 기록');

-- ── no-op 도 이벤트 기록(감사 명료성) ──
DO $$
DECLARE v_cnt_before int;
BEGIN
  SELECT count(*) INTO v_cnt_before FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected';
  PERFORM set_config('ops.evt_before', v_cnt_before::text, true);
  PERFORM public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 50000, NULL);  -- 같은 값 = no-op
END $$;
SELECT is(                                                                   -- [10]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'),
  (current_setting('ops.evt_before'))::int + 1, 'no-op 정정도 이벤트 기록');

-- ── reenter 가 정정값 리셋(1d 계약 실증 — E5) ──
DO $$ BEGIN
  PERFORM public.ops_reenter_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(                                                                   -- [11]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  NULL, 'reenter: 정정값 리셋(이력은 이벤트 원장에만 잔존)');

-- ── completed 후에도 허용(D3): p1·p2 bust → 우승 자동확정 → 우승자 정정 + 회수 ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);  -- seed 만 active → 우승확정·completed
END $$;
SELECT is(                                                                   -- [12]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'completed', '전제: 우승 자동확정으로 completed');
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 450000, '동점 조정') INTO r;
  PERFORM set_config('ops.r2_before', (r->>'amount_before'), true);
END $$;
SELECT is(current_setting('ops.r2_before')::int, 500000,                     -- [13]
  'D3: completed 후 정정 허용(우승 상금 500000→450000)');
-- 🔨H21: 이벤트 payload 의 amount_before 가 실제 이전값으로 기록됨(감사 원장 레벨 고정 —
--   반환값만 검증하면 payload 키 뒤바뀜/누락이 무증상 통과)
SELECT is(                                                                   -- [13b]
  (SELECT (payload->>'amount_before')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY seq DESC LIMIT 1),
  500000, 'H21: prize_corrected payload.amount_before=500000(원장 레벨)');
-- 회수(p_amount NULL): "수상 아님" 복귀
DO $$ BEGIN
  PERFORM public.ops_correct_participant_prize((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL, '실격');
END $$;
SELECT is(                                                                   -- [14]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p2'))::uuid),
  NULL, '회수: p_amount NULL → prize_amount NULL');
SELECT is(                                                                   -- [15]
  (SELECT payload->>'amount_after' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY seq DESC LIMIT 1),
  NULL, '회수: payload.amount_after=null');

SELECT * FROM finish();
ROLLBACK;
