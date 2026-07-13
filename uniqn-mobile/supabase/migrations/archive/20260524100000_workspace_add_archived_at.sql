-- 워크스페이스 소프트 삭제(아카이브) — archived_at 마커 컬럼
-- NULL = 활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

COMMENT ON COLUMN public.workspaces.archived_at IS
  '소프트 삭제 마커. NULL=활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능. 2026-05-24.';

-- cap / list_my_workspaces 핫패스용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_active
  ON public.workspaces(owner_id) WHERE archived_at IS NULL;
