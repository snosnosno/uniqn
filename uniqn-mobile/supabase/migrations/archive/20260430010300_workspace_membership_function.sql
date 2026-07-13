-- 공고 워크스페이스 협업 편집 (M1.4) — is_workspace_member SECURITY DEFINER
-- Architecture A2: RLS 순환 회피 + 단일 멤버십 진실 (owner UNION editor)
-- D2: owner는 workspaces.owner_id 단독, editor는 workspace_members row → UNION으로 통합

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
      WHERE id = _workspace_id AND owner_id = _user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members
      WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

COMMENT ON FUNCTION public.is_workspace_member IS
  '워크스페이스 멤버십 단일 진실 — owner OR editor. RLS 정책 핫패스.';

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
