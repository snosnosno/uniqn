/**
 * UNIQN Mobile - 인증 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

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
 * - 최소 8자
 * - 대문자, 소문자, 숫자 포함
 */
export const passwordSchema = z
  .string()
  .min(1, { message: '비밀번호를 입력해주세요' })
  .min(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  .max(50, { message: '비밀번호는 50자를 초과할 수 없습니다' })
  .refine((val) => /[a-z]/.test(val), {
    message: '소문자를 포함해야 합니다',
  })
  .refine((val) => /[A-Z]/.test(val), {
    message: '대문자를 포함해야 합니다',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: '숫자를 포함해야 합니다',
  });

/**
 * 비밀번호 확인 검증 (단순)
 */
export const passwordConfirmSchema = z
  .string()
  .min(1, { message: '비밀번호 확인을 입력해주세요' });

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
 * 역할 선택 스키마
 */
export const roleSelectSchema = z.enum(['staff', 'manager'], {
  error: '역할을 선택해주세요',
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
 * 회원가입 Step 1 스키마 (기본 정보)
 */
export const signUpStep1Schema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: passwordConfirmSchema,
    name: nameSchema,
    nickname: nicknameSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export type SignUpStep1Data = z.infer<typeof signUpStep1Schema>;

/**
 * 회원가입 Step 2 스키마 (연락처)
 */
export const signUpStep2Schema = z.object({
  phone: phoneSchema,
});

export type SignUpStep2Data = z.infer<typeof signUpStep2Schema>;

/**
 * 회원가입 Step 3 스키마 (역할 & 동의)
 */
export const signUpStep3Schema = z.object({
  role: roleSelectSchema,
  termsAgreed: z.literal(true, {
    error: '이용약관에 동의해주세요',
  }),
  privacyAgreed: z.literal(true, {
    error: '개인정보처리방침에 동의해주세요',
  }),
  marketingAgreed: z.boolean().optional().default(false),
});

export type SignUpStep3Data = z.infer<typeof signUpStep3Schema>;

/**
 * 전체 회원가입 스키마
 */
export const signUpSchema = signUpStep1Schema
  .merge(signUpStep2Schema)
  .merge(signUpStep3Schema.omit({ termsAgreed: true, privacyAgreed: true }))
  .extend({
    termsAgreed: z.boolean(),
    privacyAgreed: z.boolean(),
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
