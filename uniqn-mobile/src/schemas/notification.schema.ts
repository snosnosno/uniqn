/**
 * UNIQN Mobile - 알림 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

// ============================================================================
// 알림 타입 스키마
// ============================================================================

/**
 * 알림 타입 스키마
 */
export const notificationTypeSchema = z.enum([
  // 지원 관련
  'new_application',
  'application_cancelled',
  'application_confirmed',
  'confirmation_cancelled',
  'application_rejected',
  // 출퇴근/스케줄 관련
  'staff_checked_in',
  'staff_checked_out',
  'checkin_reminder',
  'no_show_alert',
  'schedule_change',
  'schedule_created',
  'schedule_cancelled',
  // 정산 관련
  'settlement_completed',
  'settlement_requested',
  // 공고 관련
  'job_closing_soon',
  'new_job_in_area',
  'job_updated',
  'job_cancelled',
  // 칩 관련
  'chips_purchased',
  'low_chips_warning',
  'chips_refunded',
  // 시스템
  'announcement',
  'maintenance',
  'app_update',
  // 관리자
  'inquiry_answered',
  'report_resolved',
]);

export type NotificationTypeSchema = z.infer<typeof notificationTypeSchema>;

/**
 * 알림 카테고리 스키마
 */
export const notificationCategorySchema = z.enum([
  'application',
  'attendance',
  'settlement',
  'job',
  'chips',
  'system',
  'admin',
]);

export type NotificationCategorySchema = z.infer<typeof notificationCategorySchema>;

/**
 * 알림 우선순위 스키마
 */
export const notificationPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export type NotificationPrioritySchema = z.infer<typeof notificationPrioritySchema>;

// ============================================================================
// 알림 데이터 스키마
// ============================================================================

/**
 * 알림 생성 스키마
 */
export const createNotificationSchema = z.object({
  recipientId: z.string().min(1, { message: '수신자 ID는 필수입니다' }),
  type: notificationTypeSchema,
  title: z.string().min(1, { message: '제목은 필수입니다' }).max(100, { message: '제목은 100자를 초과할 수 없습니다' }),
  body: z.string().min(1, { message: '본문은 필수입니다' }).max(500, { message: '본문은 500자를 초과할 수 없습니다' }),
  link: z.string().optional(),
  data: z.record(z.string(), z.string()).optional(),
  priority: notificationPrioritySchema.optional(),
});

export type CreateNotificationData = z.infer<typeof createNotificationSchema>;

/**
 * 알림 필터 스키마
 */
export const notificationFilterSchema = z.object({
  isRead: z.boolean().optional(),
  category: notificationCategorySchema.optional(),
  types: z.array(notificationTypeSchema).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type NotificationFilterData = z.infer<typeof notificationFilterSchema>;

// ============================================================================
// 알림 설정 스키마
// ============================================================================

/**
 * 카테고리별 알림 설정 스키마
 */
export const categoryNotificationSettingSchema = z.object({
  enabled: z.boolean(),
  pushEnabled: z.boolean(),
});

export type CategoryNotificationSettingData = z.infer<typeof categoryNotificationSettingSchema>;

/**
 * 알림 설정 업데이트 스키마
 */
export const updateNotificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  categories: z.record(z.string(), categoryNotificationSettingSchema).optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
    end: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
  }).optional(),
});

export type UpdateNotificationSettingsData = z.infer<typeof updateNotificationSettingsSchema>;

// ============================================================================
// 알림 액션 스키마
// ============================================================================

/**
 * 알림 읽음 처리 스키마
 */
export const markNotificationReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1, { message: '알림 ID가 최소 1개 이상 필요합니다' }),
});

export type MarkNotificationReadData = z.infer<typeof markNotificationReadSchema>;

/**
 * 알림 삭제 스키마
 */
export const deleteNotificationsSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1, { message: '알림 ID가 최소 1개 이상 필요합니다' }),
});

export type DeleteNotificationsData = z.infer<typeof deleteNotificationsSchema>;

/**
 * 모든 알림 읽음 처리 스키마
 */
export const markAllNotificationsReadSchema = z.object({
  category: notificationCategorySchema.optional(),
  beforeDate: z.string().datetime().optional(),
});

export type MarkAllNotificationsReadData = z.infer<typeof markAllNotificationsReadSchema>;
