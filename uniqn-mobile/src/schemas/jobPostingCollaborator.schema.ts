/**
 * UNIQN Mobile - 공고별 협업자 Zod 스키마
 *
 * @description 공고 단위 협업자 권한 입력 검증
 *              CLAUDE.md 보안 규칙: 모든 사용자 입력에 xssValidation 필수
 * @version 1.0.0
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

// ============================================================================
// 도메인 타입 (DB 행 → 도메인)
// ============================================================================

export const jobPostingCollaboratorSchema = z.object({
  id: z.string().uuid(),
  jobPostingId: z.string().uuid(),
  userId: z.string().uuid(),
  addedBy: z.string().uuid(),
  addedAt: z.string(), // ISO 8601 (timestamptz)
});

export type JobPostingCollaboratorData = z.infer<typeof jobPostingCollaboratorSchema>;

// ============================================================================
// 협업자 추가 입력
// ============================================================================

/**
 * 협업자 추가 (Service 진입점)
 * UI 에서 이메일로 검색 → userId 확정 후 호출
 */
export const addCollaboratorSchema = z.object({
  jobPostingId: z.string().uuid({ message: '올바른 공고 ID 가 아닙니다' }),
  userId: z.string().uuid({ message: '올바른 사용자 ID 가 아닙니다' }),
});

export type AddCollaboratorData = z.infer<typeof addCollaboratorSchema>;

// ============================================================================
// 이메일 검색
// ============================================================================

/**
 * 협업자 추가용 사용자 검색 (이메일 prefix)
 */
export const searchCollaboratorCandidateSchema = z.object({
  jobPostingId: z.string().uuid({ message: '올바른 공고 ID 가 아닙니다' }),
  emailQuery: z
    .string({ error: '이메일을 입력해주세요' })
    .trim()
    .min(3, { message: '3자 이상 입력해주세요' })
    .max(254, { message: '이메일이 너무 깁니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' }),
});

export type SearchCollaboratorCandidateData = z.infer<typeof searchCollaboratorCandidateSchema>;

// ============================================================================
// 협업자 제거 (workspace owner OR 본인)
// ============================================================================

export const removeCollaboratorSchema = z.object({
  jobPostingId: z.string().uuid({ message: '올바른 공고 ID 가 아닙니다' }),
  userId: z.string().uuid({ message: '올바른 사용자 ID 가 아닙니다' }),
});

export type RemoveCollaboratorData = z.infer<typeof removeCollaboratorSchema>;
