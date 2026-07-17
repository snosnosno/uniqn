/**
 * UNIQN Mobile - 사용자 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { passwordSchema, passwordConfirmSchema } from './auth.schema';
import { xssValidation, isSafeUrl } from '@/utils/security';

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
 *
 * @note 'deactivated'는 탈퇴 요청(requestDeletion) 시 DB users.status에 실기록되는
 *       유예 상태다. 이 값이 enum에 없으면 strict parse가 레코드를 거부해 증발시키므로 포함한다.
 */
export const userStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'deactivated',
  'deleted',
]);

export type UserStatusSchema = z.infer<typeof userStatusSchema>;

// ============================================================================
// 프로필 스키마
// ============================================================================

/**
 * 성별 스키마
 */
export const genderSchema = z.enum(['male', 'female']);

export type GenderSchema = z.infer<typeof genderSchema>;

/**
 * 프로필 업데이트 스키마
 *
 * @note name, phone, birthDate는 본인인증 결과이므로 수정 불가.
 *       gender는 본인인증에서 누락된 사용자의 set-once 입력만 허용 (서비스 레이어에서 기존 값 보호).
 */
export const updateProfileSchema = z.object({
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
    .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  photoURL: z
    .string()
    .url({ message: '올바른 URL 형식이 아닙니다' })
    .refine((url) => isSafeUrl(url), { message: '허용되지 않는 URL 형식입니다' })
    .nullable()
    .optional(),
  // 본인인증 누락 시 set-once 입력 (서비스 레이어에서 기존 값 덮어쓰기 차단)
  gender: genderSchema.optional(),
  // 추가 정보 (본인인증 정보가 아닌 필드만)
  region: z
    .string()
    .max(50, { message: '지역은 50자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  experienceYears: z
    .number()
    .min(0, { message: '경력은 0년 이상이어야 합니다' })
    .max(50, { message: '경력은 50년을 초과할 수 없습니다' })
    .optional(),
  career: z
    .string()
    .max(500, { message: '이력은 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  note: z
    .string()
    .max(300, { message: '기타사항은 300자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;

/**
 * 구인자 소개글 스키마 (주로 구인하는 지역/매장/대회)
 * @description 등록 신청 시 필수 입력. trim 후 10~300자, XSS 검증.
 */
export const employerIntroSchema = z
  .string()
  .trim()
  .min(10, { message: '소개글은 최소 10자 이상 입력해주세요' })
  .max(300, { message: '소개글은 300자를 초과할 수 없습니다' })
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

export type EmployerIntroData = z.infer<typeof employerIntroSchema>;

// ============================================================================
// 설정 스키마
// ============================================================================

/**
 * 알림 설정 스키마
 */
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  pushEnabled: z.boolean().optional(),
  categories: z
    .record(
      z.string(),
      z.object({
        enabled: z.boolean(),
        pushEnabled: z.boolean(),
      })
    )
    .optional(),
  quietHours: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
      end: z.string().regex(/^\d{2}:\d{2}$/, { message: 'HH:MM 형식이어야 합니다' }),
    })
    .optional(),
});

export type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>;

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

// ============================================================================
// Firestore 문서 파서
// ============================================================================

/**
 * Firestore 사용자 문서 경량 검증
 *
 * @description 필수 필드(role, status) 존재 확인.
 * User 문서는 스키마가 넓고 선택 필드가 많아 Zod 전체 파싱 대신 경량 검증 적용.
 */
export function parseUserDocument<T>(data: T | undefined): T | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (!record.role || !record.status) return null;
  return data;
}
