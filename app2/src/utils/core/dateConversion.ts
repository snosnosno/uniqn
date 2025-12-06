/**
 * 핵심 날짜 변환 함수
 *
 * 모든 날짜 유틸리티의 기반이 되는 변환 함수
 * 일관된 날짜 처리를 보장
 *
 * @module utils/core/dateConversion
 */

import type { DateInput, TimestampInput } from './dateTypes';
import {
  hasToDateMethod,
  hasSecondsProperty,
  isValidDate,
  isISODateString,
} from './dateTypeGuards';

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환 (내부 헬퍼)
 *
 * @internal
 * @param date - Date 객체
 * @returns YYYY-MM-DD 형식 문자열
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 다양한 날짜 입력을 Date 객체로 변환
 *
 * @param input - 변환할 날짜 입력
 * @returns Date 객체 (실패 시 현재 시간)
 *
 * @example
 * ```ts
 * toDate(Timestamp.now());           // Date
 * toDate('2025-01-15');              // Date
 * toDate(1704067200000);             // Date
 * toDate({ seconds: 1704067200 });   // Date
 * ```
 */
export function toDate(input: DateInput | TimestampInput): Date {
  if (!input) return new Date();

  try {
    // Firebase Timestamp (toDate 메서드)
    if (hasToDateMethod(input)) {
      return input.toDate();
    }

    // TimestampLike (seconds 속성)
    if (hasSecondsProperty(input)) {
      return new Date(input.seconds * 1000);
    }

    // Date 객체
    if (input instanceof Date) {
      return isValidDate(input) ? input : new Date();
    }

    // 숫자 (밀리초 timestamp)
    if (typeof input === 'number') {
      const date = new Date(input);
      return isValidDate(date) ? date : new Date();
    }

    // 문자열
    if (typeof input === 'string') {
      const date = new Date(input);
      return isValidDate(date) ? date : new Date();
    }

    return new Date();
  } catch {
    return new Date();
  }
}

/**
 * 다양한 날짜 입력을 Date 객체로 변환 (실패 시 null 반환)
 *
 * @param input - 변환할 날짜 입력
 * @returns Date 객체 또는 null
 *
 * @example
 * ```ts
 * parseToDate(Timestamp.now());    // Date
 * parseToDate('invalid');          // null
 * parseToDate(null);               // null
 * ```
 */
export function parseToDate(input: DateInput): Date | null {
  if (!input) return null;

  try {
    // Date 객체
    if (input instanceof Date) {
      return isValidDate(input) ? input : null;
    }

    // Firebase Timestamp (toDate 메서드)
    if (hasToDateMethod(input)) {
      const date = input.toDate();
      return isValidDate(date) ? date : null;
    }

    // TimestampLike (seconds, nanoseconds 속성)
    if (hasSecondsProperty(input)) {
      const seconds = input.seconds;
      const nanoseconds = input.nanoseconds || 0;

      // 유효성 검증 (1970~2038년 범위)
      if (typeof seconds !== 'number' || seconds < 0 || seconds > 2147483647) {
        return null;
      }
      if (typeof nanoseconds !== 'number' || nanoseconds < 0 || nanoseconds >= 1000000000) {
        return null;
      }

      const date = new Date(seconds * 1000 + nanoseconds / 1000000);
      return isValidDate(date) ? date : null;
    }

    // 숫자 (밀리초 timestamp)
    if (typeof input === 'number') {
      const date = new Date(input);
      return isValidDate(date) ? date : null;
    }

    // 문자열
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return null;

      // Timestamp 문자열 형식 처리
      const timestampMatch = trimmed.match(/seconds=(\d+)/i);
      if (timestampMatch && timestampMatch[1]) {
        const seconds = parseInt(timestampMatch[1], 10);
        if (!isNaN(seconds) && seconds >= 0 && seconds <= 2147483647) {
          const date = new Date(seconds * 1000);
          if (isValidDate(date)) return date;
        }
      }

      // 일반 날짜 문자열
      const date = new Date(trimmed);
      return isValidDate(date) ? date : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 모든 날짜 타입을 YYYY-MM-DD 문자열로 변환
 *
 * @param input - 변환할 날짜 입력
 * @returns YYYY-MM-DD 형식 문자열 (실패 시 오늘 날짜)
 *
 * @example
 * ```ts
 * toDateString(Timestamp.now());    // '2025-01-15'
 * toDateString('2025-01-15');       // '2025-01-15' (그대로)
 * toDateString(null);               // 오늘 날짜
 * ```
 */
export function toDateString(input: DateInput): string {
  if (!input) return formatDateToISO(new Date());

  try {
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (isISODateString(input)) {
      return input;
    }

    const date = toDate(input);
    return formatDateToISO(date);
  } catch {
    return formatDateToISO(new Date());
  }
}

/**
 * 다양한 날짜 형식을 YYYY-MM-DD 문자열로 변환 (실패 시 빈 문자열)
 *
 * @param input - 변환할 날짜 입력
 * @returns YYYY-MM-DD 형식 문자열 또는 빈 문자열
 *
 * @example
 * ```ts
 * convertToDateString(Timestamp.now()); // '2025-01-15'
 * convertToDateString('invalid');       // ''
 * convertToDateString(null);            // ''
 * ```
 */
export function convertToDateString(input: DateInput): string {
  if (!input) return '';

  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (isISODateString(input)) {
    return input;
  }

  const date = parseToDate(input);
  if (!date) return '';

  return formatDateToISO(date);
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 *
 * @returns 오늘 날짜 (YYYY-MM-DD)
 *
 * @example
 * ```ts
 * getTodayString(); // '2025-01-15'
 * ```
 */
export function getTodayString(): string {
  return formatDateToISO(new Date());
}

/**
 * 한국 시간대 기준 오늘 날짜 반환
 *
 * @returns 한국 시간대 오늘 날짜 (YYYY-MM-DD)
 */
export function getKoreanDate(): string {
  try {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const year = koreaTime.getUTCFullYear();
    const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreaTime.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return formatDateToISO(new Date());
  }
}
