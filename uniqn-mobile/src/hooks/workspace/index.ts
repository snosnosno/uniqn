/**
 * UNIQN Mobile - Workspace Hooks Barrel
 *
 * @description 공고 워크스페이스 협업 편집 (PR #2)
 */

export {
  useWorkspaces,
  useWorkspaceMembers,
  useWorkspaceOwnerProfile,
  useReceivedWorkspaceInvitations,
  useWorkspaceInvitationsSent,
  useInviteWorkspaceMember,
  useAcceptWorkspaceInvitation,
  useRejectWorkspaceInvitation,
  useRevokeWorkspaceInvitation,
  useRemoveWorkspaceMember,
  useCreateWorkspace,
  useUpdateWorkspaceName,
  useArchivedWorkspaces,
  useArchiveWorkspace,
  useRestoreWorkspace,
  type UseWorkspacesResult,
  type UseWorkspaceMembersResult,
  type UseWorkspaceOwnerProfileResult,
  type UseReceivedInvitationsResult,
  type UseSentInvitationsResult,
  type UseArchivedWorkspacesResult,
} from './useWorkspaces';

export { useActiveWorkspace, type UseActiveWorkspaceResult } from './useActiveWorkspace';

export {
  useEnsureDefaultWorkspace,
  type EnsureDefaultWorkspaceInput,
} from './useEnsureDefaultWorkspace';

export {
  useWorkspaceRevocationGuard,
  type UseWorkspaceRevocationGuardArgs,
} from './useWorkspaceRevocationGuard';

// 반환 타입(UseWorkspaceInviteSearchReturn)은 배럴로 올리지 않는다 — 소비처가 없어
// knip 미사용 export 래칫만 올린다. 필요해지면 그때 훅 파일에서 직접 import 할 것.
export { useWorkspaceInviteSearch } from './useWorkspaceInviteSearch';
