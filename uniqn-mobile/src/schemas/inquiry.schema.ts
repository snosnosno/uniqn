/**
 * UNIQN Mobile - 문의 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description 고객센터 문의 및 FAQ 관련 검증 스키마
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { INQUIRY_ATTACHMENT_LIMITS } from '@/types/inquiry';

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * 문의 카테고리 스키마
 */
export const inquiryCategorySchema = z.enum(
  ['general', 'technical', 'payment', 'account', 'report', 'other'],
  {
    error: '카테고리를 선택해주세요',
  }
);

export type InquiryCategorySchema = z.infer<typeof inquiryCategorySchema>;

/**
 * 문의 상태 스키마
 */
export const inquiryStatusSchema = z.enum(['open', 'in_progress', 'closed'], {
  error: '상태를 선택해주세요',
});

export type InquiryStatusSchema = z.infer<typeof inquiryStatusSchema>;

// ============================================================================
// 문의 생성 스키마 (사용자)
// ============================================================================

/**
 * 문의 제목 스키마
 */
export const inquirySubjectSchema = z
  .string()
  .min(2, { message: '제목은 최소 2자 이상 입력해주세요' })
  .max(100, { message: '제목은 100자를 초과할 수 없습니다' })
  .trim()
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

/**
 * 문의 내용 스키마
 */
export const inquiryMessageSchema = z
  .string()
  .min(10, { message: '내용은 최소 10자 이상 입력해주세요' })
  .max(2000, { message: '내용은 2000자를 초과할 수 없습니다' })
  .trim()
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

/**
 * 허용 MIME 타입 (Storage 버킷 `inquiry-attachments` 설정과 일치)
 */
export const inquiryAttachmentMimeSchema = z.enum(INQUIRY_ATTACHMENT_LIMITS.ALLOWED_MIMES);

/**
 * 업로드 전 로컬 첨부파일 스키마 (picker 결과)
 */
export const localInquiryAttachmentSchema = z.object({
  uri: z.string().min(1, { message: '이미지 경로가 필요합니다' }),
  mime: inquiryAttachmentMimeSchema,
  size: z.number().int().positive().max(INQUIRY_ATTACHMENT_LIMITS.MAX_SIZE_BYTES, {
    message: '이미지는 5MB 이하만 첨부 가능합니다',
  }),
  fileName: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type LocalInquiryAttachmentData = z.infer<typeof localInquiryAttachmentSchema>;

/**
 * 저장된 첨부파일 스키마 (DB JSONB 보존용)
 */
export const inquiryAttachmentSchema = z.object({
  path: z.string().min(1),
  mime: inquiryAttachmentMimeSchema,
  size: z.number().int().positive().max(INQUIRY_ATTACHMENT_LIMITS.MAX_SIZE_BYTES),
  uploadedAt: z.string().datetime({ message: 'ISO 날짜 형식이 아닙니다' }),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type InquiryAttachmentData = z.infer<typeof inquiryAttachmentSchema>;

/**
 * 문의 생성 스키마 — 첨부파일은 생성 후 별도 mutation으로 추가
 */
export const createInquirySchema = z.object({
  category: inquiryCategorySchema,
  subject: inquirySubjectSchema,
  message: inquiryMessageSchema,
});

export type CreateInquiryFormData = z.infer<typeof createInquirySchema>;

/**
 * 첨부파일 추가 스키마 (파일 배열 검증)
 */
export const attachInquiryFilesSchema = z.object({
  inquiryId: z.string().uuid({ message: '올바른 문의 ID가 아닙니다' }),
  files: z
    .array(localInquiryAttachmentSchema)
    .min(1, { message: '첨부할 이미지를 선택해주세요' })
    .max(INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT, {
      message: '이미지는 최대 3장까지 첨부 가능합니다',
    }),
});

export type AttachInquiryFilesData = z.infer<typeof attachInquiryFilesSchema>;

// ============================================================================
// 문의 응답 스키마 (관리자)
// ============================================================================

/**
 * 문의 응답 내용 스키마
 */
export const inquiryResponseSchema = z
  .string()
  .min(1, { message: '응답 내용을 입력해주세요' })
  .max(2000, { message: '응답은 2000자를 초과할 수 없습니다' })
  .trim()
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

/**
 * 문의 응답 스키마 (관리자용)
 */
export const respondInquirySchema = z.object({
  response: inquiryResponseSchema,
  status: inquiryStatusSchema.optional().default('closed'),
});

export type RespondInquiryFormData = z.infer<typeof respondInquirySchema>;

// ============================================================================
// 필터 스키마
// ============================================================================

/**
 * 문의 필터 스키마
 */
export const inquiryFilterSchema = z.object({
  status: z.enum(['all', 'open', 'in_progress', 'closed']).optional().default('all'),
  category: z
    .enum(['all', 'general', 'technical', 'payment', 'account', 'report', 'other'])
    .optional()
    .default('all'),
});

export type InquiryFilterData = z.infer<typeof inquiryFilterSchema>;

// ============================================================================
// FAQ 스키마
// ============================================================================

/**
 * FAQ 항목 스키마
 */
export const faqItemSchema = z.object({
  id: z.string().min(1),
  category: inquiryCategorySchema,
  question: z
    .string()
    .min(1)
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  answer: z.string().min(1).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  order: z.number().int().min(0),
  isActive: z.boolean().optional().default(true),
});

export type FAQItemData = z.infer<typeof faqItemSchema>;
