/**
 * UNIQN Mobile - 공지사항 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description 관리자 공지사항 관리 관련 검증 스키마
 */

import { z } from 'zod';

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * 공지사항 카테고리 스키마
 */
export const announcementCategorySchema = z.enum(
  ['notice', 'update', 'event', 'maintenance'],
  {
    error: '카테고리를 선택해주세요',
  }
);

export type AnnouncementCategorySchema = z.infer<typeof announcementCategorySchema>;

/**
 * 공지사항 상태 스키마
 */
export const announcementStatusSchema = z.enum(['draft', 'published', 'archived'], {
  error: '상태를 선택해주세요',
});

export type AnnouncementStatusSchema = z.infer<typeof announcementStatusSchema>;

/**
 * 공지사항 우선순위 스키마
 */
export const announcementPrioritySchema = z.union([z.literal(0), z.literal(1), z.literal(2)], {
  error: '우선순위를 선택해주세요',
});

export type AnnouncementPrioritySchema = z.infer<typeof announcementPrioritySchema>;

/**
 * 사용자 역할 스키마 (대상 선택용)
 */
export const userRoleSchema = z.enum(['admin', 'employer', 'staff'], {
  error: '역할을 선택해주세요',
});

// ============================================================================
// 대상 설정 스키마
// ============================================================================

/**
 * 대상 설정 스키마
 */
export const targetAudienceSchema = z
  .object({
    type: z.enum(['all', 'roles'], {
      error: '대상 유형을 선택해주세요',
    }),
    roles: z.array(userRoleSchema).optional(),
  })
  .refine(
    (data) => {
      // type이 'roles'이면 roles 배열이 필요
      if (data.type === 'roles') {
        return data.roles && data.roles.length > 0;
      }
      return true;
    },
    { message: '대상 역할을 최소 1개 이상 선택해주세요' }
  );

export type TargetAudienceSchema = z.infer<typeof targetAudienceSchema>;

// ============================================================================
// 공지사항 생성 스키마 (관리자)
// ============================================================================

/**
 * 공지사항 제목 스키마
 */
export const announcementTitleSchema = z
  .string()
  .min(2, { message: '제목은 최소 2자 이상 입력해주세요' })
  .max(100, { message: '제목은 100자를 초과할 수 없습니다' })
  .trim();

/**
 * 공지사항 내용 스키마
 */
export const announcementContentSchema = z
  .string()
  .min(10, { message: '내용은 최소 10자 이상 입력해주세요' })
  .max(5000, { message: '내용은 5000자를 초과할 수 없습니다' })
  .trim();

/**
 * 공지사항 생성 스키마
 */
export const createAnnouncementSchema = z.object({
  title: announcementTitleSchema,
  content: announcementContentSchema,
  category: announcementCategorySchema,
  priority: announcementPrioritySchema.optional().default(0),
  isPinned: z.boolean().optional().default(false),
  targetAudience: targetAudienceSchema,
});

export type CreateAnnouncementFormData = z.infer<typeof createAnnouncementSchema>;

// ============================================================================
// 공지사항 수정 스키마 (관리자)
// ============================================================================

/**
 * 공지사항 수정 스키마
 */
export const updateAnnouncementSchema = z.object({
  title: announcementTitleSchema.optional(),
  content: announcementContentSchema.optional(),
  category: announcementCategorySchema.optional(),
  priority: announcementPrioritySchema.optional(),
  isPinned: z.boolean().optional(),
  targetAudience: targetAudienceSchema.optional(),
});

export type UpdateAnnouncementFormData = z.infer<typeof updateAnnouncementSchema>;

// ============================================================================
// 필터 스키마
// ============================================================================

/**
 * 공지사항 필터 스키마 (관리자)
 */
export const announcementFilterSchema = z.object({
  status: z
    .enum(['all', 'draft', 'published', 'archived'])
    .optional()
    .default('all'),
  category: z
    .enum(['all', 'notice', 'update', 'event', 'maintenance'])
    .optional()
    .default('all'),
});

export type AnnouncementFilterData = z.infer<typeof announcementFilterSchema>;
