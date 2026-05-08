-- Phase 1A hotfix — workspace_members 를 supabase_realtime publication 에 추가
--
-- PR #61 의 useWorkspaceRevocationGuard 가 1차 채널로 workspace_members DELETE
-- 이벤트를 postgres_changes 로 구독하나, 본 publication 누락으로 영원히
-- 트리거되지 않았음. 30초 검증 결과 RevocationModal 미표시 (2026-05-09 세션).
--
-- 본 hotfix:
-- - workspace_members 를 publication 에 추가하여 Realtime DELETE 이벤트 활성화
-- - editor 가 회수당했을 때 5초 내 RevocationModal + 자동 logout 정상 동작
--
-- 다른 workspace 테이블 (workspaces, workspace_invitations) 도 향후 Realtime
-- 필요 시 별도 migration 으로 추가. 본 hotfix 는 회수 가드만 우선 복구.
--
-- DOWN script (rollback) — 별도 migration 으로 적용:
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.workspace_members;

ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
