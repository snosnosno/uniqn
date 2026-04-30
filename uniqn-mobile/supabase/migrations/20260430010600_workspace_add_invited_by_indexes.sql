-- 공고 워크스페이스 협업 편집 (M1.7) — invited_by FK 커버 인덱스
-- supabase advisors performance lint(0001_unindexed_foreign_keys) 해소

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by
  ON public.workspace_invitations(invited_by);

CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_by
  ON public.workspace_members(invited_by)
  WHERE invited_by IS NOT NULL;
