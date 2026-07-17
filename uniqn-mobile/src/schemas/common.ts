/**
 * UNIQN Mobile - 공통 Zod 스키마
 *
 * @description 여러 스키마에서 재사용되는 공통 타입 정의
 * @version 3.0.0 - Firebase Timestamp 레거시 청산 (2026-04-19)
 *                  timestampSchema가 모든 입력 형태를 ISO 8601 string으로 정규화.
 *                  Supabase timestamptz round-trip이 string-string으로 일관 유지.
 *                  정규화 진실원: utils/date/core의 normalizeToIsoString.
 *
 * @example
 * import { timestampSchema, optionalTimestampSchema } from './common';
 *
 * const mySchema = z.object({
 *   createdAt: timestampSchema,    // string (ISO 8601)
 *   deletedAt: optionalTimestampSchema,  // string | null | undefined
 * });
 */

import { z } from 'zod';
import { normalizeToIsoString } from '@/utils/date';

// ============================================================================
// Timestamp Schemas (ISO string 반환)
// ============================================================================

/**
 * Timestamp 검증 및 ISO string 정규화
 *
 * 지원 입력 (모두 ISO 8601 string으로 정규화):
 *  - Supabase ISO string ("2026-04-19T15:30:00+00:00")
 *  - Date 인스턴스
 *  - Firebase Timestamp 호환 객체 (toDate() 메서드)
 *  - { seconds, nanoseconds } JSON 직렬화 형태
 *  - serverTimestamp() 센티널
 *  - epoch milliseconds (number)
 *
 * 출력은 string이므로 JSON.stringify 시 그대로 통과 → Supabase timestamptz 호환.
 * View layer에서 Date가 필요하면 utils/date의 toDate()로 변환.
 */
export const timestampSchema = z.unknown().transform((val, ctx): string => {
  try {
    return normalizeToIsoString(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Timestamp 형식이 아닙니다',
    });
    return z.NEVER;
  }
});

/**
 * 선택적 Timestamp 스키마 (null/undefined 허용)
 */
export const optionalTimestampSchema = timestampSchema.optional().nullable();

/**
 * Nullable Timestamp 스키마 (null 허용, undefined는 거부)
 */
export const nullableTimestampSchema = timestampSchema.nullable();

// ============================================================================
// Metadata Schema
// ============================================================================

/**
 * 메타데이터 스키마 (유연한 key-value)
 *
 * @description 확장 가능한 메타데이터 필드용
 */
export const metadataSchema = z.record(z.string(), z.unknown());

export const optionalMetadataSchema = metadataSchema.optional();

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Firebase Document ID 스키마
 *
 * @description 20자 alphanumeric (Firebase 자동생성 ID 형식)
 */
export const documentIdSchema = z.string().min(1).max(128);

/**
 * 기본 이메일 스키마 (최소 검증)
 *
 * @description 상세 검증이 필요한 경우 auth.schema.ts의 emailSchema를 사용하세요.
 */
export const baseEmailSchema = z.string().email('올바른 이메일 형식이 아닙니다');

/**
 * 날짜 문자열 스키마 (YYYY-MM-DD)
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');

/**
 * 시간 문자열 스키마 (HH:MM)
 */
export const timeStringSchema = z.string().regex(/^\d{1,2}:\d{2}$/, 'HH:MM 형식이어야 합니다');

/**
 * UUID 형식(그룹형) 정규식 — RFC 4122 variant 비강제.
 *
 * @description Zod v4 `.uuid()`는 variant 를 강제해 테스트 픽스처(11111111-…)를 거부하므로,
 *   형식만 검사하되 variant 는 강제하지 않는다. ⚠️ `/^[0-9a-f-]{36}$/i` 는 대시 36개도
 *   통과시키므로 사용 금지. ops 좌석/상금 스키마·서비스 경계 가드(eliminatorId)의 단일 소스.
 */
export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID 형식(그룹형) refine zod 스키마 — variant 비강제. */
export const uuidLikeSchema = z
  .string()
  .refine((v) => UUID_LIKE_RE.test(v), 'UUID 형식이 아니에요.');

// ============================================================================
// Type Exports
// ============================================================================

export type TimestampInput = z.infer<typeof timestampSchema>;
export type MetadataInput = z.infer<typeof metadataSchema>;
