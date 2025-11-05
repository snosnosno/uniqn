/**
 * Salary 섹션 Zod 스키마
 *
 * 급여 정보 (급여 타입, 금액, 복리후생, 역할별 차등 급여) 검증
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/
 */

import { z } from 'zod';

/**
 * 급여 타입 열거형
 */
export const SalaryTypeSchema = z.enum(['hourly', 'daily', 'monthly', 'negotiable', 'other'], {
  errorMap: () => ({ message: '올바른 급여 타입을 선택해주세요' })
});

/**
 * 복리후생 정보 스키마
 */
export const benefitsSchema = z.object({
  /**
   * 보장시간 (선택)
   */
  guaranteedHours: z
    .string()
    .trim()
    .max(100, { message: '보장시간은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 복장 관련 지원 (선택)
   */
  clothing: z
    .string()
    .trim()
    .max(100, { message: '복장 지원은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 식사 제공 여부 (선택)
   */
  meal: z
    .string()
    .trim()
    .max(100, { message: '식사 제공은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 교통비 지원 (일당, 선택)
   */
  transportation: z
    .string()
    .trim()
    .max(100, { message: '교통비 지원은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 식비 지원 (일당, 선택)
   */
  mealAllowance: z
    .string()
    .trim()
    .max(100, { message: '식비 지원은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 숙소 제공 여부 (일당, 선택)
   */
  accommodation: z
    .string()
    .trim()
    .max(100, { message: '숙소 제공은 100자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 일당 기반 계산 여부 (기본값: true)
   */
  isPerDay: z
    .boolean()
    .optional()
    .default(true)
});

/**
 * 역할별 급여 정보 스키마
 */
export const roleSalarySchema = z.object({
  /**
   * 역할별 급여 타입
   */
  salaryType: SalaryTypeSchema,

  /**
   * 역할별 급여 금액
   * - 숫자 문자열 형식 (예: "50000")
   */
  salaryAmount: z
    .string({
      required_error: '급여 금액을 입력해주세요',
      invalid_type_error: '급여 금액은 문자열이어야 합니다'
    })
    .trim()
    .regex(/^\d+$/, { message: '급여 금액은 숫자만 입력 가능합니다' })
    .min(1, { message: '급여 금액을 입력해주세요' }),

  /**
   * 커스텀 역할명 (기타 선택 시)
   */
  customRoleName: z
    .string()
    .trim()
    .max(50, { message: '역할명은 50자를 초과할 수 없습니다' })
    .optional()
});

/**
 * Salary 섹션 검증 스키마 (base)
 */
export const salarySchemaBase = z.object({
  /**
   * 급여 타입
   * - hourly: 시급
   * - daily: 일급
   * - monthly: 월급
   * - negotiable: 협의
   * - other: 기타
   */
  salaryType: SalaryTypeSchema.optional(),

  /**
   * 급여 금액
   * - 숫자 문자열 형식 (예: "50000")
   * - salaryType이 'negotiable'이 아닐 때 필수
   */
  salaryAmount: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: '급여 금액은 숫자만 입력 가능합니다' })
    .optional(),

  /**
   * 복리후생 정보 (선택)
   */
  benefits: benefitsSchema.optional(),

  /**
   * 역할별 급여 사용 여부 (선택)
   */
  useRoleSalary: z
    .boolean()
    .optional()
    .default(false),

  /**
   * 역할별 급여 정보 (Record 형식)
   * - 키: 역할명 (예: "딜러", "플로어")
   * - 값: 역할별 급여 정보
   */
  roleSalaries: z
    .record(
      z.string(), // 역할명 (키)
      roleSalarySchema // 역할별 급여 정보 (값)
    )
    .optional(),

  /**
   * 세금 설정 (선택)
   */
  taxSettings: z
    .object({
      /**
       * 세금 적용 여부
       */
      enabled: z.boolean(),

      /**
       * 세율 (%) - 비율 기반 계산
       */
      taxRate: z
        .number()
        .min(0, { message: '세율은 0% 이상이어야 합니다' })
        .max(100, { message: '세율은 100%를 초과할 수 없습니다' })
        .optional(),

      /**
       * 고정 세금 - 고정 금액 계산
       */
      taxAmount: z
        .number()
        .min(0, { message: '세금은 0원 이상이어야 합니다' })
        .optional()
    })
    .optional()
});

/**
 * Salary 섹션 검증 스키마 (refined)
 */
export const salarySchema = salarySchemaBase
  .refine(
    (data) => {
      // salaryType이 'negotiable'이 아닐 때 salaryAmount 필수
      if (data.salaryType && data.salaryType !== 'negotiable' && data.salaryType !== 'other') {
        return data.salaryAmount && data.salaryAmount.length > 0;
      }
      return true;
    },
    {
      message: '급여 금액을 입력해주세요',
      path: ['salaryAmount']
    }
  )
  .refine(
    (data) => {
      // useRoleSalary=true일 때 roleSalaries 필수
      if (data.useRoleSalary) {
        return data.roleSalaries && Object.keys(data.roleSalaries).length >= 1;
      }
      return true;
    },
    {
      message: '역할별 급여를 사용하려면 최소 1개 이상의 역할을 추가해주세요',
      path: ['roleSalaries']
    }
  );

/**
 * TypeScript 타입 추론
 */
export type SalaryData = z.infer<typeof salarySchema>;
export type BenefitsData = z.infer<typeof benefitsSchema>;
export type RoleSalaryData = z.infer<typeof roleSalarySchema>;
export type SalaryType = z.infer<typeof SalaryTypeSchema>;
