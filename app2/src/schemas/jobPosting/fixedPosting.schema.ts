/**
 * Fixed Posting 섹션 Zod 스키마
 *
 * 고정공고 전용 필드 검증:
 * - WorkSchedule (근무 일정)
 * - RoleWithCount (역할별 모집 인원)
 * - FixedJobPostingData (고정공고 전용 데이터)
 *
 * @see app2/src/types/jobPosting/jobPosting.ts
 */

import { z } from 'zod';

/**
 * 근무 시간 형식 검증 정규식
 *
 * HH:mm 형식 (24시간제)
 * - HH: 00-23
 * - mm: 00-59
 *
 * @example "09:00" ✅
 * @example "14:30" ✅
 * @example "9:00" ❌ (0이 빠짐)
 * @example "25:00" ❌ (시간 범위 초과)
 */
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * WorkSchedule 검증 스키마
 *
 * 주간 근무 일정을 정의합니다.
 *
 * 검증 규칙:
 * - daysPerWeek: 1-7일 (정수)
 * - startTime: HH:mm 형식, 24시간제
 * - endTime: HH:mm 형식, 24시간제 (startTime보다 늦으면 익일로 자동 계산)
 */
export const workScheduleSchema = z
  .object({
    /**
     * 주 출근일수
     * - 최소: 1일
     * - 최대: 7일
     * - 정수만 허용
     */
    daysPerWeek: z
      .number({
        required_error: '주 출근일수를 입력해주세요',
        invalid_type_error: '주 출근일수는 숫자여야 합니다'
      })
      .int({ message: '주 출근일수는 정수여야 합니다' })
      .min(1, { message: '주 출근일수는 최소 1일 이상이어야 합니다' })
      .max(7, { message: '주 출근일수는 최대 7일을 초과할 수 없습니다' }),

    /**
     * 근무 시작 시간
     * - HH:mm 형식 (24시간제)
     * - 예: "09:00", "14:30"
     */
    startTime: z
      .string({
        required_error: '근무 시작 시간을 입력해주세요',
        invalid_type_error: '근무 시작 시간은 문자열이어야 합니다'
      })
      .regex(TIME_FORMAT_REGEX, {
        message: '근무 시작 시간은 HH:mm 형식이어야 합니다 (예: 09:00)'
      }),

    /**
     * 근무 종료 시간
     * - HH:mm 형식 (24시간제)
     * - 예: "18:00", "22:30"
     * - 시작시간보다 늦으면 익일로 자동 계산됨
     */
    endTime: z
      .string({
        required_error: '근무 종료 시간을 입력해주세요',
        invalid_type_error: '근무 종료 시간은 문자열이어야 합니다'
      })
      .regex(TIME_FORMAT_REGEX, {
        message: '근무 종료 시간은 HH:mm 형식이어야 합니다 (예: 18:00)'
      })
  });

/**
 * RoleWithCount 검증 스키마
 *
 * 역할별 모집 인원을 정의합니다.
 *
 * 검증 규칙:
 * - name: 필수, 1자 이상, 50자 이하
 * - count: 필수, 1명 이상, 100명 이하
 */
export const roleWithCountSchema = z.object({
  /**
   * 역할명
   * - 최소: 1자
   * - 최대: 50자
   * - 예: "딜러", "플로어 매니저"
   */
  name: z
    .string({
      required_error: '역할명을 입력해주세요',
      invalid_type_error: '역할명은 문자열이어야 합니다'
    })
    .min(1, { message: '역할명을 입력해주세요' })
    .max(50, { message: '역할명은 50자를 초과할 수 없습니다' })
    .trim(),

  /**
   * 모집 인원
   * - 최소: 1명
   * - 최대: 100명
   * - 정수만 허용
   */
  count: z
    .number({
      required_error: '모집 인원을 입력해주세요',
      invalid_type_error: '모집 인원은 숫자여야 합니다'
    })
    .int({ message: '모집 인원은 정수여야 합니다' })
    .min(1, { message: '모집 인원은 최소 1명 이상이어야 합니다' })
    .max(100, { message: '모집 인원은 최대 100명을 초과할 수 없습니다' })
});

/**
 * FixedJobPostingData 검증 스키마
 *
 * 고정공고 전용 데이터를 정의합니다.
 *
 * 검증 규칙:
 * - workSchedule: 필수, WorkSchedule 스키마 준수
 * - requiredRolesWithCount: 필수, 최소 1개 이상의 역할
 * - viewCount: 필수, 0 이상의 정수
 */
export const fixedJobPostingDataSchema = z.object({
  /**
   * 근무 일정 (필수)
   */
  workSchedule: workScheduleSchema,

  /**
   * 역할별 모집 인원 (필수, Source of truth)
   * - 최소 1개 이상의 역할 필요
   * - 각 역할은 RoleWithCount 스키마 준수
   */
  requiredRolesWithCount: z
    .array(roleWithCountSchema, {
      required_error: '최소 1개 이상의 역할을 추가해주세요',
      invalid_type_error: '역할별 모집 인원은 배열이어야 합니다'
    })
    .min(1, { message: '최소 1개 이상의 역할을 추가해주세요' })
    .max(20, { message: '역할은 최대 20개까지 추가할 수 있습니다' }),

  /**
   * 조회수 (필수, 기본값: 0)
   * - 최소: 0
   * - 정수만 허용
   */
  viewCount: z
    .number({
      invalid_type_error: '조회수는 숫자여야 합니다'
    })
    .int({ message: '조회수는 정수여야 합니다' })
    .min(0, { message: '조회수는 0 이상이어야 합니다' })
    .default(0)
});

/**
 * TypeScript 타입 추론
 */
export type WorkScheduleData = z.infer<typeof workScheduleSchema>;
export type RoleWithCountData = z.infer<typeof roleWithCountSchema>;
export type FixedJobPostingDataValidated = z.infer<typeof fixedJobPostingDataSchema>;
