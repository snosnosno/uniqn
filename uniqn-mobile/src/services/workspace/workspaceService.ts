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
  archiveWorkspaceSchema,
  restoreWorkspaceSchema,
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
   * 새 워크스페이스 생성 — `create_workspace` RPC 경유 (SECURITY DEFINER + public.users.role 조회).
   *
   * ownerId 는 RPC 가 auth.uid() 로 자동 결정 — 클라이언트 입력 무시.
   * RPC 가 cap (10) 와 role(employer/admin) 검증 → mapWorkspaceRpcError 가 도메인 에러로 변환.
   */
  async createWorkspace(input: { name: string }): Promise<Workspace> {
    const parsed = createWorkspaceSchema.safeParse({ name: input.name });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값 오류';
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { userMessage: message });
    }

    return workspaceRepository.create(parsed.data.name);
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
   * `workspace_id NOT NULL` 제약 충족용 — owner 의 가장 오래된 워크스페이스 (created_at ASC).
   *
   * 2026-05-19 hotfix: 신규 employer (backfill 2026-05-07 이후 가입) + staff→employer 역할 변경자는
   * default workspace 부재 가능. 0개 발견 시 자동 생성 + 재조회 (안전망).
   * 영구 해결은 handle_new_user trigger 의 employer 자동 workspace 생성 (마이그레이션 20260519).
   *
   * @throws BusinessError E6 워크스페이스 없음 (자동 생성도 실패한 경우)
   */
  async getDefaultWorkspaceIdForOwner(ownerId: string): Promise<string> {
    const ownedId = await this.pickOwnedWorkspaceId(ownerId);
    if (ownedId) return ownedId;

    logger.warn('default workspace not found — auto-creating', { ownerId });
    try {
      await workspaceRepository.create('내 워크스페이스');
    } catch (createError) {
      logger.error('default workspace auto-create 실패', {
        ownerId,
        error: String(createError),
      });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '워크스페이스를 찾을 수 없어요. 잠시 후 다시 시도해주세요.',
        metadata: { ownerId, autoCreateFailed: true },
      });
    }

    const retryId = await this.pickOwnedWorkspaceId(ownerId);
    if (retryId) return retryId;

    logger.error('default workspace not found after auto-create', { ownerId });
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '워크스페이스를 찾을 수 없어요. 잠시 후 다시 시도해주세요.',
      metadata: { ownerId, retryAfterCreate: true },
    });
  },

  async pickOwnedWorkspaceId(ownerId: string): Promise<string | null> {
    const workspaces = await workspaceRepository.findAllByMember(ownerId);
    const owned = workspaces
      .filter((w) => w.ownerId === ownerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return owned[0]?.id ?? null;
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
   * 워크스페이스 아카이브 (owner 만 — RPC 권한 체크).
   * 진행공고(active/approved/pending) 있으면 RPC 가 차단.
   */
  async archiveWorkspace(input: { workspaceId: string }): Promise<void> {
    const parsed = archiveWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '입력값을 확인해주세요',
      });
    }
    await workspaceRepository.archiveViaRpc(parsed.data.workspaceId);
  },

  /**
   * 워크스페이스 복원 (owner 만). 활성 cap(10) 초과 시 RPC 가 차단.
   */
  async restoreWorkspace(input: { workspaceId: string }): Promise<void> {
    const parsed = restoreWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '입력값을 확인해주세요',
      });
    }
    await workspaceRepository.restoreViaRpc(parsed.data.workspaceId);
  },

  /**
   * 내가 owner 인 아카이브된 워크스페이스 목록 (보관함).
   */
  async listArchivedWorkspaces(ownerId: string): Promise<Workspace[]> {
    return workspaceRepository.findArchivedByOwner(ownerId);
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
      // 워크스페이스 멤버는 구조적으로 employer/admin 전제(공고 생성 RLS·(employer) 라우트 가드).
      // staff 를 초대하면 수락 화면이 employer 전용이라 수신자가 도달 불가한 dead-end 가 되므로
      // 조회 단계에서 employer/admin 으로 한정해 애초에 초대되지 않도록 막는다.
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, photo_url, is_active')
        .eq('email', trimmed)
        .in('role', ['employer', 'admin'])
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
