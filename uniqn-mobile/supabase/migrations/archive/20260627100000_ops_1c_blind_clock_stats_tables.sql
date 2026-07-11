-- 라이브 운영(ops) 1c — 블라인드 구조/서버동기 클럭/파생 통계 테이블 + init 트리거 + backfill.
-- D1(real enum 불요: 클럭 상태는 is_running 컬럼)·D3(SELECT-only RLS, 쓰기는 1c RPC 전용)·
--   live_stats 트리거 기반 단일행 재계산(16개 기존 RPC 무수정).
-- Idiom 출처: 20260625120000_ops_1a_enums_and_tables.sql (CREATE IF NOT EXISTS, ENABLE/FORCE RLS,
--            fn_ops_set_updated_at 트리거), 20260625120100_ops_1a_rls_and_membership.sql (RLS/REVOKE).
-- ⚠️ 재계산 함수/트리거는 다음 마이그(20260627100100)에 — 여기엔 init 트리거(fn_ops_init_derived_rows)만.
--    재계산 트리거를 여기 넣으면 함수 미존재로 CREATE TRIGGER 실패(§0.5 B3).
-- ⚠️ §0.5 핵심: total_chips·average_stack·prize_pool 전부 bigint(오버플로 방지). avg_stack_bb만 numeric.
-- additive — 기존 데이터 영향 없음.

-- ========================================
-- 1. ops_blind_levels (§1.1 — 블라인드 구조)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_blind_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  level int NOT NULL,                              -- 표시용 레벨번호(브레이크는 의미없음, 0 허용)
  small_blind int NOT NULL DEFAULT 0,
  big_blind int NOT NULL DEFAULT 0,
  ante int NOT NULL DEFAULT 0,
  duration_sec int NOT NULL,                       -- CHECK > 0
  is_break boolean NOT NULL DEFAULT false,
  sort int NOT NULL,                               -- 진행 순서 1..N (연속, set_blind_levels 가 보장)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_blind_levels_sort_unique UNIQUE (tournament_id, sort),
  CONSTRAINT ops_blind_levels_values_nonneg
    CHECK (small_blind >= 0 AND big_blind >= 0 AND ante >= 0 AND duration_sec > 0)
);

COMMENT ON TABLE public.ops_blind_levels IS
  '블라인드 구조. sort 1..N 연속(ops_set_blind_levels 전체교체로 보장). 쓰기는 1c SECDEF RPC 전용.';

ALTER TABLE public.ops_blind_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_blind_levels FORCE ROW LEVEL SECURITY;
-- 조회/조인 핫패스: UNIQUE(tournament_id, sort) 인덱스가 (tournament_id) prefix 도 커버 → 별도 인덱스 불요.

DROP TRIGGER IF EXISTS trg_ops_blind_levels_set_updated_at ON public.ops_blind_levels;
CREATE TRIGGER trg_ops_blind_levels_set_updated_at
  BEFORE UPDATE ON public.ops_blind_levels
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- ========================================
-- 2. ops_clock (§1.2 — 서버 동기 타이머, 대회당 1행)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_clock (
  tournament_id uuid PRIMARY KEY REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  current_level_sort int NOT NULL DEFAULT 1,       -- 현재 진행 중 블라인드 레벨의 sort
  level_started_at timestamptz,                    -- 현재 레벨 시작 서버 시각(=앵커). 일시정지/미시작이면 NULL/표시용
  is_running boolean NOT NULL DEFAULT false,
  paused_remaining_sec int,                        -- 일시정지 시 남은 초 스냅샷
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ops_clock IS
  '서버 동기 클럭(대회당 1행). 남은시간 = 서버 앵커(level_started_at) 파생. 쓰기는 1c SECDEF RPC 전용.';

ALTER TABLE public.ops_clock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_clock FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ops_clock_set_updated_at ON public.ops_clock;
CREATE TRIGGER trg_ops_clock_set_updated_at
  BEFORE UPDATE ON public.ops_clock
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- ========================================
-- 3. ops_live_stats (§1.3 — 파생 통계, 대회당 1행, 트리거 재계산)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_live_stats (
  tournament_id uuid PRIMARY KEY REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  playing int NOT NULL DEFAULT 0,                  -- status='active'
  entries int NOT NULL DEFAULT 0,                  -- 총 엔트리(참가자 행 수)
  unique_players int NOT NULL DEFAULT 0,           -- 1c=entries 동치(계정 dedup 후속). 컬럼 적재
  reentries_total int NOT NULL DEFAULT 0,          -- Σ reentries
  tables_open int NOT NULL DEFAULT 0,              -- ops_tables status='open'
  seats_total int NOT NULL DEFAULT 0,              -- open 테이블의 좌석 수
  seats_free int NOT NULL DEFAULT 0,               -- 빈 좌석(participant_id IS NULL, open 테이블)
  total_chips bigint NOT NULL DEFAULT 0,           -- Σ chips (active) — bigint(오버플로 방지)
  average_stack bigint NOT NULL DEFAULT 0,         -- round(total_chips / NULLIF(playing,0)) — bigint
  avg_stack_bb numeric NOT NULL DEFAULT 0,         -- COALESCE(average_stack / NULLIF(현재 big_blind,0), 0)
  prize_pool bigint NOT NULL DEFAULT 0,            -- Σ(엔트리·buy_in_cost + Σrebuys·rebuy_cost + Σadd_ons·addon_cost) — bigint
  knockout_pool int,                               -- bounty (1c는 NULL/0, 1f)
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ops_live_stats IS
  '파생 통계(대회당 1행). fn_ops_recompute_live_stats 트리거 재계산(원천 participants/seats/tables/clock·blind). 쓰기는 함수 전용.';

ALTER TABLE public.ops_live_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_live_stats FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ops_live_stats_set_updated_at ON public.ops_live_stats;
CREATE TRIGGER trg_ops_live_stats_set_updated_at
  BEFORE UPDATE ON public.ops_live_stats
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- ========================================
-- 4. SELECT-only RLS (3 테이블 — is_ops_member 재사용, 1a ops_*_select_member 미러)
-- ========================================
DROP POLICY IF EXISTS ops_blind_levels_select_member ON public.ops_blind_levels;
CREATE POLICY ops_blind_levels_select_member ON public.ops_blind_levels FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS ops_clock_select_member ON public.ops_clock;
CREATE POLICY ops_clock_select_member ON public.ops_clock FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS ops_live_stats_select_member ON public.ops_live_stats;
CREATE POLICY ops_live_stats_select_member ON public.ops_live_stats FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- ========================================
-- 5. 테이블 DML REVOKE (방어심층 — 쓰기 정책 회귀 시에도 직접 write 불가)
-- ========================================
REVOKE INSERT, UPDATE, DELETE ON public.ops_blind_levels FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_clock        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_live_stats   FROM anon, authenticated;

-- ========================================
-- 6. init 트리거 — 신규 대회 INSERT 시 clock + live_stats 행 자동 생성(멱등)
--    (재계산 트리거는 다음 마이그 — 함수 정의 이후. §0.5 B3)
-- ========================================
CREATE OR REPLACE FUNCTION public.fn_ops_init_derived_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.ops_clock (tournament_id)
  VALUES (NEW.id) ON CONFLICT (tournament_id) DO NOTHING;
  INSERT INTO public.ops_live_stats (tournament_id)
  VALUES (NEW.id) ON CONFLICT (tournament_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ops_init_derived_rows ON public.ops_tournaments;
CREATE TRIGGER trg_ops_init_derived_rows
  AFTER INSERT ON public.ops_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_init_derived_rows();

-- ========================================
-- 7. backfill — 기존 대회에 clock + live_stats 행 보강(멱등, 0표시 방지)
--    값 재계산은 다음 마이그 말미(재계산 함수 존재 이후).
-- ========================================
INSERT INTO public.ops_clock (tournament_id)
  SELECT id FROM public.ops_tournaments
  ON CONFLICT (tournament_id) DO NOTHING;

INSERT INTO public.ops_live_stats (tournament_id)
  SELECT id FROM public.ops_tournaments
  ON CONFLICT (tournament_id) DO NOTHING;
