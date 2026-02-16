/**
 * UNIQN Mobile - 인증 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

/**
 * 이메일 검증 스키마
 */
export const emailSchema = z
  .string()
  .min(1, { message: '이메일을 입력해주세요' })
  .email({ message: '올바른 이메일 형식이 아닙니다' })
  .min(5, { message: '이메일은 최소 5자 이상이어야 합니다' })
  .max(100, { message: '이메일은 100자를 초과할 수 없습니다' })
  .trim()
  .toLowerCase();

/**
 * 비밀번호 검증 스키마
 *
 * 정책:
 * - 최소 8자, 최대 128자
 * - 대문자 1개 이상
 * - 소문자 1개 이상
 * - 숫자 1개 이상
 * - 특수문자 1개 이상 (영문/숫자/공백 외 모든 문자)
 * - 3자 이상 연속 문자 금지 (123, abc 등)
 */
export const passwordSchema = z
  .string()
  .min(1, { message: '비밀번호를 입력해주세요' })
  .min(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  .max(128, { message: '비밀번호는 128자를 초과할 수 없습니다' })
  .refine((val) => /[a-z]/.test(val), {
    message: '소문자를 포함해야 합니다',
  })
  .refine((val) => /[A-Z]/.test(val), {
    message: '대문자를 포함해야 합니다',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: '숫자를 포함해야 합니다',
  })
  .refine((val) => /[^a-zA-Z0-9\s]/.test(val), {
    message: '특수문자를 포함해야 합니다',
  })
  .refine(
    (val) => {
      // 3자 이상 연속 문자 검사 (abc, 123, cba, 321 등)
      for (let i = 0; i < val.length - 2; i++) {
        const c1 = val.charCodeAt(i);
        const c2 = val.charCodeAt(i + 1);
        const c3 = val.charCodeAt(i + 2);
        // 오름차순 연속 (abc, 123)
        if (c2 === c1 + 1 && c3 === c2 + 1) return false;
        // 내림차순 연속 (cba, 321)
        if (c2 === c1 - 1 && c3 === c2 - 1) return false;
      }
      return true;
    },
    { message: '3자 이상 연속된 문자는 사용할 수 없습니다 (예: 123, abc)' }
  );

/**
 * 비밀번호 확인 검증 (단순)
 */
export const passwordConfirmSchema = z.string().min(1, { message: '비밀번호 확인을 입력해주세요' });

/**
 * 이름 검증 스키마
 */
export const nameSchema = z
  .string()
  .min(1, { message: '이름을 입력해주세요' })
  .min(2, { message: '이름은 최소 2자 이상이어야 합니다' })
  .max(20, { message: '이름은 20자를 초과할 수 없습니다' })
  .trim()
  .refine((val) => /^[가-힣a-zA-Z\s]+$/.test(val), {
    message: '이름은 한글, 영문, 공백만 입력 가능합니다',
  });

/**
 * 닉네임 검증 스키마
 */
export const nicknameSchema = z
  .string()
  .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
  .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
  .trim()
  .refine(xssValidation, { message: '사용할 수 없는 문자열이 포함되어 있습니다' })
  .optional();

/**
 * 전화번호 검증 스키마
 */
export const phoneSchema = z
  .string()
  .min(1, { message: '전화번호를 입력해주세요' })
  .refine(
    (val) => {
      const cleaned = val.replace(/[-\s]/g, '');
      return /^01[0-9]{8,9}$/.test(cleaned);
    },
    {
      message: '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)',
    }
  );

/**
 * 역할 선택 스키마 (회원가입 시)
 *
 * 모든 사용자는 staff로 가입. 구인자는 가입 후 별도 등록.
 */
export const roleSelectSchema = z.literal('staff', {
  error: '잘못된 역할입니다',
});

/**
 * 로그인 폼 스키마
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: '비밀번호를 입력해주세요' }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * 회원가입 Step 1 스키마 (계정 정보)
 *
 * 플로우: 계정 → 본인인증 → 프로필 → 약관동의
 * ⚠️ 이메일 인증 사용 안함 - 휴대폰 본인인증으로 대체
 */
export const signUpStep1Schema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: passwordConfirmSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export type SignUpStep1Data = z.infer<typeof signUpStep1Schema>;

/**
 * 생년월일 검증 스키마 (YYYYMMDD)
 */
export const birthDateSchema = z
  .string()
  .min(1, { message: '생년월일을 입력해주세요' })
  .length(8, { message: '생년월일은 8자리(YYYYMMDD)로 입력해주세요' })
  .regex(/^\d{8}$/, { message: '숫자만 입력해주세요' })
  .refine(
    (val) => {
      const year = parseInt(val.substring(0, 4), 10);
      const month = parseInt(val.substring(4, 6), 10);
      const day = parseInt(val.substring(6, 8), 10);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      // 월별 일수 검증
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    },
    { message: '올바른 생년월일을 입력해주세요' }
  );

/**
 * 성별 선택 스키마 (회원가입용)
 */
export const signupGenderSchema = z.enum(['male', 'female'], {
  error: '성별을 선택해주세요',
});

/**
 * 회원가입 Step 2 스키마 (본인인증 - 필수)
 *
 * 이름/생년월일/성별 입력 + Firebase Phone Auth(SMS OTP) 전화번호 인증
 */
export const signUpStep2Schema = z.object({
  name: nameSchema,
  birthDate: birthDateSchema,
  gender: signupGenderSchema,
  phoneVerified: z.literal(true, {
    error: '전화번호 인증이 필요합니다',
  }),
  verifiedPhone: phoneSchema,
});

export type SignUpStep2Data = z.infer<typeof signUpStep2Schema>;

/**
 * 회원가입 Step 3 스키마 (프로필 정보)
 *
 * 닉네임만 필수, 나머지는 선택 (가입 후 프로필 설정에서도 수정 가능)
 * 선택 필드 검증 규칙은 user.schema.ts의 updateProfileSchema와 동일
 */
export const signUpStep3Schema = z.object({
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
    .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, { message: '사용할 수 없는 문자열이 포함되어 있습니다' }),
  role: z.literal('staff'),
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

export type SignUpStep3Data = z.infer<typeof signUpStep3Schema>;

/**
 * 회원가입 Step 4 스키마 (약관 동의)
 */
export const signUpStep4Schema = z.object({
  termsAgreed: z.boolean().refine((val) => val === true, {
    message: '이용약관에 동의해주세요',
  }),
  privacyAgreed: z.boolean().refine((val) => val === true, {
    message: '개인정보처리방침에 동의해주세요',
  }),
  marketingAgreed: z.boolean(),
});

export type SignUpStep4Data = z.infer<typeof signUpStep4Schema>;

/**
 * 전체 회원가입 스키마 (4단계)
 *
 * 개별 필드 스키마와 Step 스키마에서 조합. passwordConfirm은 Step1에서만 사용.
 */
export const signUpSchema = z.object({
  // Step 1: 계정 정보 (passwordConfirm 제외)
  email: emailSchema,
  password: passwordSchema,
  // Step 2: 본인인증
  ...signUpStep2Schema.shape,
  // Step 3: 프로필
  ...signUpStep3Schema.shape,
  // Step 4: 약관 동의
  ...signUpStep4Schema.shape,
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * 비밀번호 재설정 요청 스키마
 */
export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * 인증 코드 검증 스키마
 */
export const verificationCodeSchema = z.object({
  code: z
    .string()
    .length(6, { message: '인증 코드는 6자리입니다' })
    .regex(/^\d+$/, { message: '숫자만 입력해주세요' }),
});

export type VerificationCodeData = z.infer<typeof verificationCodeSchema>;
