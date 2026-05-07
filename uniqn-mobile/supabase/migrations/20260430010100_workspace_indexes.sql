-- 공고 워크스페이스 협업 편집 (M1.2) — 인덱스 5개 (Performance Review P1)
-- 모두 추가형. 기존 인덱스 영향 없음.

-- "내가 owner인 워크스페이스" 조회 — workspaces_select_owner_or_member RLS 핫패스
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id
  ON public.workspaces(owner_id);

-- "내가 멤버인 워크스페이스" 조회 — is_workspace_member 함수 핫패스
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members(user_id);

-- "내가 받은 pending 초대" 조회 — 알림/홈 화면 핫패스
-- partial index: pending status만 인덱스에 들어감 (size 절약 + selectivity)
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invitee_pending
  ON public.workspace_invitations(invitee_user_id)
  WHERE status = 'pending';

-- "워크스페이스 초대 목록" 조회 — owner 화면에서 status별 필터링
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_status
  ON public.workspace_invitations(workspace_id, status);

-- 만료 정리 cron 핫패스 (PR #2 pg_cron 작업) — pending 만료 row 빠른 추출
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_pending
  ON public.workspace_invitations(expires_at)
  WHERE status = 'pending';
