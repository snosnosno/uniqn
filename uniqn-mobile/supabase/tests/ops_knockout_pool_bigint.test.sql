-- ops 1f 후속 — knockout_pool int→bigint 오버플로 근본 수선 회귀.
-- RED-GREEN: 마이그 20260706100000 적용 전(knockout_pool int + recompute (…)::int 다운캐스트)엔
--   [1] 타입 단언 FAIL(integer) + [2][3] 대형 KO 풀 recompute 가 22003 numeric overflow 로 FAIL.
--   적용 후(bigint) GREEN. 무위 시드 금지: total_buyins=22, bounty=1억 → 22×1억=2,200,000,000
--   (> int max 2,147,483,647) 실값을 직접 recompute·DEFERRED 트리거 두 경로로 검증.
BEGIN;
SELECT plan(4);

-- ── [1] 컬럼 타입 = bigint (마이그 전 integer → RED). prize_pool 과 대칭. ──
SELECT is(
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ops_live_stats' AND column_name = 'knockout_pool'),
  'bigint',
  'ops_live_stats.knockout_pool 타입 = bigint (prize_pool 과 대칭)');

-- ── 시드: 바운티 1억(CHECK 상한 경계값) 대회 + active 참가자 22명(total_buyins=22) ──
--    ops_test_seed() 는 참가자 1명(entry 1)·buy_in 50000·bounty NULL 시드 → 여기에 21명 추가.
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.t_id', s.tournament_id::text, true);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tournaments SET bounty_cost = 100000000 WHERE id = s.tournament_id;  -- 1억
  PERFORM public.ops_test_seed_players(s.tournament_id, 21);  -- 1 + 21 = 22 active
END $$;

-- ── [2] 직접 recompute: 22 × 1억 = 22억 산술이 22003 없이 통과(마이그 전 ::int 면 22003 → RED) ──
SELECT lives_ok(
  $$ SELECT public.fn_ops_recompute_live_stats((current_setting('ops.t_id'))::uuid) $$,
  '대형 KO 풀: total_buyins(22) × bounty(1억) recompute 가 22003 numeric overflow 없이 계산됨');

-- ── [3] 실값 단언: knockout_pool = 22 × 100000000 = 2,200,000,000 (int max 초과 bigint 기록) ──
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid)::bigint,
  2200000000::bigint,
  'knockout_pool = 22 × 100000000 = 2,200,000,000 (int max 2,147,483,647 초과 → bigint 필수)');

-- ── [4] DEFERRED 트리거 경로(운영 실경로): 참가자 1명 INSERT(entry 23) → SET CONSTRAINTS ALL IMMEDIATE
--        로 pending 트리거 즉발 → 23 × 1억 = 23억 이 커밋 경로에서 22003 없이 트리거 경유 기록 ──
INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
VALUES ((current_setting('ops.t_id'))::uuid, 23, 'Bounty P23', 'active', 30000);
SET CONSTRAINTS ALL IMMEDIATE;  -- 마이그 전이면 여기서 22003 → 트랜잭션 abort(운영 실경로 RED 실증)
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid)::bigint,
  2300000000::bigint,
  'DEFERRED 트리거 경로: knockout_pool = 23 × 100000000 = 2,300,000,000 (트리거 경유 bigint 기록)');

SELECT * FROM finish();
ROLLBACK;
