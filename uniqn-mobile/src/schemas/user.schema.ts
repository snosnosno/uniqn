/**
 * UNIQN Mobile - 사용자 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { nameSchema, phoneSchema } from './auth.schema';

// ============================================================================
// 사용자 역할 스키마
// ============================================================================

/**
 * 사용자 역할 스키마
 */
export const userRoleSchema = z.enum(['admin', 'employer', 'staff']);

export type UserRoleSchema = z.infer<typeof userRoleSchema>;

/**
 * 사용자 상태 스키마
 */
export const userStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted']);

export type UserStatusSchema = z.infer<typeof userStatusSchema>;

// ============================================================================
// 프로필 스키마
// ============================================================================

/**
 * 프로필 업데이트 스키마
 */
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
    .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
    .trim()
    .optional(),
  phone: phoneSchema.optional(),
  photoURL: z.string().url({ message: '올바른 URL 형식이 아닙니다' }).optional(),
  bio: z.string().max(200, { message: '자기소개는 200자를 초과할 수 없습니다' }).optional(),
});

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;

/**
 * 스태프 프로필 스키마
 */
export const staffProfileSchema = z.object({
  preferredRoles: z.array(z.string()).optional(),
  preferredRegions: z.array(z.string()).optional(),
  experience: z.string().max(500, { message: '경력 설명은 500자를 초과할 수 없습니다' }).optional(),
  availableDays: z.array(z.number().min(0).max(6)).optional(), // 0=일요일, 6=토요일
});

export type StaffProfileData = z.infer<typeof staffProfileSchema>;

/**
 * 구인자 프로필 스키마
 */
export const employerProfileSchema = z.object({
  companyName: z.string().min(1, { message: '업체명은 필수입니다' }).max(50, { message: '업체명은 50자를 초과할 수 없습니다' }),
  businessNumber: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, { message: '사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)' })
    .optional(),
  address: z.string().max(200, { message: '주소는 200자를 초과할 수 없습니다' }).optional(),
  description: z.string().max(500, { message: '업체 설명은 500자를 초과할 수 없습니다' }).optional(),
});

export type EmployerProfileData = z.infer<typeof employerProfileSchema>;

// ============================================================================
// 설정 스키마
// ============================================================================

/**
 * 알림 설정 스키마
 */
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  pushEnabled: z.boolean().optional(),
  categories: z.record(z.string(),
    z.object({
      enabled: z.boolean(),
      pushEnabled: z.boolean(),
    })
  ).optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
    end: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
  }).optional(),
});

export type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>;

/**
 * 사용자 설정 스키마
 */
export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['ko', 'en']).optional(),
  notifications: notificationSettingsSchema.optional(),
});

export type UserSettingsData = z.infer<typeof userSettingsSchema>;

// ============================================================================
// 검색/필터 스키마
// ============================================================================

/**
 * 사용자 검색 스키마
 */
export const searchUsersSchema = z.object({
  query: z.string().min(1, { message: '검색어를 입력해주세요' }).max(50),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export type SearchUsersData = z.infer<typeof searchUsersSchema>;
