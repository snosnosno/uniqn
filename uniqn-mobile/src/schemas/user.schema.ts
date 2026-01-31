/**
 * UNIQN Mobile - 사용자 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { passwordSchema, passwordConfirmSchema } from './auth.schema';

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
 * 성별 스키마
 */
export const genderSchema = z.enum(['male', 'female', 'other']);

export type GenderSchema = z.infer<typeof genderSchema>;

/**
 * 프로필 업데이트 스키마
 *
 * @note name, phone, birthYear, gender는 본인인증 정보이므로 수정 불가
 */
export const updateProfileSchema = z.object({
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
    .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
    .trim()
    .optional(),
  photoURL: z.string().url({ message: '올바른 URL 형식이 아닙니다' }).optional(),
  bio: z.string().max(200, { message: '자기소개는 200자를 초과할 수 없습니다' }).optional(),
  // 추가 정보 (본인인증 정보가 아닌 필드만)
  region: z.string().max(50, { message: '지역은 50자를 초과할 수 없습니다' }).optional(),
  experienceYears: z
    .number()
    .min(0, { message: '경력은 0년 이상이어야 합니다' })
    .max(50, { message: '경력은 50년을 초과할 수 없습니다' })
    .optional(),
  career: z.string().max(500, { message: '이력은 500자를 초과할 수 없습니다' }).optional(),
  note: z.string().max(300, { message: '기타사항은 300자를 초과할 수 없습니다' }).optional(),
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

/**
 * 구인자 등록 스키마 (staff → employer 역할 변경)
 * @description 본인인증 완료 후 동의만으로 구인자 등록
 */
export const employerRegisterSchema = z.object({
  agreeToEmployerTerms: z.literal(true, {
    message: '구인자 이용약관에 동의해주세요',
  }),
  agreeToLiabilityWaiver: z.literal(true, {
    message: '서약서에 동의해주세요',
  }),
});

export type EmployerRegisterData = z.infer<typeof employerRegisterSchema>;

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

// ============================================================================
// 비밀번호 변경 스키마
// ============================================================================

/**
 * 비밀번호 변경 스키마
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, { message: '현재 비밀번호를 입력해주세요' }),
    newPassword: passwordSchema,
    confirmPassword: passwordConfirmSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '현재 비밀번호와 다른 비밀번호를 입력해주세요',
    path: ['newPassword'],
  });

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
