/**
 * UNIQN Mobile - Board Post Metadata Zod 스키마
 *
 * @version 1.0.0
 * @description board_posts JSONB 메타데이터(job_summary) 런타임 검증 스키마.
 *
 *   - `jobSummary`: 대타 구인 글이 연결된 원 공고 요약 (BoardJobSummary 참조)
 *   - `applicationId`: 대타 글 생성 트리거가 된 지원 ID (향후 확장)
 *   - 기타 키: `passthrough`로 미래 스키마 확장 허용
 *
 *   파싱 실패 시: Repository에서 safeParseJson → logger.warn + 빈 객체/undefined fallback
 */

import { z } from 'zod';

// ============================================================================
// Board Job Summary 스키마
// ============================================================================

/**
 * 대타 구인 글에 연결된 원 공고 요약 스키마.
 *
 * `src/types/board.ts`의 BoardJobSummary interface와 필드가 일치해야 한다.
 */
export const BoardJobSummarySchema = z.object({
  jobPostingId: z.string(),
  title: z.string(),
  workDate: z.string(),
  workDates: z.array(z.string()).optional(),
  locationName: z.string().optional(),
  totalPositions: z.number().optional(),
  filledPositions: z.number().optional(),
  compensationLabel: z.string().optional(),
  jobPostingStatus: z.string().optional(),
});

export type BoardJobSummarySchemaData = z.infer<typeof BoardJobSummarySchema>;

// ============================================================================
// Board Post Metadata 스키마
// ============================================================================

/**
 * board_posts JSONB 메타데이터 스키마.
 *
 * `passthrough`로 미지정 키 허용 → 향후 새로운 필드가 추가돼도 파싱 실패 없이
 * 기존 레코드가 안전하게 역직렬화된다.
 */
export const BoardPostMetadataSchema = z
  .object({
    jobSummary: BoardJobSummarySchema.optional(),
    applicationId: z.string().optional(),
  })
  .passthrough();

export type BoardPostMetadata = z.infer<typeof BoardPostMetadataSchema>;
