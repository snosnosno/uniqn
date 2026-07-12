/**
 * UNIQN Mobile - Workspace Invitation Service
 *
 * @description 초대 라이프사이클 (PR #2)
 *              invite/accept/reject/revoke — 모두 SECURITY DEFINER RPC 경유.
 *              발송 후 푸시 알림은 별도 서비스 (pushNotificationService.sendWorkspaceInvitation).
 * @version 1.0.0
 */

import { workspaceInvitationRepository, workspaceRepository } from '@/repositories';
import { inviteWorkspaceMemberSchema, respondInvitationSchema } from '@/schemas/workspace.schema';
import { ValidationError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import type {
  ReceivedWorkspaceInvitation,
  WorkspaceInvitation,
  AcceptInvitationResult,
} from '@/types/workspace';

function validateOrThrow<T>(
  parsed: { success: boolean; data?: T; error?: { issues: { message: string }[] } },
  fallback = '입력값을 확인해주세요'
): T {
  if (!parsed.success) {
    const message = parsed.error?.issues[0]?.message ?? fallback;
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { userMessage: message });
  }
  return parsed.data as T;
}

export interface InviteWorkspaceMemberOptions {
  workspaceId: string;
  inviteeUserId: string;
}

export interface InviteWorkspaceMemberResult {
  invitationId: string;
  workspaceName: string;
}

export const workspaceInvitationService = {
  /**
   * 멤버 초대 — owner 권한 체크는 RPC 단계에서 수행.
   * 푸시 알림은 호출자가 별도 트리거 (Repository 가 invitationId 반환 후).
   */
  async invite(input: InviteWorkspaceMemberOptions): Promise<InviteWorkspaceMemberResult> {
    const parsed = inviteWorkspaceMemberSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    logger.info('워크스페이스 초대 시작', data);
    const invitationId = await workspaceInvitationRepository.inviteViaRpc(
      data.workspaceId,
      data.inviteeUserId
    );

    // 이 시점에 초대는 이미 커밋됐고 트리거가 invitee에게 알림·푸시를 발송했다.
    // 아래 findById 는 토스트용 workspaceName 조회일 뿐이므로, 실패해도 초대 성공을
    // 무효화하면 안 된다(감사 P2#16: 이름 조회 실패 → invite 전체 reject → 초대는
    // 발송됐는데 구인자 화면만 "실패"로 오인). 조회 실패 시 빈 이름으로 폴백한다.
    let workspaceName = '';
    try {
      const workspace = await workspaceRepository.findById(data.workspaceId);
      workspaceName = workspace?.name ?? '';
    } catch (error) {
      logger.warn('초대 후 워크스페이스명 조회 실패 — 초대는 성공, 이름 없이 반환', {
        workspaceId: data.workspaceId,
        error,
      });
    }

    return {
      invitationId,
      workspaceName,
    };
  },

  /**
   * 초대 수락 (atomic + idempotent)
   */
  async accept(input: { invitationId: string }): Promise<AcceptInvitationResult> {
    const parsed = respondInvitationSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    logger.info('워크스페이스 초대 수락', data);
    return workspaceInvitationRepository.acceptViaRpc(data.invitationId);
  },

  /**
   * 초대 거절
   */
  async reject(input: { invitationId: string }): Promise<void> {
    const parsed = respondInvitationSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    logger.info('워크스페이스 초대 거절', data);
    await workspaceInvitationRepository.rejectViaRpc(data.invitationId);
  },

  /**
   * owner 가 보낸 초대 회수
   */
  async revoke(input: { invitationId: string }): Promise<void> {
    const parsed = respondInvitationSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    logger.info('워크스페이스 초대 회수', data);
    await workspaceInvitationRepository.revokeViaRpc(data.invitationId);
  },

  /**
   * 본인이 받은 pending 초대 (홈 화면 / 알림 화면에서 표시)
   */
  async listPendingForUser(userId: string): Promise<ReceivedWorkspaceInvitation[]> {
    return workspaceInvitationRepository.findPendingForUser(userId);
  },

  /**
   * 워크스페이스의 모든 초대 (owner 가 status 별로 필터링)
   */
  async listByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return workspaceInvitationRepository.findByWorkspace(workspaceId);
  },
};
