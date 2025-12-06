/**
 * Penalty Zod 스키마
 *
 * 패널티 생성 시 입력 데이터 검증
 *
 * @see app2/src/components/modals/PenaltyModal.tsx
 */

import { z } from 'zod';
import { xssValidation } from '../utils/validation/xssProtection';

/**
 * 패널티 유형 열거형
 */
export const PenaltyTypeSchema = z.enum(['warning', 'loginBlock'], {
  errorMap: () => ({ message: '올바른 패널티 유형을 선택해주세요' }),
});

/**
 * 경고 패널티 기간 열거형
 */
export const WarningDurationSchema = z.enum(['3d', '7d', '30d'], {
  errorMap: () => ({ message: '올바른 기간을 선택해주세요' }),
});

/**
 * 로그인 차단 패널티 기간 열거형
 */
export const LoginBlockDurationSchema = z.enum(['1d', '3d', '7d', '30d', '90d', 'permanent'], {
  errorMap: () => ({ message: '올바른 기간을 선택해주세요' }),
});

/**
 * 패널티 기간 열거형 (통합 - 기존 호환)
 */
export const PenaltyDurationSchema = z.enum(['1d', '3d', '7d', '30d', '90d', 'permanent'], {
  errorMap: () => ({ message: '올바른 기간을 선택해주세요' }),
});

/**
 * 패널티 생성 검증 스키마
 *
 * 검증 규칙:
 * - type: warning 또는 loginBlock
 * - reason: 2자 이상, 100자 이하, XSS 방지
 * - details: 선택 입력, 최대 500자, XSS 방지
 * - duration: 유형에 따른 유효한 기간 타입
 */
export const penaltyCreateSchema = z.object({
  /**
   * 대상 사용자 ID
   * - 필수 입력
   */
  userId: z.string({
    required_error: '사용자 ID가 필요합니다',
    invalid_type_error: '사용자 ID는 문자열이어야 합니다',
  }),

  /**
   * 패널티 유형
   * - warning: 경고 배너 표시
   * - loginBlock: 로그인 차단
   */
  type: PenaltyTypeSchema,

  /**
   * 패널티 사유
   * - 최소: 2자
   * - 최대: 100자
   * - XSS 방지
   */
  reason: z
    .string({
      required_error: '패널티 사유를 입력해주세요',
      invalid_type_error: '패널티 사유는 문자열이어야 합니다',
    })
    .min(2, { message: '패널티 사유는 최소 2자 이상이어야 합니다' })
    .max(100, { message: '패널티 사유는 100자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)',
    }),

  /**
   * 상세 내용 (선택)
   * - 최대: 500자
   * - XSS 방지
   */
  details: z
    .string()
    .max(500, { message: '상세 내용은 500자를 초과할 수 없습니다' })
    .trim()
    .refine((val) => !val || xssValidation(val), {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)',
    })
    .optional(),

  /**
   * 패널티 기간
   * - 유효한 기간 타입 필수
   */
  duration: PenaltyDurationSchema,
});

/**
 * 패널티 취소 검증 스키마
 */
export const penaltyCancelSchema = z.object({
  /**
   * 취소 사유
   * - 최소: 2자
   * - 최대: 200자
   * - XSS 방지
   */
  cancelReason: z
    .string({
      required_error: '취소 사유를 입력해주세요',
      invalid_type_error: '취소 사유는 문자열이어야 합니다',
    })
    .min(2, { message: '취소 사유는 최소 2자 이상이어야 합니다' })
    .max(200, { message: '취소 사유는 200자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)',
    }),
});

/**
 * 스키마 타입 추론
 */
export type PenaltyCreateData = z.infer<typeof penaltyCreateSchema>;
export type PenaltyCancelData = z.infer<typeof penaltyCancelSchema>;
