/**
 * 날짜 타입 가드 함수
 *
 * Firebase Timestamp 및 날짜 관련 타입 체크를 위한 가드 함수
 * 모든 날짜 유틸리티에서 공통으로 사용
 *
 * @module utils/core/dateTypeGuards
 */

import type { TimestampLike } from './dateTypes';

/**
 * toDate() 메서드를 가진 객체인지 확인 (Firebase Timestamp 등)
 *
 * @param input - 체크할 값
 * @returns toDate() 메서드가 있으면 true
 *
 * @example
 * ```ts
 * const timestamp = Timestamp.now();
 * if (hasToDateMethod(timestamp)) {
 *   const date = timestamp.toDate(); // Date 타입으로 추론
 * }
 * ```
 */
export function hasToDateMethod(input: unknown): input is { toDate: () => Date } {
  return (
    input !== null &&
    typeof input === 'object' &&
    'toDate' in input &&
    typeof (input as { toDate: unknown }).toDate === 'function'
  );
}

/**
 * seconds 속성을 가진 객체인지 확인 (TimestampLike)
 *
 * @param input - 체크할 값
 * @returns seconds 속성이 숫자이면 true
 *
 * @example
 * ```ts
 * const data = { seconds: 1704067200, nanoseconds: 0 };
 * if (hasSecondsProperty(data)) {
 *   const date = new Date(data.seconds * 1000);
 * }
 * ```
 */
export function hasSecondsProperty(input: unknown): input is TimestampLike {
  return (
    input !== null &&
    typeof input === 'object' &&
    'seconds' in input &&
    typeof (input as { seconds: unknown }).seconds === 'number'
  );
}

/**
 * 유효한 Date 객체인지 확인 (Type Guard)
 *
 * @param date - 체크할 값
 * @returns Date 객체이고 유효하면 true
 *
 * @example
 * ```ts
 * const maybeDate = new Date('invalid');
 * if (isValidDate(maybeDate)) {
 *   // maybeDate는 유효한 Date 타입
 * }
 * ```
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * YYYY-MM-DD 형식의 날짜 문자열인지 확인
 *
 * @param input - 체크할 값
 * @returns YYYY-MM-DD 형식이면 true
 *
 * @example
 * ```ts
 * isISODateString('2025-01-15'); // true
 * isISODateString('25-01-15');   // false
 * isISODateString('2025/01/15'); // false
 * ```
 */
export function isISODateString(input: unknown): input is string {
  return typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input);
}

/**
 * HH:mm 형식의 시간 문자열인지 확인
 *
 * @param input - 체크할 값
 * @returns HH:mm 형식이면 true
 *
 * @example
 * ```ts
 * isTimeString('14:30'); // true
 * isTimeString('2:30');  // true
 * isTimeString('14:30:00'); // false
 * ```
 */
export function isTimeString(input: unknown): input is string {
  return typeof input === 'string' && /^\d{1,2}:\d{2}$/.test(input);
}
