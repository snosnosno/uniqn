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
   * 워크스페이스 생성
   * @throws AppError E3 cap 도달 / E5 권한 부족 / E1 네트워크
   */
  create(name: string, ownerId: string): Promise<Workspace>;

  /** 단건 조회 — RLS 차단 시 undefined */
  findById(id: string): Promise<Workspace | undefined>;

  /** 내가 owner 인 워크스페이스 + editor 인 워크스페이스 모두 (UNION) */
  findAllByMember(userId: string): Promise<Workspace[]>;

  /** 이름 변경 (owner 만 — RLS 가 강제) */
  updateName(id: string, name: string): Promise<Workspace>;
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
