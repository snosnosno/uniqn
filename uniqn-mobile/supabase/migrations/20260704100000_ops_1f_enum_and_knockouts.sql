-- OPS 1f M1 — 이벤트 enum 2값 + knockouts 컬럼 + 동반 수선(ops_prizes DML REVOKE·bounty_cost CHECK).
-- ⚠️ enum ADD VALUE 는 본 마이그(별도 txn)에서 값만 추가 — 값을 쓰는 RPC 는 M3(별도 txn, 55P04 회피).
-- 패턴: 20260630120000_ops_1d_prizes_table.sql (enum ADD VALUE), 1a CHECK 네이밍(ops_participants_*_nonneg).

-- 1) 이벤트 enum 2값 (멱등)
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_bust_undone';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_corrected';

-- 2) flat KO 카운터. 적립(원화)은 파생: knockouts × bounty_cost (컬럼 없음, D4).
--    인덱스 불요(대회 내 소수 행·기존 (tournament_id,status) 인덱스로 충분).
ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS knockouts int NOT NULL DEFAULT 0;

-- 2-b) [🔨H11] ops_events 전순서 키 — created_at 은 DEFAULT now() = 트랜잭션 시작 시각 고정이라
--     같은 txn 의 이벤트가 전부 동률(id 는 uuid 라 무순서). undo 의 "최신 player_busted" 선별이
--     ORDER BY created_at 만으로는 비결정 → seq 가 유일한 전순서. append-only·prod 0행이라 additive 무해.
ALTER TABLE public.ops_events
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

-- 3) CHECK 제약 2종 (멱등 — ADD CONSTRAINT 는 IF NOT EXISTS 미지원이라 카탈로그 확인)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ops_participants_knockouts_nonneg'
                   AND conrelid = 'public.ops_participants'::regclass) THEN
    ALTER TABLE public.ops_participants
      ADD CONSTRAINT ops_participants_knockouts_nonneg CHECK (knockouts >= 0);
  END IF;
  -- bounty_cost 음수 거부(스펙 §4.4) — RPC P0001 가드 대신 테이블 제약(모든 경로 차단·신규 에러코드 불요).
  -- NULL = 비-바운티 대회(0 과 구분 — 0 은 "바운티 개념은 있으나 단가 0").
  -- [🔨H15] 상한 1억: 오입력(예 20억)이면 knockout_pool int 곱이 22003 오버플로 — DEFERRED 트리거라
  --   원인 조작의 커밋 시점에 원인불명 실패로 터지고 이후 전 참가자 변이가 막히므로 입구에서 차단.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ops_tournaments_bounty_cost_nonneg'
                   AND conrelid = 'public.ops_tournaments'::regclass) THEN
    ALTER TABLE public.ops_tournaments
      ADD CONSTRAINT ops_tournaments_bounty_cost_nonneg
      CHECK (bounty_cost IS NULL OR (bounty_cost >= 0 AND bounty_cost <= 100000000));
  END IF;
END $$;

-- 4) 동반 수선: ops_prizes 테이블 DML REVOKE (1d 누락 — 다른 ops 테이블과 동일한 방어심층.
--    쓰기는 ops_set_prize_structure SECDEF 전용, RLS 는 SELECT-only 라 REVOKE 가 2중 방어)
REVOKE INSERT, UPDATE, DELETE ON public.ops_prizes FROM anon, authenticated;
