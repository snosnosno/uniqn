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
  })
  .refine(xssValidation, { message: '사용할 수 없는 문자열이 포함되어 있습니다' });

/**
 * 닉네임 검증 스키마
 */
export const nicknameSchema = z
  .string()
  .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
  .max(15, { message: '닉네임은 15자를 초과할 수 없습니다' })
  .trim()
  .refine(xssValidation, { message: '사용할 수 없는 문자열이 포함되어 있습니다' });

/**
 * 전화번호 검증 스키마
 */
export const phoneSchema = z
  .string()
  .min(1, { message: '전화번호를 입력해주세요' })
  .refine(
    (val) => {
      const cleaned = val.replace(/[-\s]/g, '');
      // E.164 (+8210...) 또는 로컬 (010...) 형식 허용
      return /^\+82[0-9]{9,10}$/.test(cleaned) || /^01[0-9]{8,9}$/.test(cleaned);
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
 * 회원가입 Account 스키마 (계정 정보)
 *
 * 플로우: 약관동의 → 계정 → 본인인증 → 프로필
 * ⚠️ 이메일 인증 사용 안함 - 휴대폰 본인인증으로 대체
 */
export const signUpAccountSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: passwordConfirmSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export type SignUpAccountData = z.infer<typeof signUpAccountSchema>;

/**
 * 생년월일 검증 스키마 (YYYYMMDD)
 *
 * @sync functions/src/auth/verifyAndSaveProfile.ts:174-218
 * 이 스키마를 변경할 때 반드시 CF 측 검증 로직도 함께 수정하세요.
 * 특히: MIN_SIGNUP_AGE(14), 생년월일 검증 범위
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
  )
  .refine(
    (val) => {
      const year = parseInt(val.substring(0, 4), 10);
      const month = parseInt(val.substring(4, 6), 10);
      const day = parseInt(val.substring(6, 8), 10);
      const today = new Date();
      let age = today.getFullYear() - year;
      const m = today.getMonth() + 1 - month;
      if (m < 0 || (m === 0 && today.getDate() < day)) age--;
      return age >= 14;
    },
    { message: '만 14세 이상만 가입할 수 있습니다' }
  );

/**
 * 성별 선택 스키마 (회원가입용)
 */
export const signupGenderSchema = z.enum(['male', 'female'], {
  error: '성별을 선택해주세요',
});

/**
 * 회원가입 Identity 스키마 (본인인증 - 필수)
 *
 * PortOne KG이니시스 통합 본인인증 결과를 검증한다.
 * - identityVerificationId: PortOne 발급 인증 ID (서버에서 PortOne API로 재조회)
 * - name/birthDate/gender/verifiedPhone: PortOne 결과를 form 에 채워 넣은 사본 (서버는 신뢰하지 않음)
 */
export const signUpIdentitySchema = z.object({
  name: nameSchema,
  birthDate: birthDateSchema,
  gender: signupGenderSchema,
  phoneVerified: z.boolean().refine((val) => val === true, {
    message: '전화번호 인증이 필요합니다',
  }),
  verifiedPhone: phoneSchema,
  identityVerificationId: z.string().min(1).max(200),
});

export type SignUpIdentityData = z.infer<typeof signUpIdentitySchema>;

/**
 * 회원가입 Profile 스키마 (프로필 정보)
 *
 * 닉네임만 필수, 나머지는 선택 (가입 후 프로필 설정에서도 수정 가능)
 * 선택 필드 검증 규칙은 user.schema.ts의 updateProfileSchema와 동일
 */
export const signUpProfileSchema = z.object({
  nickname: nicknameSchema,
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

export type SignUpProfileData = z.infer<typeof signUpProfileSchema>;

/**
 * 회원가입 Terms 스키마 (약관 동의)
 */
export const signUpTermsSchema = z.object({
  termsAgreed: z.boolean().refine((val) => val === true, {
    message: '이용약관에 동의해주세요',
  }),
  privacyAgreed: z.boolean().refine((val) => val === true, {
    message: '개인정보처리방침에 동의해주세요',
  }),
  marketingAgreed: z.boolean(),
});

export type SignUpTermsData = z.infer<typeof signUpTermsSchema>;

/**
 * 전체 회원가입 스키마 (4단계)
 *
 * 개별 필드 스키마와 Step 스키마에서 조합. passwordConfirm은 Step1에서만 사용.
 */
export const signUpSchema = z.object({
  // 계정 정보 (소셜 모드는 빈 문자열 허용)
  email: emailSchema.or(z.literal('')),
  password: passwordSchema.or(z.literal('')),
  // 본인인증 (최종 제출 시 phoneVerified는 반드시 true)
  ...signUpIdentitySchema.shape,
  phoneVerified: z.literal(true, {
    error: '전화번호 인증이 필요합니다',
  }),
  verifiedPhone: phoneSchema,
  // 약관 동의
  ...signUpTermsSchema.shape,
  // 프로필은 가입 후 별도 화면에서 입력 (profileCompleted 플래그로 관리)
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
