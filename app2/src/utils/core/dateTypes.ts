/**
 * 날짜 관련 통합 타입 정의
 *
 * 모든 날짜 유틸리티에서 사용하는 타입을 단일 위치에서 정의
 * 중복 타입 정의 제거 및 일관성 보장
 *
 * @module utils/core/dateTypes
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Firebase Timestamp-like 객체 타입
 * seconds와 nanoseconds 속성을 가진 객체
 */
export type TimestampLike = {
  seconds: number;
  nanoseconds?: number;
};

/**
 * 날짜 입력 타입 (모든 허용 가능한 날짜 형식)
 *
 * 다음 형식을 모두 지원:
 * - Firebase Timestamp
 * - Date 객체
 * - ISO 문자열 (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss)
 * - Unix timestamp (밀리초)
 * - TimestampLike 객체 (seconds, nanoseconds)
 * - toDate() 메서드를 가진 객체
 * - null/undefined
 */
export type DateInput =
  | Timestamp
  | Date
  | string
  | number
  | TimestampLike
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null
  | undefined;

/**
 * 시간 계산용 입력 타입
 * DateInput의 서브셋으로, 숫자 타입 제외
 */
export type TimeCalculationInput = { toDate: () => Date } | Date | string | null | undefined;

/**
 * Timestamp 입력 타입 (timeUtils 호환)
 */
export type TimestampInput = { toDate: () => Date } | Date | number | string | null | undefined;
