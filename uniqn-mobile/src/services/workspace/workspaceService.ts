/**
 * UNIQN Mobile - Workspace Service
 *
 * @description 공고 워크스페이스 도메인 로직 (PR #2)
 *              - 입력 검증 (zod)
 *              - 권한 체크는 RLS 단독 (워크스페이스 정책 review C1)
 *              - Hook 에서 UI 분기용 데이터만 제공
 * @version 1.0.0
 */

import { workspaceRepository, workspaceMemberRepository } from '@/repositories';
import {
  createWorkspaceSchema,
  updateWorkspaceNameSchema,
  removeWorkspaceMemberSchema,
} from '@/schemas/workspace.schema';
import { ValidationError, ERROR_CODES, isAppError } from '@/errors';
import { logger } from '@/utils/logger';
import type { Workspace, WorkspaceMemberWithUser } from '@/types/workspace';

function toValidationError(error: unknown): never {
  if (isAppError(error)) throw error;
  throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
    userMessage: '입력값을 확인해주세요',
    metadata: { error: String(error) },
  });
}

export const workspaceService = {
  /**
   * 새 워크스페이스 생성
   * RLS 가 cap (10) 강제 — 도달 시 mapWorkspaceRpcError 가 WORKSPACE_CAP_REACHED 변환.
   */
  async createWorkspace(input: { name: string; ownerId: string }): Promise<Workspace> {
    const parsed = createWorkspaceSchema.safeParse({ name: input.name });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값 오류';
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { userMessage: message });
    }

    return workspaceRepository.create(parsed.data.name, input.ownerId);
  },

  /**
   * 워크스페이스 이름 변경 (owner 만 — RLS 강제)
   */
  async updateWorkspaceName(input: { workspaceId: string; name: string }): Promise<Workspace> {
    const parsed = updateWorkspaceNameSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값 오류';
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { userMessage: message });
    }
    return workspaceRepository.updateName(parsed.data.workspaceId, parsed.data.name);
  },

  /**
   * 사용자가 속한 모든 워크스페이스 (owner OR editor)
   */
  async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    try {
      return await workspaceRepository.findAllByMember(userId);
    } catch (error) {
      logger.warn('listWorkspacesForUser 실패', { userId, error: String(error) });
      toValidationError(error);
    }
  },

  /**
   * 워크스페이스 멤버 (editor) 목록 + 사용자 정보
   */
  async listMembers(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    return workspaceMemberRepository.findByWorkspaceWithUser(workspaceId);
  },

  /**
   * 멤버 제거 (owner 만 — RPC 권한 체크)
   */
  async removeMember(input: { workspaceId: string; userId: string }): Promise<void> {
    const parsed = removeWorkspaceMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '입력값을 확인해주세요',
      });
    }
    await workspaceMemberRepository.removeViaRpc(parsed.data.workspaceId, parsed.data.userId);
  },
};
