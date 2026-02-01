/**
 * UNIQN Mobile - 문의 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description 고객센터 문의 및 FAQ 관련 검증 스키마
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

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
 * 첨부파일 스키마
 */
export const inquiryAttachmentSchema = z.object({
  name: z.string().min(1, { message: '파일 이름이 필요합니다' }),
  url: z.string().url({ message: '올바른 URL 형식이 아닙니다' }),
  type: z.string().min(1, { message: '파일 타입이 필요합니다' }),
  size: z
    .number()
    .max(5 * 1024 * 1024, { message: '파일 크기는 5MB를 초과할 수 없습니다' })
    .optional(),
});

export type InquiryAttachmentData = z.infer<typeof inquiryAttachmentSchema>;

/**
 * 문의 생성 스키마
 */
export const createInquirySchema = z.object({
  category: inquiryCategorySchema,
  subject: inquirySubjectSchema,
  message: inquiryMessageSchema,
  attachments: z
    .array(inquiryAttachmentSchema)
    .max(3, { message: '첨부파일은 최대 3개까지 가능합니다' })
    .optional(),
});

export type CreateInquiryFormData = z.infer<typeof createInquirySchema>;

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
  question: z.string().min(1),
  answer: z.string().min(1),
  order: z.number().int().min(0),
  isActive: z.boolean().optional().default(true),
});

export type FAQItemData = z.infer<typeof faqItemSchema>;
