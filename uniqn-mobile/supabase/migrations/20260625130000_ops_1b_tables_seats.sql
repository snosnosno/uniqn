-- 라이브 운영(ops) 1b — ops_table_status/lock_type enum + ops_tables/ops_seats + RLS.
-- D1(real enum) · D3(SELECT-only RLS, 쓰기는 1b RPC 전용) · 좌석 단일점유(partial UNIQUE).
-- Idiom 출처: 20260625120000_ops_1a_enums_and_tables.sql (CREATE IF NOT EXISTS, ENABLE/FORCE RLS,
--            fn_ops_set_updated_at 트리거), 20260625120100_ops_1a_rls_and_membership.sql (RLS/REVOKE).
-- additive — 기존 데이터 영향 없음.

-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_table_status') THEN
    CREATE TYPE public.ops_table_status AS ENUM ('open', 'closed', 'standby');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_table_lock_type') THEN
    CREATE TYPE public.ops_table_lock_type AS ENUM ('none', 'locked', 'feature');
  END IF;
END $$;

-- 2. ops_tables
CREATE TABLE IF NOT EXISTS public.ops_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  table_no int NOT NULL,
  name text,
  status public.ops_table_status NOT NULL DEFAULT 'open',
  assigned_staff_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lock_type public.ops_table_lock_type NOT NULL DEFAULT 'none',
  priority int,
  position jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_tables_table_no_unique UNIQUE (tournament_id, table_no),
  CONSTRAINT ops_tables_table_no_positive CHECK (table_no >= 1),
  CONSTRAINT ops_tables_name_length CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50)
);
COMMENT ON TABLE public.ops_tables IS '라이브 운영 테이블. 쓰기는 1b SECDEF RPC 전용. closed/standby/lock 은 redraw 제외.';

ALTER TABLE public.ops_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_tables FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ops_tables_tournament ON public.ops_tables (tournament_id);

DROP TRIGGER IF EXISTS trg_ops_tables_set_updated_at ON public.ops_tables;
CREATE TRIGGER trg_ops_tables_set_updated_at
  BEFORE UPDATE ON public.ops_tables
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- 3. ops_seats (정규화 단일 점유원)
CREATE TABLE IF NOT EXISTS public.ops_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.ops_tables(id) ON DELETE CASCADE,
  table_no int NOT NULL,
  seat_no int NOT NULL,
  participant_id uuid REFERENCES public.ops_participants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_seats_seat_unique UNIQUE (table_id, seat_no),
  CONSTRAINT ops_seats_seat_no_positive CHECK (seat_no >= 1)
);
COMMENT ON TABLE public.ops_seats IS '좌석 단일 점유원. participant 점유는 partial UNIQUE 로 대회내 1좌석 강제.';

-- 단일점유: 한 참가자는 대회내 최대 1좌석.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ops_seats_participant
  ON public.ops_seats (tournament_id, participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_seats_tournament ON public.ops_seats (tournament_id);
CREATE INDEX IF NOT EXISTS idx_ops_seats_table ON public.ops_seats (table_id);

ALTER TABLE public.ops_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_seats FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ops_seats_set_updated_at ON public.ops_seats;
CREATE TRIGGER trg_ops_seats_set_updated_at
  BEFORE UPDATE ON public.ops_seats
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- 4. SELECT-only RLS (is_ops_member 재사용)
DROP POLICY IF EXISTS ops_tables_select_member ON public.ops_tables;
CREATE POLICY ops_tables_select_member ON public.ops_tables FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS ops_seats_select_member ON public.ops_seats;
CREATE POLICY ops_seats_select_member ON public.ops_seats FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- 5. DML REVOKE (방어심층)
REVOKE INSERT, UPDATE, DELETE ON public.ops_tables FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_seats  FROM anon, authenticated;
