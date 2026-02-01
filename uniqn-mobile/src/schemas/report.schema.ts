/**
 * UNIQN Mobile - 신고 관련 Zod 스키마
 *
 * @description 양방향 신고 입력 검증
 * @version 1.0.0
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { timestampSchema, optionalTimestampSchema } from './common';

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * 스태프 신고 유형 스키마 (구인자 → 스태프)
 */
export const employeeReportTypeSchema = z.enum(
  [
    'tardiness',
    'negligence',
    'no_show',
    'early_leave',
    'inappropriate',
    'dress_code',
    'communication',
    'other',
  ],
  {
    error: '올바른 신고 유형을 선택해주세요',
  }
);

export type EmployeeReportTypeSchema = z.infer<typeof employeeReportTypeSchema>;

/**
 * 구인자 신고 유형 스키마 (구직자 → 구인자)
 */
export const employerReportTypeSchema = z.enum(
  ['false_posting', 'employer_negligence', 'unfair_treatment', 'inappropriate_behavior', 'other'],
  {
    error: '올바른 신고 유형을 선택해주세요',
  }
);

export type EmployerReportTypeSchema = z.infer<typeof employerReportTypeSchema>;

/**
 * 통합 신고 유형 스키마
 */
export const reportTypeUnionSchema = z.union([employeeReportTypeSchema, employerReportTypeSchema]);

export type ReportTypeUnionSchema = z.infer<typeof reportTypeUnionSchema>;

/**
 * 신고자 유형 스키마
 */
export const reporterTypeSchema = z.enum(['employer', 'employee'], {
  error: '올바른 신고자 유형을 선택해주세요',
});

export type ReporterTypeSchemaData = z.infer<typeof reporterTypeSchema>;

/**
 * 신고 상태 스키마
 */
export const reportStatusUnionSchema = z.enum(['pending', 'reviewed', 'resolved', 'dismissed'], {
  error: '올바른 신고 상태를 선택해주세요',
});

export type ReportStatusUnionSchema = z.infer<typeof reportStatusUnionSchema>;

/**
 * 심각도 스키마
 */
export const reportSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export type ReportSeveritySchema = z.infer<typeof reportSeveritySchema>;

// ============================================================================
// 입력 검증 스키마
// ============================================================================

/**
 * 신고 생성 입력 스키마 (CreateReportInput)
 */
export const createReportInputSchema = z.object({
  type: reportTypeUnionSchema,

  reporterType: reporterTypeSchema,

  targetId: z.string().min(1, { message: '신고 대상 ID는 필수입니다' }),

  targetName: z
    .string()
    .min(1, { message: '신고 대상 이름은 필수입니다' })
    .max(50, { message: '신고 대상 이름은 50자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    }),

  jobPostingId: z.string().min(1, { message: '공고 ID는 필수입니다' }),

  jobPostingTitle: z
    .string()
    .max(100, { message: '공고 제목은 100자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    })
    .optional(),

  workLogId: z.string().optional(),

  workDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' })
    .optional(),

  description: z
    .string()
    .min(10, { message: '신고 내용은 최소 10자 이상이어야 합니다' })
    .max(500, { message: '신고 내용은 500자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    }),

  evidenceUrls: z
    .array(z.string().url({ message: '올바른 URL 형식이어야 합니다' }))
    .max(5, { message: '증거 파일은 최대 5개까지 첨부 가능합니다' })
    .optional(),
});

export type CreateReportInputData = z.infer<typeof createReportInputSchema>;

/**
 * 신고 처리 입력 스키마 (관리자용)
 */
export const reviewReportInputSchema = z.object({
  reportId: z.string().min(1, { message: '신고 ID는 필수입니다' }),

  status: reportStatusUnionSchema,

  reviewerNotes: z
    .string()
    .max(500, { message: '처리자 메모는 500자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    })
    .optional(),
});

export type ReviewReportInputData = z.infer<typeof reviewReportInputSchema>;

// ============================================================================
// 런타임 검증 스키마 (Firestore 데이터 검증용)
// ============================================================================

/**
 * Report 문서 스키마 (Firestore에서 읽은 데이터 검증)
 */
export const reportDocumentSchema = z.object({
  id: z.string(),
  type: reportTypeUnionSchema,
  reporterType: reporterTypeSchema,
  reporterId: z.string(),
  reporterName: z.string(),
  targetId: z.string(),
  targetName: z.string(),
  jobPostingId: z.string(),
  jobPostingTitle: z.string().optional(),
  workLogId: z.string().optional(),
  workDate: z.string().optional(),
  description: z.string(),
  evidenceUrls: z.array(z.string()).optional(),
  status: reportStatusUnionSchema,
  reviewerId: z.string().optional(),
  reviewerNotes: z.string().optional(),
  reviewedAt: optionalTimestampSchema, // Firebase Timestamp
  severity: reportSeveritySchema,
  createdAt: timestampSchema, // Firebase Timestamp
  updatedAt: timestampSchema, // Firebase Timestamp
});

export type ReportDocumentData = z.infer<typeof reportDocumentSchema>;

/**
 * Report 문서 배열 안전 파싱
 */
export function parseReportDocuments(data: unknown[]): ReportDocumentData[] {
  return data
    .map((item) => {
      const result = reportDocumentSchema.safeParse(item);
      return result.success ? result.data : null;
    })
    .filter((item): item is ReportDocumentData => item !== null);
}

/**
 * 단일 Report 문서 안전 파싱
 */
export function parseReportDocument(data: unknown): ReportDocumentData | null {
  const result = reportDocumentSchema.safeParse(data);
  return result.success ? result.data : null;
}
