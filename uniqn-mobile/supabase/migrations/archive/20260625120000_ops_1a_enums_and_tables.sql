-- 라이브 운영(ops) 1a — enum 3종 + ops_tournaments/ops_participants/ops_events 테이블
-- Decisions: D1 (real pg ENUM, not TEXT CHECK), D3 (SELECT-only RLS — DML은 T2 SECDEF RPC 전용),
--            ops_events append-only (REVOKE + BEFORE UPDATE/DELETE 트리거 둘 다).
-- Idiom 출처: 20260430010000_workspace_create_tables.sql (CREATE TABLE IF NOT EXISTS, ENABLE/FORCE RLS,
--            fn_workspaces_set_updated_at SECDEF updated_at 트리거).
-- additive — 기존 데이터 영향 없음.

-- ========================================
-- 1. ENUMS (§3 — full forward set; 후속 슬라이스에서 ALTER TYPE 불필요)
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_tournament_status') THEN
    CREATE TYPE public.ops_tournament_status AS ENUM ('upcoming', 'active', 'completed');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_participant_status') THEN
    CREATE TYPE public.ops_participant_status AS ENUM ('registered', 'checked_in', 'active', 'busted', 'no_show');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_event_type') THEN
    CREATE TYPE public.ops_event_type AS ENUM (
      'tournament_created', 'tournament_status_changed', 'registration_toggled',
      'player_registered', 'player_checked_in', 'player_rebuy', 'player_addon',
      'player_busted', 'player_reentered', 'player_moved', 'seat_freed',
      'table_added', 'table_closed', 'table_redraw', 'prize_assigned',
      'level_play', 'level_pause', 'level_set'
    );
  END IF;
END$$;

-- ========================================
-- 2. updated_at 트리거 함수 (ops_tournaments / ops_participants 공용)
-- ========================================
CREATE OR REPLACE FUNCTION public.fn_ops_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ========================================
-- 3. ops_tournaments (§4)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  name text NOT NULL,
  venue text,
  event_date date,
  game_type text NOT NULL DEFAULT 'NLH',
  status public.ops_tournament_status NOT NULL DEFAULT 'upcoming',
  seats_per_table int NOT NULL DEFAULT 9,
  starting_chips int NOT NULL DEFAULT 0,
  color text,
  buy_in_chips int NOT NULL DEFAULT 0,
  rebuy_chips int NOT NULL DEFAULT 0,
  addon_chips int NOT NULL DEFAULT 0,
  buy_in_cost int NOT NULL DEFAULT 0,
  fee_cost int NOT NULL DEFAULT 0,
  rebuy_cost int NOT NULL DEFAULT 0,
  addon_cost int NOT NULL DEFAULT 0,
  bounty_cost int,
  registration_open boolean NOT NULL DEFAULT true,
  auto_seat_on_register boolean NOT NULL DEFAULT true,
  reentry_allowed boolean NOT NULL DEFAULT true,
  max_reentries int,
  monitor_token text UNIQUE,
  next_entry_seq int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_tournaments_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT ops_tournaments_seats_range CHECK (seats_per_table BETWEEN 2 AND 11),
  CONSTRAINT ops_tournaments_starting_chips_nonneg CHECK (starting_chips >= 0)
);

COMMENT ON TABLE public.ops_tournaments IS '라이브 운영 대회. owner OR 연결 공고 워크스페이스 멤버만 SELECT. 쓰기는 T2 SECDEF RPC 전용.';
COMMENT ON COLUMN public.ops_tournaments.next_entry_seq IS '엔트리 번호 할당자. ops_register_participant 가 +1 후 UPDATE (FOR UPDATE 직렬화).';

ALTER TABLE public.ops_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_tournaments FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ops_tournaments_owner_id
  ON public.ops_tournaments (owner_id);
CREATE INDEX IF NOT EXISTS idx_ops_tournaments_job_posting_id
  ON public.ops_tournaments (job_posting_id)
  WHERE job_posting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_tournaments_status
  ON public.ops_tournaments (status);

DROP TRIGGER IF EXISTS trg_ops_tournaments_set_updated_at ON public.ops_tournaments;
CREATE TRIGGER trg_ops_tournaments_set_updated_at
  BEFORE UPDATE ON public.ops_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- ========================================
-- 4. ops_participants (§4 — seat 컬럼 없음, 좌석은 1b)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  entry_number int NOT NULL,
  name text NOT NULL,
  nationality text,
  phone text,
  player_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  claim_token text UNIQUE,
  status public.ops_participant_status NOT NULL DEFAULT 'registered',
  chips int NOT NULL DEFAULT 0,
  buy_in_amount int,
  rebuys int NOT NULL DEFAULT 0,
  add_ons int NOT NULL DEFAULT 0,
  reentries int NOT NULL DEFAULT 0,
  finish_position int,
  busted_at timestamptz,
  prize_amount int,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_participants_entry_unique UNIQUE (tournament_id, entry_number),
  CONSTRAINT ops_participants_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
  CONSTRAINT ops_participants_chips_nonneg CHECK (chips >= 0),
  CONSTRAINT ops_participants_rebuys_nonneg CHECK (rebuys >= 0),
  CONSTRAINT ops_participants_addons_nonneg CHECK (add_ons >= 0),
  CONSTRAINT ops_participants_reentries_nonneg CHECK (reentries >= 0)
);

COMMENT ON TABLE public.ops_participants IS '대회 참가자(엔트리). entry_number 는 tournament 내 1부터 gap-free. 쓰기는 T2 SECDEF RPC 전용.';

ALTER TABLE public.ops_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_participants FORCE ROW LEVEL SECURITY;

-- 등수 중복 방지 — 배정된 경우에만 (partial unique, workspace_invitations pending 유니크 idiom)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ops_participants_finish_position
  ON public.ops_participants (tournament_id, finish_position)
  WHERE finish_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_participants_tournament_status
  ON public.ops_participants (tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_ops_participants_tournament_finish
  ON public.ops_participants (tournament_id, finish_position);

DROP TRIGGER IF EXISTS trg_ops_participants_set_updated_at ON public.ops_participants;
CREATE TRIGGER trg_ops_participants_set_updated_at
  BEFORE UPDATE ON public.ops_participants
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- ========================================
-- 5. ops_events (§4 — append-only)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  type public.ops_event_type NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_device text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ops_events IS 'Append-only 이벤트 로그. UPDATE/DELETE 금지(트리거 RAISE + REVOKE). Realtime publication 미등록.';

ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_events FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ops_events_tournament_created
  ON public.ops_events (tournament_id, created_at DESC);

-- Append-only 강제 (a) — BEFORE UPDATE OR DELETE 트리거 RAISE
CREATE OR REPLACE FUNCTION public.fn_ops_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'OPS_EVENTS_APPEND_ONLY: ops_events 는 append-only — % 불가', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_ops_events_append_only ON public.ops_events;
CREATE TRIGGER trg_ops_events_append_only
  BEFORE UPDATE OR DELETE ON public.ops_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_events_append_only();
