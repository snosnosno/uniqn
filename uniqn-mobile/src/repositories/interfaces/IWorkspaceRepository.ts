/**
 * UNIQN Mobile - 워크스페이스 Repository 인터페이스
 *
 * @description 공고 워크스페이스 협업 편집 (PR #2)
 *              owner 단독 + editor 멤버 모델 (D2)
 * @version 1.0.0
 */

import type {
  Workspace,
  WorkspaceMemberWithUser,
  WorkspaceInvitation,
  ReceivedWorkspaceInvitation,
  AcceptInvitationResult,
} from '@/types/workspace';

export interface IWorkspaceRepository {
  /**
   * 워크스페이스 생성 (RPC create_workspace 경유 — auth.uid() 자동 사용)
   * @throws AppError E3 검증 / E5 권한 부족 / E6 cap 도달 / E1 네트워크
   */
  create(name: string): Promise<Workspace>;

  /** 단건 조회 — RLS 차단 시 undefined */
  findById(id: string): Promise<Workspace | undefined>;

  /** 내가 owner 인 워크스페이스 + editor 인 워크스페이스 모두 (UNION) */
  findAllByMember(userId: string): Promise<Workspace[]>;

  /** 이름 변경 (owner 만 — RLS 가 강제) */
  updateName(id: string, name: string): Promise<Workspace>;

  /**
   * 워크스페이스 owner 의 public profile (nickname/name/photo).
   * editor 도 호출 가능 — get_workspace_owner_profile RPC 가 권한 체크.
   * 권한 없거나 워크스페이스 미존재 시 null.
   */
  getOwnerProfile(
    workspaceId: string
  ): Promise<{ id: string; displayName: string | null; photoUrl: string | null } | null>;

  /**
   * 워크스페이스 아카이브 (RPC archive_workspace 경유 — owner 전용, RPC가 권한/진행공고 체크)
   * @throws AppError E5 권한 / E6092 진행공고 존재
   */
  archiveViaRpc(workspaceId: string): Promise<void>;

  /**
   * 워크스페이스 복원 (RPC restore_workspace 경유 — owner 전용, cap 재검사)
   * @throws AppError E5 권한 / E6090 cap 도달
   */
  restoreViaRpc(workspaceId: string): Promise<void>;

  /** 내가 owner 인 아카이브된 워크스페이스 목록 (보관함). 최근 아카이브순. */
  findArchivedByOwner(ownerId: string): Promise<Workspace[]>;
}

export interface IWorkspaceMemberRepository {
  /** 멤버 목록 (owner 제외 editor 만 — workspace_members 테이블) */
  findByWorkspaceWithUser(workspaceId: string): Promise<WorkspaceMemberWithUser[]>;

  /** 본인이 속한 워크스페이스 ID 목록 (editor 으로) */
  findWorkspaceIdsForUser(userId: string): Promise<string[]>;

  /**
   * 멤버 제거 (RPC 우회) — owner 만 호출 가능, RPC 가 권한 체크
   * @throws AppError E5 권한 / E6 invalid state
   */
  removeViaRpc(workspaceId: string, userId: string): Promise<void>;
}

export interface IWorkspaceInvitationRepository {
  /**
   * 초대 발송 (owner 만, RPC 경유 atomic 권한 체크)
   * @returns 새 초대 ID
   * @throws AppError E3 검증 / E5 권한 / E6 비즈니스 (이미 멤버 / 이미 초대됨)
   */
  inviteViaRpc(workspaceId: string, inviteeUserId: string): Promise<string>;

  /**
   * 초대 수락 (race-safe atomic RPC)
   * @returns workspaceId + idempotent 플래그
   */
  acceptViaRpc(invitationId: string): Promise<AcceptInvitationResult>;

  /** 거절 (RPC) */
  rejectViaRpc(invitationId: string): Promise<void>;

  /** owner 가 보낸 초대 회수 (RPC) */
  revokeViaRpc(invitationId: string): Promise<void>;

  /** 본인이 받은 pending 초대 + 워크스페이스/초대자 정보 결합 */
  findPendingForUser(userId: string): Promise<ReceivedWorkspaceInvitation[]>;

  /** 워크스페이스의 모든 초대 (owner 화면) */
  findByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]>;
}
