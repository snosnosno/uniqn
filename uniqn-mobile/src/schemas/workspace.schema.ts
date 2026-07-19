/**
 * UNIQN Mobile - 워크스페이스 관련 Zod 스키마
 *
 * @description 공고 워크스페이스 협업 편집 (PR #2)
 * @version 1.0.0
 *
 * - workspaceSchema: 생성/수정 시 name 검증 (XSS + 길이)
 * - inviteWorkspaceMemberSchema: 초대 RPC 입력
 * - workspaceInvitationStatusSchema: status enum (DB CHECK 와 일치)
 * - workspaceRoleSchema: 'editor' 단일 (D2 — owner 는 workspaces.owner_id 단독)
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

// ============================================================================
// Enums
// ============================================================================

export const workspaceRoleSchema = z.literal('editor');
export type WorkspaceRoleSchema = z.infer<typeof workspaceRoleSchema>;

export const workspaceInvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'revoked',
  'expired',
]);
export type WorkspaceInvitationStatusSchema = z.infer<typeof workspaceInvitationStatusSchema>;

// ============================================================================
// Field schemas
// ============================================================================

/**
 * 워크스페이스 이름 — DB CHECK (1~50자) + XSS
 */
export const workspaceNameSchema = z
  .string({ error: '팀 이름을 입력해주세요' })
  .trim()
  .min(1, { message: '팀 이름을 입력해주세요' })
  .max(50, { message: '팀 이름은 50자를 초과할 수 없습니다' })
  .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

// ============================================================================
// 워크스페이스 생성 / 수정
// ============================================================================

/**
 * 워크스페이스 생성 입력 (Service 진입점)
 * owner_id 는 인증 컨텍스트에서 자동 주입 — 입력 받지 않음.
 */
export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export type CreateWorkspaceData = z.infer<typeof createWorkspaceSchema>;

/**
 * 워크스페이스 이름 변경
 */
export const updateWorkspaceNameSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 팀 ID 가 아닙니다' }),
  name: workspaceNameSchema,
});

export type UpdateWorkspaceNameData = z.infer<typeof updateWorkspaceNameSchema>;

// ============================================================================
// 멤버 초대 / 관리
// ============================================================================

export const inviteWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 팀 ID 가 아닙니다' }),
  inviteeUserId: z.string().uuid({ message: '올바른 사용자 ID 가 아닙니다' }),
  role: workspaceRoleSchema.default('editor'),
});

export type InviteWorkspaceMemberData = z.infer<typeof inviteWorkspaceMemberSchema>;

export const removeWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type RemoveWorkspaceMemberData = z.infer<typeof removeWorkspaceMemberSchema>;

// ============================================================================
// 초대 응답 (RPC 입력)
// ============================================================================

export const respondInvitationSchema = z.object({
  invitationId: z.string().uuid({ message: '올바른 초대 ID 가 아닙니다' }),
});

export type RespondInvitationData = z.infer<typeof respondInvitationSchema>;

// ============================================================================
// 아카이브 / 복원 (RPC 입력)
// ============================================================================

export const archiveWorkspaceSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 팀 ID 가 아닙니다' }),
});
export type ArchiveWorkspaceData = z.infer<typeof archiveWorkspaceSchema>;

export const restoreWorkspaceSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 팀 ID 가 아닙니다' }),
});
export type RestoreWorkspaceData = z.infer<typeof restoreWorkspaceSchema>;
