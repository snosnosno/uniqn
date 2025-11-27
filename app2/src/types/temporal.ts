/**
 * 시간 관련 타입 정의 (SSOT)
 *
 * 이 파일은 T-HOLDEM 프로젝트의 모든 시간 관련 타입을 정의합니다.
 * 날짜, 시간, 타임스탬프에 대한 표준 타입을 제공합니다.
 *
 * @version 1.0
 * @since 2025-02-04
 * @author T-HOLDEM Development Team
 *
 * @example
 * ```typescript
 * import { DateString, TimeString, StandardTimestamp } from '@/types/temporal';
 *
 * interface Schedule {
 *   date: DateString;           // '2025-01-28'
 *   startTime: TimeString;      // '18:00'
 *   endTime: TimeString;        // '02:00'
 *   createdAt: StandardTimestamp;
 * }
 * ```
 */

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// 기본 시간 타입
// =============================================================================

/**
 * ISO 날짜 문자열 (YYYY-MM-DD 형식)
 *
 * @example '2025-01-28', '2025-12-31'
 */
export type DateString = string;

/**
 * 시간 문자열 (HH:mm 형식)
 *
 * @example '18:00', '02:30', '09:15'
 */
export type TimeString = string;

/**
 * 날짜-시간 문자열 (ISO 8601 형식)
 *
 * @example '2025-01-28T18:00:00Z', '2025-01-28T18:00:00+09:00'
 */
export type DateTimeString = string;

// =============================================================================
// Firebase Timestamp 타입
// =============================================================================

/**
 * Firebase Timestamp 또는 null
 *
 * @description
 * Firebase Firestore의 Timestamp 타입을 래핑합니다.
 * 선택적 시간 필드에 사용됩니다.
 *
 * @example
 * ```typescript
 * interface WorkLog {
 *   actualStartTime: StandardTimestamp;  // Timestamp | null
 *   actualEndTime: StandardTimestamp;
 * }
 * ```
 */
export type StandardTimestamp = Timestamp | null;

/**
 * Firebase Timestamp 또는 undefined
 *
 * @description
 * 선택적 필드에서 undefined를 허용할 때 사용합니다.
 */
export type OptionalTimestamp = Timestamp | null | undefined;

/**
 * 시간 값으로 사용 가능한 타입들
 *
 * @description
 * string (HH:mm), Timestamp, null 중 하나입니다.
 * Firebase 데이터와 UI 표시 모두를 지원합니다.
 */
export type FlexibleTime = TimeString | Timestamp | null;

// =============================================================================
// 시간 범위 타입
// =============================================================================

/**
 * 날짜 범위
 */
export interface DateRange {
  /** 시작 날짜 (YYYY-MM-DD) */
  start: DateString;
  /** 종료 날짜 (YYYY-MM-DD) */
  end: DateString;
}

/**
 * 시간 범위
 */
export interface TimeRange {
  /** 시작 시간 (HH:mm) */
  start: TimeString;
  /** 종료 시간 (HH:mm) */
  end: TimeString;
}

/**
 * 날짜-시간 범위 (Timestamp 기반)
 */
export interface TimestampRange {
  /** 시작 시간 */
  start: StandardTimestamp;
  /** 종료 시간 */
  end: StandardTimestamp;
}

// =============================================================================
// 근무 시간 관련 타입
// =============================================================================

/**
 * 예정 근무 시간
 */
export interface ScheduledTime {
  /** 예정 시작 시간 */
  scheduledStartTime: FlexibleTime;
  /** 예정 종료 시간 */
  scheduledEndTime: FlexibleTime;
}

/**
 * 실제 근무 시간
 */
export interface ActualTime {
  /** 실제 시작 시간 */
  actualStartTime: FlexibleTime;
  /** 실제 종료 시간 */
  actualEndTime: FlexibleTime;
}

/**
 * 전체 근무 시간 정보
 */
export interface WorkTimeInfo extends ScheduledTime, ActualTime {
  /** 총 근무 시간 (분) */
  totalWorkMinutes?: number;
  /** 총 휴게 시간 (분) */
  totalBreakMinutes?: number;
}

// =============================================================================
// 유틸리티 타입
// =============================================================================

/**
 * 시간 필드를 가진 객체에서 특정 시간 필드만 추출
 */
export type PickTimeFields<T, K extends keyof T> = Pick<T, K>;

/**
 * 시간 관련 메타데이터
 */
export interface TemporalMetadata {
  /** 생성 시간 */
  createdAt?: Timestamp;
  /** 수정 시간 */
  updatedAt?: Timestamp;
}

// =============================================================================
// 타입 가드 함수
// =============================================================================

/**
 * Timestamp 타입인지 확인
 */
export const isTimestamp = (value: unknown): value is Timestamp => {
  return value instanceof Timestamp;
};

/**
 * 유효한 DateString인지 확인 (YYYY-MM-DD 형식)
 */
export const isValidDateString = (value: unknown): value is DateString => {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(value);
};

/**
 * 유효한 TimeString인지 확인 (HH:mm 형식)
 */
export const isValidTimeString = (value: unknown): value is TimeString => {
  if (typeof value !== 'string') return false;
  const timeRegex = /^\d{2}:\d{2}$/;
  return timeRegex.test(value);
};

/**
 * FlexibleTime에서 TimeString 추출
 */
export const extractTimeString = (value: FlexibleTime): TimeString | null => {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (isTimestamp(value)) {
    const date = value.toDate();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return null;
};
