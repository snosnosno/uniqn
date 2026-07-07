-- ops 1f 후속 — ops_get_player_view.bountyAccrued int*int 오버플로 수선 회귀 (#226 동일 클래스).
-- RED-GREEN: 마이그 20260706100100 적용 전(knockouts*bounty_cost = int*int)엔 [1][2] 가 22003 numeric
--   overflow 로 FAIL. 적용 후(knockouts::bigint*bounty_cost) GREEN. 무위 시드 금지: knockouts=22·bounty=1억
--   → 22×1억 = 2,200,000,000 (> int max 2,147,483,647) 실값을 anon 플레이어뷰 경로로 검증.
BEGIN;
SELECT plan(3);

-- ── 시드: 바운티 1억(CHECK 상한) 대회 + 본인 knockouts=22 (곱 = 22억 > int max) ──
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.pid',      s.participant_id::text, true);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tournaments  SET bounty_cost = 100000000 WHERE id = s.tournament_id;  -- 1억
  UPDATE public.ops_participants SET knockouts   = 22        WHERE id = s.participant_id;  -- 본인 KO 22
END $$;

-- ── viewToken 발급(운영자 권한 필요) ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_issue_player_credentials((current_setting('ops.pid'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.viewA', r->>'viewToken', true);
END $$;

-- ── anon 공개 플레이어뷰 경로로 조회 ──
SELECT set_config('role', 'anon', true);

-- ── [1] 대형 bountyAccrued 곱셈경로: 22003 없이 반환(마이그 전 int*int 면 22003 → RED) ──
SELECT lives_ok(
  $$ SELECT public.ops_get_player_view(current_setting('ops.viewA')) $$,
  '대형 bountyAccrued: knockouts(22) × bounty(1억) 플레이어뷰가 22003 없이 반환');

-- ── [2] 실값: bountyAccrued = 22 × 100000000 = 2,200,000,000 (int max 초과 → bigint 필수) ──
SELECT is(
  (public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'bountyAccrued')::bigint,
  2200000000::bigint,
  'bountyAccrued = 22 × 100000000 = 2,200,000,000 (int max 2,147,483,647 초과 → bigint)');

-- ── [3] knockouts 자체 노출 불변(회귀 앵커) ──
SELECT is(
  (public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'knockouts')::int,
  22,
  'me.knockouts=22 노출(회귀 앵커)');

SELECT * FROM finish();
ROLLBACK;
