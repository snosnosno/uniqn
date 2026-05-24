/**
 * UNIQN Mobile - 워크스페이스 도메인 타입
 *
 * @description 공고 워크스페이스 협업 편집 (PR #2)
 *              camelCase 도메인 / snake_case DB 분리 (memory: supabase-patterns #1)
 * @version 1.0.0
 */

export type WorkspaceRole = 'editor';

export type WorkspaceInvitationStatus = 'pending' | 'accepted' | 'rejected' | 'revoked' | 'expired';

/**
 * 워크스페이스 (소유 + 멤버 모두 사용)
 */
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  /** owner 제외한 editor 수 (UI 에서는 +1 표시) */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  /** 소프트 삭제 마커. null = 활성. 값 있으면 아카이브됨 (보관함). */
  archivedAt: string | null;
}

/**
 * 워크스페이스 멤버 (editor 만)
 */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedBy: string | null;
  joinedAt: string;
}

/**
 * 멤버 목록에 사용자 표시용 정보 결합
 */
export interface WorkspaceMemberWithUser extends WorkspaceMember {
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
}

/**
 * 초대
 */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  inviteeUserId: string;
  role: WorkspaceRole;
  invitedBy: string;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
}

/**
 * 받은 초대 목록 (워크스페이스/초대자 정보 결합)
 */
export interface ReceivedWorkspaceInvitation extends WorkspaceInvitation {
  workspaceName: string;
  inviterDisplayName: string | null;
}

/**
 * accept_workspace_invitation RPC 반환
 */
export interface AcceptInvitationResult {
  invitationId: string;
  workspaceId: string;
  /** 이미 수락 완료된 초대를 다시 수락한 경우 true */
  idempotent: boolean;
}

export const WORKSPACE_LIMITS = {
  MAX_PER_OWNER: 10,
  MAX_NAME_LENGTH: 50,
  INVITATION_TTL_DAYS: 7,
} as const;
