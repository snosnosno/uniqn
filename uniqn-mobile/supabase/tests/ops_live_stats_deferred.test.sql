-- ops 1f — live_stats DEFERRED 전환 + recompute 신산식(재진입 가산·knockout_pool) 검증.
-- RED-GREEN: 이 파일은 마이그 20260704100100 적용 전엔 [1](tgdeferrable)·[2](stale) 단언이 FAIL(구 AFTER ROW 는 즉시 반영).
-- ⚠️ 무위 시드 금지: 참가자 추가가 실제 entries 를 바꾸는 시드로 stale/반영 차이를 실증.
-- 🔨H9: 시드 active 3명 유지 — bust 후에도 active≥2 라 우승 자동확정(→completed→reenter 폭발) 미발동.
-- 🔨H13: WHEN절 미발화 단언은 센티널 오염 기법(updated_at 은 now()=txn 상수라 무위).
BEGIN;
SELECT plan(13);

-- ── 시드: active 3명(시드 1 + players 1 + 아래 [2]의 900). 초기 recompute 는 명시 호출(결정성) ──
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.t_id',     s.tournament_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  PERFORM public.ops_test_seed_players(s.tournament_id, 1);  -- H9: bust 후에도 active≥2 유지용
  PERFORM public.fn_ops_recompute_live_stats(s.tournament_id);  -- entries=2 기록
END $$;

-- ── [1] 트리거 6종 전부 DEFERRABLE INITIALLY DEFERRED (카탈로그 단언) ──
SELECT is(
  (SELECT count(*)::int FROM pg_trigger
   WHERE tgname IN ('trg_ops_participants_recompute_stats','trg_ops_seats_recompute_stats',
                    'trg_ops_tables_recompute_stats','trg_ops_blind_levels_recompute_stats',
                    'trg_ops_clock_recompute_stats','trg_ops_tournaments_recompute_stats')
     AND tgdeferrable AND tginitdeferred),
  6, 'live_stats 트리거 6종 전부 CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED');

-- ── [2][3] DEFERRED 거동: 같은 txn 에서 참가자 INSERT 후 stale → SET CONSTRAINTS 후 반영 ──
DO $$
BEGIN
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.t_id'))::uuid, 900, 'Deferred P', 'active', 30000);
END $$;
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  2, 'DEFERRED: INSERT 직후 같은 txn 에서 live_stats 는 stale(entries=2 유지)');

SET CONSTRAINTS ALL IMMEDIATE;  -- pending 트리거 즉시 발화 + 이후 문장부터 즉시 모드

SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  3, 'SET CONSTRAINTS ALL IMMEDIATE 후 pending 발화로 entries=3 반영');

-- ── [4] knockouts 컬럼 존재(T1 회귀 앵커) ──
SELECT has_column('public', 'ops_participants', 'knockouts', 'ops_participants.knockouts 존재');

-- ── [5][6] 재진입 가산: reenter 후 prize_pool = (entries + Σreentries) × buy_in ──
-- 시드 buy_in_cost=50000. active 3명 → bust(900) 후 active 2(자동확정 미발동 — H9) → reenter →
-- entries=3, reentries=1 → pool=(3+1)*50000=200000.
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE v_p uuid;
BEGIN
  SELECT id INTO v_p FROM public.ops_participants
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND entry_number = 900;
  PERFORM public.ops_bust_participant(v_p, (current_setting('ops.owner_id'))::uuid);
  PERFORM public.ops_reenter_participant(v_p, (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(
  (SELECT reentries_total FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, '재진입 후 reentries_total=1');
SELECT is(
  (SELECT prize_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  200000::bigint, '재진입 가산: prize_pool=(3 entries + 1 reentry) × 50000 = 200000');

-- ── [7][8] knockout_pool: 비-바운티 NULL → bounty_cost 세팅 시 (entries+reentries)×bounty ──
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  NULL, '비-바운티 대회: knockout_pool IS NULL');
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments SET bounty_cost = 10000
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  40000, 'tournaments 트리거 발화: knockout_pool=(3+1)×10000=40000');

-- ── [9] tournaments 비용 변경 트리거: buy_in_cost 변경 → prize_pool 재계산 ──
UPDATE public.ops_tournaments SET buy_in_cost = 60000
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT prize_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  240000::bigint, '비용 변경 트리거: prize_pool=(3+1)×60000=240000');

-- ── [10] WHEN 절 미발화 — 센티널 오염 기법(🔨H13: updated_at 은 now()=txn 상수라 판별력 없음).
--    postgres 로 entries=999 오염 → name 변경(산식 무관 컬럼) → 999 유지 = 트리거 미발화 실증.
UPDATE public.ops_live_stats SET entries = 999
  WHERE tournament_id = (current_setting('ops.t_id'))::uuid;
UPDATE public.ops_tournaments SET name = 'renamed cup'
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  999, 'WHEN 절: 비용 외 컬럼(name) 변경은 recompute 미발화(센티널 999 유지)');

-- ── [11][12] bounty_cost NULL 복귀(비용 컬럼 변경 = 발화) → knockout_pool NULL + 센티널 실값 복귀 ──
UPDATE public.ops_tournaments SET bounty_cost = NULL
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  NULL, 'bounty_cost NULL 복귀: knockout_pool NULL');
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  3, '비용 변경 발화 실증: recompute 가 센티널(999)을 실값(3)으로 복원');

-- ── [13] 신규 tournaments 래퍼 함수 EXECUTE 권한 회수(1a 교훈: 트리거 함수도 REVOKE) ──
SELECT ok(
  NOT has_function_privilege('anon', 'public.fn_ops_live_stats_recompute_trigger_tournaments()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.fn_ops_live_stats_recompute_trigger_tournaments()', 'EXECUTE'),
  'fn_ops_live_stats_recompute_trigger_tournaments: anon/authenticated EXECUTE 회수');

SELECT * FROM finish();
ROLLBACK;
