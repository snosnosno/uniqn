/**
 * UNIQN Mobile - Board Post Metadata Zod 스키마
 *
 * @version 1.0.0
 * @description board_posts JSONB 메타데이터 런타임 검증 스키마 (2개 export).
 *
 *   ## 현재 활성 (Active)
 *
 *   - `BoardJobSummarySchema` — board_posts.job_summary 컬럼 파싱에 consumed.
 *     `src/repositories/supabase/BoardRepositoryHelpers.ts`의 toBoardPost()에서
 *     `safeParseJson(boardJobSummarySchema, row.job_summary, …)` 형태로 사용 중.
 *     🔑 **생산자는 서버다** — `sync_schedule_board`(baseline_schema_from_prod.sql:9175)가
 *     일정 소통 글을 만들거나 갱신할 때 원 공고를 요약해 채운다. 클라에는 board_posts
 *     INSERT 경로가 없다. 소비처는 `BoardPostCard`(근무일·장소 줄).
 *
 *   ## Forward-Compat (미활성)
 *
 *   - `BoardPostMetadataSchema` — 현재 DB에는 `metadata` JSONB 컬럼이 없다
 *     (types/supabase.ts 확인: board_posts는 job_summary만 보유).
 *     향후 `metadata` 컬럼이 추가되면 `{ jobSummary, applicationId, …passthrough }`
 *     형태의 wrapper로 사용할 예정.
 *     - `jobSummary`: 글에 연결된 원 공고 요약 (BoardJobSummary 참조)
 *     - `applicationId`: 글 생성 트리거가 된 지원 ID (향후 확장)
 *     - 기타 키: `passthrough`로 미래 스키마 확장 허용
 *     - 파싱 실패 시 정책: safeParse → logger.error + `{}` fallback
 *
 *   ⚠️ 이 파일의 옛 주석은 두 필드를 **대타 구인 글**에 귀속시켰으나, 대타 기능은
 *   제거됐다(`BoardType`은 `notice | schedule` 2종 · BoardTabBar 탭도 2개).
 *   DB enum `public.board_type` 에는 `free`·`tda`·`substitute` 가 아직 남아 있지만
 *   클라 참조는 0건이다 — enum 값 제거는 PostgreSQL 이 지원하지 않아(타입 재생성 +
 *   2개 컬럼·인덱스·함수 의존) 위험 대비 이득이 없어 두었다.
 *
 *   이 wrapper는 현재 `BoardPostMetadataSchema.test.ts`에서 스키마 단위 검증만
 *   수행 (Repository 통합은 metadata 컬럼 추가 시 도입).
 */

import { z } from 'zod';

// ============================================================================
// Board Job Summary 스키마
// ============================================================================

/**
 * 게시글에 연결된 원 공고 요약 스키마.
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
