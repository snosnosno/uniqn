-- 공고 워크스페이스 협업 편집 (M1.1) — 테이블 + enum
-- Design: design/monetization-subscription doc (D2 owner SoT — owner_id 단독, members = editor only)
-- 본 마이그레이션은 additive — 기존 데이터 영향 없음 (job_postings.workspace_id 추가는 별도 마이그레이션)

-- 1. workspace_role enum (D2: owner는 workspaces.owner_id로 단독 표현, members는 editor만)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('editor');
  END IF;
END$$;

-- 2. workspaces — 단일 owner + denormalized member_count (trigger 동기화)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
  CONSTRAINT workspaces_member_count_nonneg CHECK (member_count >= 0)
);

COMMENT ON TABLE public.workspaces IS '공고 워크스페이스 — owner 단독 + editor 멤버. job_postings.workspace_id로 연결.';
COMMENT ON COLUMN public.workspaces.member_count IS 'editor 수 (owner 제외). trigger 동기화. UI에서 owner+1 표시.';

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;

-- 3. workspace_members — editor 전용 (D2)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

COMMENT ON TABLE public.workspace_members IS 'editor 멤버만 저장. owner는 workspaces.owner_id 단독 (D2 — drift 0).';

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;

-- 4. workspace_invitations — D1 invitee_email 컬럼 제거됨 (Phase 2 매직 링크)
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

COMMENT ON TABLE public.workspace_invitations IS '인앱 초대 (invitee_user_id 필수). 외부 이메일 초대는 Phase 2.';
COMMENT ON COLUMN public.workspace_invitations.status IS 'pending → accepted/rejected/revoked/expired. 만료 정리는 pg_cron (PR #2).';

-- pending 중복 방지 — 동일 (workspace, invitee) pending 1개만 허용
-- rejected/expired/revoked/accepted 다중 row 허용 (재초대 가능)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspace_invitations_pending
  ON public.workspace_invitations (workspace_id, invitee_user_id)
  WHERE status = 'pending';

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations FORCE ROW LEVEL SECURITY;

-- 5. updated_at 자동 갱신 trigger (workspaces 전용 — workspace_members는 joined_at만)
CREATE OR REPLACE FUNCTION public.fn_workspaces_set_updated_at()
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

DROP TRIGGER IF EXISTS trg_workspaces_set_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.fn_workspaces_set_updated_at();
