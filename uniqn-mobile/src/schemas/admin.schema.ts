/**
 * UNIQN Mobile - 관리자 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { userRoleSchema, userStatusSchema } from './user.schema';
import { xssValidation } from '@/utils/security';

// ============================================================================
// 사용자 관리 스키마
// ============================================================================

/**
 * 사용자 역할 변경 스키마
 */
export const changeUserRoleSchema = z.object({
  userId: z.string().min(1, { message: '사용자 ID는 필수입니다' }),
  newRole: userRoleSchema,
  reason: z
    .string()
    .max(200, { message: '사유는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type ChangeUserRoleData = z.infer<typeof changeUserRoleSchema>;

/**
 * 사용자 상태 변경 스키마
 */
export const changeUserStatusSchema = z.object({
  userId: z.string().min(1, { message: '사용자 ID는 필수입니다' }),
  newStatus: userStatusSchema,
  reason: z
    .string()
    .min(1, { message: '상태 변경 사유는 필수입니다' })
    .max(500, { message: '사유는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  duration: z.number().min(1).optional(), // 정지 기간 (일)
});

export type ChangeUserStatusData = z.infer<typeof changeUserStatusSchema>;

/**
 * 사용자 정지 스키마
 */
export const suspendUserSchema = z.object({
  userId: z.string().min(1, { message: '사용자 ID는 필수입니다' }),
  reason: z
    .string()
    .min(10, { message: '정지 사유는 최소 10자 이상이어야 합니다' })
    .max(500)
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  duration: z
    .number()
    .min(1, { message: '정지 기간은 최소 1일 이상이어야 합니다' })
    .max(365, { message: '정지 기간은 365일을 초과할 수 없습니다' }),
});

export type SuspendUserData = z.infer<typeof suspendUserSchema>;

// ============================================================================
// 신고/페널티 스키마
// ============================================================================

/**
 * 신고 타입 스키마
 */
export const reportTypeSchema = z.enum([
  'inappropriate_content', // 부적절한 콘텐츠
  'harassment', // 괴롭힘
  'spam', // 스팸
  'fraud', // 사기
  'no_show', // 노쇼
  'other', // 기타
]);

export type ReportTypeSchema = z.infer<typeof reportTypeSchema>;

/**
 * 신고 상태 스키마
 */
export const reportStatusSchema = z.enum([
  'pending', // 대기 중
  'reviewing', // 검토 중
  'resolved', // 해결됨
  'dismissed', // 기각됨
]);

export type ReportStatusSchema = z.infer<typeof reportStatusSchema>;

/**
 * 신고 생성 스키마
 */
export const createReportSchema = z.object({
  targetUserId: z.string().min(1, { message: '신고 대상 사용자 ID는 필수입니다' }),
  targetType: z.enum(['user', 'jobPosting', 'review', 'comment']),
  targetId: z.string().min(1, { message: '신고 대상 ID는 필수입니다' }),
  type: reportTypeSchema,
  description: z
    .string()
    .min(10, { message: '신고 내용은 최소 10자 이상이어야 합니다' })
    .max(1000, { message: '신고 내용은 1000자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  evidence: z
    .array(z.string().url())
    .max(5, { message: '증거 파일은 최대 5개까지 첨부 가능합니다' })
    .optional(),
});

export type CreateReportData = z.infer<typeof createReportSchema>;

/**
 * 신고 처리 스키마
 */
export const processReportSchema = z.object({
  reportId: z.string().min(1, { message: '신고 ID는 필수입니다' }),
  status: reportStatusSchema,
  adminNote: z
    .string()
    .max(500, { message: '관리자 메모는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  penaltyApplied: z.boolean().optional(),
});

export type ProcessReportData = z.infer<typeof processReportSchema>;

// ============================================================================
// 공지사항 스키마
// ============================================================================

/**
 * 공지사항 타입 스키마
 */
export const announcementTypeSchema = z.enum([
  'notice', // 일반 공지
  'maintenance', // 점검 공지
  'update', // 업데이트 공지
  'event', // 이벤트
]);

export type AnnouncementTypeSchema = z.infer<typeof announcementTypeSchema>;

/**
 * 공지사항 생성 스키마
 */
export const createAnnouncementSchema = z.object({
  type: announcementTypeSchema,
  title: z
    .string()
    .min(1, { message: '제목은 필수입니다' })
    .max(100, { message: '제목은 100자를 초과할 수 없습니다' }),
  content: z
    .string()
    .min(1, { message: '내용은 필수입니다' })
    .max(5000, { message: '내용은 5000자를 초과할 수 없습니다' }),
  targetRoles: z.array(userRoleSchema).optional(), // 특정 역할에만 표시
  isPinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateAnnouncementData = z.infer<typeof createAnnouncementSchema>;

// ============================================================================
// 통계 스키마
// ============================================================================

/**
 * 관리자 대시보드 필터 스키마
 */
export const adminDashboardFiltersSchema = z.object({
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  }),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

export type AdminDashboardFiltersData = z.infer<typeof adminDashboardFiltersSchema>;
