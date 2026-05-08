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
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/supabase';
import {
  createWorkspaceSchema,
  updateWorkspaceNameSchema,
  removeWorkspaceMemberSchema,
} from '@/schemas/workspace.schema';
import { ValidationError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
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
   * Owner 의 default 워크스페이스 ID (가장 오래된 것).
   *
   * 무료 공고 생성 (`jobManagementService.createJobPosting`) 경로에서
   * `workspace_id NOT NULL` 제약 (M3) 충족용. M5 wallet RPC 와 동일 정책 (created_at ASC).
   *
   * backfill 후 모든 active employer 는 워크스페이스 1+ 보유 가정.
   * 0개인 경우 BUSINESS_INVALID_STATE — 사용자에게 재시도 안내.
   *
   * @throws BusinessError E6 워크스페이스 없음
   */
  async getDefaultWorkspaceIdForOwner(ownerId: string): Promise<string> {
    const workspaces = await workspaceRepository.findAllByMember(ownerId);
    const owned = workspaces
      .filter((w) => w.ownerId === ownerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (owned.length === 0) {
      logger.warn('default workspace not found', { ownerId });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '워크스페이스를 찾을 수 없어요. 잠시 후 다시 시도해주세요.',
        metadata: { ownerId },
      });
    }
    return owned[0]!.id;
  },

  /**
   * 워크스페이스 멤버 (editor) 목록 + 사용자 정보
   */
  async listMembers(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    return workspaceMemberRepository.findByWorkspaceWithUser(workspaceId);
  },

  /**
   * 워크스페이스 owner 의 public profile (nickname / name / photo).
   * editor 도 호출 가능 — RLS 안전 RPC 경유.
   */
  async getOwnerProfile(
    workspaceId: string
  ): Promise<{ id: string; displayName: string | null; photoUrl: string | null } | null> {
    return workspaceRepository.getOwnerProfile(workspaceId);
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

  /**
   * 초대용 사용자 lookup — 이메일 정확 매칭.
   * (UI 검색 자동완성을 피하기 위해 정확 매칭. 등록된 사용자에게만 초대 발송 가능.)
   */
  async lookupUserByEmail(
    email: string
  ): Promise<{ id: string; name: string | null; email: string; photoUrl: string | null } | null> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed.length < 5 || !trimmed.includes('@')) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, photo_url, is_active')
        .eq('email', trimmed)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '사용자 조회', table: 'users' });
      }

      if (!data || data.is_active === false) {
        return null;
      }

      const row = data as {
        id: string;
        name: string | null;
        email: string;
        photo_url: string | null;
      };
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        photoUrl: row.photo_url ?? null,
      };
    } catch (error) {
      logger.warn('lookupUserByEmail 실패', { email: trimmed, error: String(error) });
      return null;
    }
  },
};
