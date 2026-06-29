-- OPS 1d M1 — ops_prizes 순위별 고정 상금 테이블 + RLS + enum 값.
-- 패턴: 20260625120000_ops_1a_enums_and_tables.sql (테이블/RLS/트리거), is_ops_member SELECT-only RLS.
-- ⚠️ enum ADD VALUE 는 본 마이그(별도 txn)에서 추가 — 값을 쓰는 RPC 는 M2(별도 txn).

CREATE TABLE IF NOT EXISTS public.ops_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  rank int NOT NULL,
  amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_prizes_rank_positive CHECK (rank > 0),
  CONSTRAINT ops_prizes_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT ops_prizes_unique_rank UNIQUE (tournament_id, rank)
);

COMMENT ON TABLE public.ops_prizes IS '순위별 고정 상금 구조(1d). 쓰기는 SECDEF RPC 전용. bust 가 rank=finish_position 으로 prize_amount 매핑.';

ALTER TABLE public.ops_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_prizes FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ops_prizes_tournament_rank
  ON public.ops_prizes (tournament_id, rank);

DROP TRIGGER IF EXISTS trg_ops_prizes_set_updated_at ON public.ops_prizes;
CREATE TRIGGER trg_ops_prizes_set_updated_at
  BEFORE UPDATE ON public.ops_prizes
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

DROP POLICY IF EXISTS ops_prizes_select ON public.ops_prizes;
CREATE POLICY ops_prizes_select ON public.ops_prizes
  FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, auth.uid()) OR public.is_admin());

-- 감사 이벤트 enum 값 (player_busted/player_reentered/prize_assigned 는 1a 존재).
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_structure_set';
