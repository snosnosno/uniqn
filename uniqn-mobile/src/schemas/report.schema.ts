/**
 * UNIQN Mobile - 신고 관련 Zod 스키마
 *
 * @description 양방향 신고 입력 검증
 * @version 1.0.0
 */

import { z } from 'zod';
import { xssValidation, isSafeUrl } from '@/utils/security';
import { REPORT_EVIDENCE_LIMITS } from '@/types/report';
import { timestampSchema, optionalTimestampSchema } from './common';
import { localInquiryAttachmentSchema } from './inquiry.schema';

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
// 증빙 첨부 스키마
// ============================================================================

/**
 * 신고 증빙 Storage 경로 패턴
 *
 * `{업로더uid(uuid)}/{제출id}/{파일명.확장자}` — **첫 세그먼트가 업로더 uid** 여야
 * Storage RLS(`storage.foldername(name)[1] = auth.uid()`)와 같은 축을 본다.
 * 축이 어긋나면 업로드는 통과해도 열람이 막히거나 남의 폴더에 쓰게 된다.
 */
const REPORT_EVIDENCE_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,64}\/[A-Za-z0-9._-]{1,96}\.(jpg|jpeg|png|webp)$/i;

/**
 * 증빙 참조 1건 스키마
 *
 * 신규 데이터는 Storage 경로만 들어온다. http(s) 절대 URL 은 과거 데이터 호환용으로만 허용한다.
 * (`javascript:` 등 위험 스킴은 `isSafeUrl` 로 차단, 경로 탈출(`..`)은 전면 거부)
 */
function isAllowedEvidenceRef(value: string): boolean {
  // 경로 탈출은 형태를 따지기 전에 무조건 거부
  if (value.includes('..')) return false;
  if (REPORT_EVIDENCE_PATH_PATTERN.test(value)) return true;
  return /^https?:\/\//i.test(value) && isSafeUrl(value);
}

export const reportEvidenceRefSchema = z
  .string()
  .min(1, { message: '증빙 참조가 비어 있습니다' })
  .max(512, { message: '증빙 참조가 너무 깁니다' })
  .refine(isAllowedEvidenceRef, {
    message: '증빙은 업로드된 이미지 경로 또는 안전한 http(s) URL 이어야 합니다',
  });

/**
 * 증빙 업로드 입력 스키마 (신고 생성 **전** 단계)
 *
 * 개별 파일 제약(MIME / 5MB)은 1:1 문의 첨부 스키마를 그대로 쓴다 — 같은 파이프라인이다.
 */
export const uploadReportEvidenceSchema = z.object({
  files: z
    .array(localInquiryAttachmentSchema)
    .min(1, { message: '업로드할 이미지를 선택해주세요' })
    .max(REPORT_EVIDENCE_LIMITS.MAX_COUNT, {
      message: `증빙 이미지는 최대 ${REPORT_EVIDENCE_LIMITS.MAX_COUNT}장까지 첨부 가능합니다`,
    }),
});

export type UploadReportEvidenceData = z.infer<typeof uploadReportEvidenceSchema>;

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
    .array(reportEvidenceRefSchema)
    .max(REPORT_EVIDENCE_LIMITS.MAX_COUNT, {
      message: `증빙 이미지는 최대 ${REPORT_EVIDENCE_LIMITS.MAX_COUNT}장까지 첨부 가능합니다`,
    })
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
  reviewedAt: optionalTimestampSchema,
  severity: reportSeveritySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
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
