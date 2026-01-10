/**
 * 날짜별 요구사항 Zod 스키마 (간소화 버전)
 *
 * @version 2.0.0
 * @description
 * - 종료시간 필드 제거
 * - periodType 제거
 * - 타입별 날짜 개수 검증
 *
 * @see specs/react-native-app/22-migration-mapping.md
 */

import { z } from 'zod';
import {
  MAX_TIME_SLOTS_PER_DATE,
  MAX_ROLES_PER_SLOT,
  MAX_HEADCOUNT,
  MIN_HEADCOUNT,
  DATE_REQUIREMENT_ERRORS,
  STAFF_ROLE_KEYS,
} from '@/constants';

/**
 * 역할 요구사항 스키마
 */
export const roleRequirementSchema = z
  .object({
    /**
     * 고유 ID (React Hook Form useFieldArray용)
     */
    id: z.string(),

    /**
     * 역할
     * - 통합 역할 키 사용: dealer, floor, serving, manager, staff, other
     * @see STAFF_ROLE_KEYS in constants/jobPosting.ts
     */
    role: z.enum(STAFF_ROLE_KEYS),

    /**
     * 커스텀 역할명 (role이 'other'일 때만 필수)
     */
    customRole: z.string().trim().max(20).optional(),

    /**
     * 필요 인원 (1-200)
     */
    headcount: z
      .number()
      .int({ message: '필요 인원은 정수여야 합니다' })
      .min(MIN_HEADCOUNT, {
        message: DATE_REQUIREMENT_ERRORS.INVALID_HEADCOUNT_RANGE,
      })
      .max(MAX_HEADCOUNT, {
        message: DATE_REQUIREMENT_ERRORS.INVALID_HEADCOUNT_RANGE,
      }),
  })
  .refine(
    (data) => {
      // role이 'other'이면 customRole 필수
      if (data.role === 'other') {
        return !!data.customRole && data.customRole.length > 0;
      }
      return true;
    },
    {
      message: DATE_REQUIREMENT_ERRORS.CUSTOM_ROLE_REQUIRED,
      path: ['customRole'],
    }
  );

/**
 * 시간대 정보 스키마 (간소화)
 */
export const timeSlotSchema = z
  .object({
    /**
     * 고유 ID (React Hook Form useFieldArray용)
     */
    id: z.string(),

    /**
     * 시작 시간 (HH:mm 형식)
     */
    startTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: DATE_REQUIREMENT_ERRORS.INVALID_TIME_FORMAT,
      }),

    /**
     * 시간 미정 여부
     */
    isTimeToBeAnnounced: z.boolean(),

    /**
     * 미정일 때 설명
     */
    tentativeDescription: z.string().trim().max(200).optional(),

    /**
     * 역할별 필요 인원 배열
     * - 최소: 1개
     * - 최대: 10개
     */
    roles: z
      .array(roleRequirementSchema)
      .min(1, { message: DATE_REQUIREMENT_ERRORS.MIN_ONE_ROLE })
      .max(MAX_ROLES_PER_SLOT, {
        message: DATE_REQUIREMENT_ERRORS.MAX_ROLES_EXCEEDED,
      }),
  })
  .refine(
    (data) => {
      // 시간 미정일 때 설명 필수
      if (data.isTimeToBeAnnounced) {
        return !!data.tentativeDescription && data.tentativeDescription.length > 0;
      }
      return true;
    },
    {
      message: '미정 사유를 입력해주세요',
      path: ['tentativeDescription'],
    }
  );

/**
 * 날짜별 요구사항 스키마 (간소화)
 */
export const dateSpecificRequirementSchema = z.object({
  /**
   * 날짜 (yyyy-MM-dd 형식 또는 Firebase Timestamp)
   */
  date: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: '날짜는 yyyy-MM-dd 형식이어야 합니다',
    }),
    z.object({ seconds: z.number() }), // Firebase Timestamp 지원
    z.instanceof(Date), // Date 객체 지원
  ]),

  /**
   * 시간대별 요구사항 배열
   * - 최소: 1개
   * - 최대: 10개
   */
  timeSlots: z
    .array(timeSlotSchema)
    .min(1, { message: DATE_REQUIREMENT_ERRORS.MIN_ONE_TIME_SLOT })
    .max(MAX_TIME_SLOTS_PER_DATE, {
      message: DATE_REQUIREMENT_ERRORS.MAX_TIME_SLOTS_EXCEEDED,
    }),
});

/**
 * DateRequirements 섹션 검증 스키마
 */
export const dateRequirementsSchema = z.object({
  /**
   * 날짜별 요구사항 배열
   * - 최소: 1개
   * - 최대: 타입별 제약 (regular/urgent: 1, tournament: 30)
   */
  dateSpecificRequirements: z
    .array(dateSpecificRequirementSchema)
    .min(1, { message: DATE_REQUIREMENT_ERRORS.MIN_ONE_DATE }),
});

/**
 * TypeScript 타입 추론
 */
export type DateRequirementsData = z.infer<typeof dateRequirementsSchema>;
export type DateSpecificRequirementData = z.infer<typeof dateSpecificRequirementSchema>;
export type TimeSlotData = z.infer<typeof timeSlotSchema>;
export type RoleRequirementData = z.infer<typeof roleRequirementSchema>;
