/**
 * DateRequirements 섹션 Zod 스키마
 *
 * 날짜별 요구사항 (날짜, 시간대, 역할 인원) 검증
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/DateRequirementsSection.tsx
 */

import { z } from 'zod';

/**
 * 역할 요구사항 스키마
 */
export const roleRequirementSchema = z.object({
  /**
   * 역할 이름
   * - 예: "딜러", "플로어"
   */
  name: z
    .string({
      required_error: '역할 이름을 입력해주세요',
      invalid_type_error: '역할 이름은 문자열이어야 합니다'
    })
    .min(1, { message: '역할 이름을 입력해주세요' })
    .trim(),

  /**
   * 필요 인원
   * - 최소: 1명
   * - 최대: 100명
   */
  count: z
    .number({
      required_error: '필요 인원을 입력해주세요',
      invalid_type_error: '필요 인원은 숫자여야 합니다'
    })
    .int({ message: '필요 인원은 정수여야 합니다' })
    .min(1, { message: '최소 1명 이상 필요합니다' })
    .max(100, { message: '최대 100명까지 가능합니다' })
});

/**
 * 시간대 정보 스키마
 */
export const timeSlotSchema = z.object({
  /**
   * 시작 시간 (HH:mm 형식)
   */
  time: z
    .string({
      required_error: '시작 시간을 입력해주세요',
      invalid_type_error: '시작 시간은 문자열이어야 합니다'
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: '시간은 HH:mm 형식이어야 합니다 (예: 09:00)' })
    .trim(),

  /**
   * 역할별 필요 인원 배열
   * - 최소: 1개 이상
   */
  roles: z
    .array(roleRequirementSchema, {
      required_error: '역할별 인원을 입력해주세요',
      invalid_type_error: '역할은 배열이어야 합니다'
    })
    .min(1, { message: '최소 1개 이상의 역할을 추가해주세요' }),

  /**
   * 특정 날짜 (yyyy-MM-dd 형식, 선택)
   */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '날짜는 yyyy-MM-dd 형식이어야 합니다' })
    .trim()
    .optional(),

  /**
   * 시간 미정 여부 (선택)
   */
  isTimeToBeAnnounced: z
    .boolean()
    .optional(),

  /**
   * 미정 시 추가 설명 (선택)
   */
  tentativeDescription: z
    .string()
    .trim()
    .max(200, { message: '미정 설명은 200자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 종료 시간 (HH:mm 형식, 선택)
   */
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: '종료 시간은 HH:mm 형식이어야 합니다 (예: 18:00)' })
    .trim()
    .optional(),

  /**
   * 종료 날짜 (yyyy-MM-dd 형식, 선택)
   */
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '종료 날짜는 yyyy-MM-dd 형식이어야 합니다' })
    .trim()
    .optional(),

  /**
   * 당일 전체 운영 여부 (선택)
   */
  isFullDay: z
    .boolean()
    .optional(),

  /**
   * 다음날 종료 여부 (선택)
   */
  endsNextDay: z
    .boolean()
    .optional(),

  /**
   * 기간 설정 (선택)
   */
  duration: z
    .object({
      type: z.enum(['single', 'multi']),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '종료 날짜는 yyyy-MM-dd 형식이어야 합니다' })
        .trim()
        .optional()
    })
    .optional()
});

/**
 * 날짜별 요구사항 스키마
 */
export const dateSpecificRequirementSchema = z.object({
  /**
   * 날짜 (yyyy-MM-dd 형식 또는 Firebase Timestamp)
   */
  date: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: '날짜는 yyyy-MM-dd 형식이어야 합니다' }),
    z.object({ seconds: z.number() }) // Firebase Timestamp 지원
  ]),

  /**
   * 시간대별 요구사항 배열
   * - 최소: 1개 이상
   */
  timeSlots: z
    .array(timeSlotSchema, {
      required_error: '시간대를 추가해주세요',
      invalid_type_error: '시간대는 배열이어야 합니다'
    })
    .min(1, { message: '최소 1개 이상의 시간대를 추가해주세요' }),

  /**
   * 메인 행사 날짜 여부 (선택)
   */
  isMainDate: z
    .boolean()
    .optional(),

  /**
   * 표시 순서 (선택)
   */
  displayOrder: z
    .number()
    .int()
    .optional()
});

/**
 * DateRequirements 섹션 검증 스키마
 */
export const dateRequirementsSchema = z.object({
  /**
   * 날짜별 요구사항 배열
   * - 최소: 1개 이상 (최소 하나의 날짜는 있어야 함)
   * - 최대: 50개 (대규모 이벤트 지원)
   */
  dateSpecificRequirements: z
    .array(dateSpecificRequirementSchema, {
      required_error: '최소 1개 이상의 날짜를 추가해주세요',
      invalid_type_error: '날짜별 요구사항은 배열이어야 합니다'
    })
    .min(1, { message: '최소 1개 이상의 날짜를 추가해주세요' })
    .max(50, { message: '최대 50개까지 추가 가능합니다' })
});

/**
 * TypeScript 타입 추론
 */
export type DateRequirementsData = z.infer<typeof dateRequirementsSchema>;
export type DateSpecificRequirementData = z.infer<typeof dateSpecificRequirementSchema>;
export type TimeSlotData = z.infer<typeof timeSlotSchema>;
export type RoleRequirementData = z.infer<typeof roleRequirementSchema>;
