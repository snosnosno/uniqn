-- 공고 워크스페이스 협업 편집 (M1.6) — job_postings.workspace_id 추가 (nullable)
-- 백필은 PR #4 (M2). NOT NULL 전환은 PR #5 (M3).
-- 본 마이그레이션 시점: workspace_id IS NULL이 정상 (병행 동작).

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.job_postings.workspace_id IS
  '연결된 워크스페이스. PR #4(백필) 후 NOT NULL 전환 (PR #5). NULL 동안 owner_id 권한 사용.';

-- "워크스페이스의 공고 목록" 조회 핫패스 (RLS + employer 화면)
CREATE INDEX IF NOT EXISTS idx_job_postings_workspace_id
  ON public.job_postings(workspace_id)
  WHERE workspace_id IS NOT NULL;
