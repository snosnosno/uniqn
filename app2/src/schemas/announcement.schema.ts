/**
 * 공지사항 Zod 스키마
 *
 * @description
 * 공지사항 입력 데이터의 유효성 검증을 위한 Zod 스키마
 * XSS 방지 및 타입 안전성 보장
 *
 * @version 1.0.0
 * @since 2025-12-10
 */

import { z } from 'zod';
import { validateNoXSSPatterns } from '../utils/core/securityPatterns';

/**
 * XSS 검증 refine 함수
 */
const xssCheck = (val: string) => validateNoXSSPatterns(val);
const XSS_ERROR_MESSAGE = '위험한 문자열이 포함되어 있습니다.';

/**
 * 우선순위 enum
 */
export const AnnouncementPrioritySchema = z.enum(['normal', 'important', 'urgent']);

/**
 * 공지사항 생성 스키마
 */
export const CreateAnnouncementSchema = z
  .object({
    /** 제목 (2-100자, XSS 검증) */
    title: z
      .string()
      .min(2, '제목은 최소 2자 이상 입력해주세요.')
      .max(100, '제목은 최대 100자까지 입력 가능합니다.')
      .refine(xssCheck, XSS_ERROR_MESSAGE),

    /** 내용 (2-2000자, XSS 검증) */
    content: z
      .string()
      .min(2, '내용은 최소 2자 이상 입력해주세요.')
      .max(2000, '내용은 최대 2000자까지 입력 가능합니다.')
      .refine(xssCheck, XSS_ERROR_MESSAGE),

    /** 우선순위 */
    priority: AnnouncementPrioritySchema,

    /** 공개 시작일 */
    startDate: z.date({
      required_error: '공개 시작일은 필수입니다.',
      invalid_type_error: '올바른 날짜 형식이 아닙니다.',
    }),

    /** 공개 종료일 (선택) */
    endDate: z.date().nullable().optional(),

    /** 배너로 표시 여부 */
    showAsBanner: z.boolean().default(false),

    /** 첨부 이미지 URL */
    imageUrl: z.string().url('올바른 URL 형식이 아닙니다.').optional(),

    /** 첨부 이미지 Storage 경로 */
    imageStoragePath: z.string().optional(),
  })
  .refine(
    (data) => {
      // 종료일이 있으면 시작일보다 이후여야 함
      if (data.endDate && data.startDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: '종료일은 시작일보다 이후여야 합니다.',
      path: ['endDate'],
    }
  );

/**
 * 공지사항 수정 스키마
 */
export const UpdateAnnouncementSchema = z
  .object({
    /** 제목 (2-100자, XSS 검증) */
    title: z
      .string()
      .min(2, '제목은 최소 2자 이상 입력해주세요.')
      .max(100, '제목은 최대 100자까지 입력 가능합니다.')
      .refine(xssCheck, XSS_ERROR_MESSAGE)
      .optional(),

    /** 내용 (2-2000자, XSS 검증) */
    content: z
      .string()
      .min(2, '내용은 최소 2자 이상 입력해주세요.')
      .max(2000, '내용은 최대 2000자까지 입력 가능합니다.')
      .refine(xssCheck, XSS_ERROR_MESSAGE)
      .optional(),

    /** 우선순위 */
    priority: AnnouncementPrioritySchema.optional(),

    /** 공개 시작일 */
    startDate: z.date().optional(),

    /** 공개 종료일 */
    endDate: z.date().nullable().optional(),

    /** 활성 상태 */
    isActive: z.boolean().optional(),

    /** 배너로 표시 여부 */
    showAsBanner: z.boolean().optional(),

    /** 첨부 이미지 URL */
    imageUrl: z.string().url('올바른 URL 형식이 아닙니다.').optional().nullable(),

    /** 첨부 이미지 Storage 경로 */
    imageStoragePath: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // 종료일이 있으면 시작일보다 이후여야 함
      if (data.endDate && data.startDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: '종료일은 시작일보다 이후여야 합니다.',
      path: ['endDate'],
    }
  );

/**
 * 스키마 타입 추출
 */
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;

/**
 * 유효성 검증 헬퍼 함수
 */
export const validateCreateAnnouncement = (
  data: unknown
): { success: true; data: CreateAnnouncementInput } | { success: false; errors: string[] } => {
  const result = CreateAnnouncementSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => err.message);
  return { success: false, errors };
};

export const validateUpdateAnnouncement = (
  data: unknown
): { success: true; data: UpdateAnnouncementInput } | { success: false; errors: string[] } => {
  const result = UpdateAnnouncementSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => err.message);
  return { success: false, errors };
};
