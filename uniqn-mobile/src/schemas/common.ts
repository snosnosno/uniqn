/**
 * UNIQN Mobile - 공통 Zod 스키마
 *
 * @description 여러 스키마에서 재사용되는 공통 타입 정의
 * @version 1.0.0 - Phase 1.5 (any 타입 제거)
 *
 * @example
 * import { timestampSchema, optionalTimestampSchema } from './common';
 *
 * const mySchema = z.object({
 *   createdAt: timestampSchema,
 *   deletedAt: optionalTimestampSchema,
 * });
 */

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Firebase Timestamp Schemas
// ============================================================================

/**
 * Timestamp-like 객체 타입 가드
 *
 * @description toDate() 메서드가 있는 객체인지 확인
 */
function isTimestampLike(value: unknown): value is Timestamp {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as Record<string, unknown>).toDate === 'function'
  );
}

/**
 * seconds/nanoseconds 객체 타입 가드
 */
function isTimestampObject(value: unknown): value is { seconds: number; nanoseconds: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as Record<string, unknown>).seconds === 'number' &&
    typeof (value as Record<string, unknown>).nanoseconds === 'number'
  );
}

/**
 * serverTimestamp() 센티널 값 타입 가드
 *
 * @description Firestore에서 pendingWrites 상태일 때 serverTimestamp()는
 *              실제 Timestamp 대신 { _methodName: 'serverTimestamp' } 형태로 반환됨
 */
function isServerTimestampSentinel(value: unknown): value is { _methodName: 'serverTimestamp' } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_methodName' in value &&
    (value as Record<string, unknown>)._methodName === 'serverTimestamp'
  );
}

/**
 * Firebase Timestamp 타입 검증 및 변환
 *
 * @description Firestore에서 읽은 Timestamp 또는 JS Date 객체 허용
 * - Timestamp 인스턴스 (toDate 메서드로 판별)
 * - Date 인스턴스
 * - { seconds: number, nanoseconds: number } 형태 (JSON 직렬화된 Timestamp)
 *
 * @note z.instanceof(Timestamp)는 번들러 환경에서 실패할 수 있으므로
 *       toDate() 메서드 존재 여부로 판별
 * @note 모든 유효한 입력은 Timestamp로 변환되어 출력 타입이 일관됨
 *
 * @example
 * const schema = z.object({
 *   createdAt: timestampSchema,
 * });
 *
 * // 유효한 입력:
 * { createdAt: Timestamp.now() }
 * { createdAt: new Date() }
 * { createdAt: { seconds: 1234567890, nanoseconds: 0 } }
 */
export const timestampSchema = z
  .custom<
    Timestamp | Date | { seconds: number; nanoseconds: number } | { _methodName: 'serverTimestamp' }
  >(
    (val) =>
      isTimestampLike(val) ||
      val instanceof Date ||
      isTimestampObject(val) ||
      isServerTimestampSentinel(val),
    { message: 'Timestamp 형식이 아닙니다' }
  )
  .transform((val): Timestamp => {
    // 이미 Timestamp-like 객체인 경우 그대로 반환
    if (isTimestampLike(val)) {
      return val as Timestamp;
    }
    // Date 객체인 경우 Timestamp로 변환
    if (val instanceof Date) {
      return Timestamp.fromDate(val);
    }
    // { seconds, nanoseconds } 객체인 경우 Timestamp로 변환
    if (isTimestampObject(val)) {
      return new Timestamp(val.seconds, val.nanoseconds);
    }
    // serverTimestamp() 센티널 값인 경우 현재 시간으로 변환
    // (pendingWrites 상태에서 읽은 경우)
    if (isServerTimestampSentinel(val)) {
      return Timestamp.now();
    }
    // 여기에 도달하면 안됨 (위의 custom에서 이미 검증됨)
    throw new Error('Invalid timestamp format');
  });

/**
 * 선택적 Timestamp 스키마
 *
 * @description null/undefined 허용
 *
 * @example
 * const schema = z.object({
 *   confirmedAt: optionalTimestampSchema,
 * });
 */
export const optionalTimestampSchema = timestampSchema.optional().nullable();

/**
 * Timestamp 또는 null 스키마 (nullable만, optional 아님)
 *
 * @description 필드는 있지만 null일 수 있는 경우
 */
export const nullableTimestampSchema = timestampSchema.nullable();

// ============================================================================
// Duration Schema
// ============================================================================

/**
 * 시간 간격(Duration) 스키마
 *
 * @description 시간/분/초 형태의 duration 또는 밀리초 숫자
 *
 * @example
 * { hours: 2, minutes: 30 }
 * 9000000 (밀리초)
 */
export const durationSchema = z.union([
  // 객체 형태
  z.object({
    hours: z.number().min(0).optional(),
    minutes: z.number().min(0).max(59).optional(),
    seconds: z.number().min(0).max(59).optional(),
  }),
  // 밀리초 숫자
  z.number().min(0),
  // 문자열 형태 (HH:MM:SS 또는 HH:MM)
  z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
]);

export const optionalDurationSchema = durationSchema.optional().nullable();

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
 * 이메일 스키마
 */
export const emailSchema = z.string().email('올바른 이메일 형식이 아닙니다');

/**
 * 한국 전화번호 스키마
 */
export const phoneSchema = z.string().regex(/^01[0-9]{8,9}$/, '올바른 휴대폰 번호 형식이 아닙니다');

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

// ============================================================================
// Type Exports
// ============================================================================

export type TimestampInput = z.infer<typeof timestampSchema>;
export type DurationInput = z.infer<typeof durationSchema>;
export type MetadataInput = z.infer<typeof metadataSchema>;
