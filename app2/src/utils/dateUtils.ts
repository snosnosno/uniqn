import { Timestamp } from 'firebase/firestore';
import { logger } from './logger';

// ===== Core 모듈에서 타입 및 함수 import =====
import type { DateInput as CoreDateInput } from './core/dateTypes';
import {
  hasToDateMethod,
  hasSecondsProperty,
  isValidDate as coreIsValidDate,
  formatDateToISO,
  toDateString as coreToDateString,
  getKoreanDate as coreGetKoreanDate,
} from './core';

/**
 * 간소화된 날짜 유틸리티
 * 모든 날짜를 표준 형식으로 통합 처리
 *
 * 기존 432줄 → Core 모듈 활용으로 간소화
 * 하위 호환성 100% 유지
 *
 * Phase 3 추가 함수:
 * - toISODateString: TypeScript strict mode 준수 (null 반환)
 * - formatDate: 'date' | 'datetime' 포맷 지원
 * - parseDate: 문자열 → Date 변환
 * - isValidDate: Type Guard
 */

// ===== Type Definitions (TypeScript Strict Mode) =====
// Core에서 re-export (하위 호환성 유지)

// TimestampLike 타입은 core/dateTypes.ts에서 통합 관리

/**
 * 날짜 입력 타입 (모든 허용 가능한 날짜 형식)
 */
export type DateInput = CoreDateInput;

// ===== Core 함수 re-export (하위 호환성 유지) =====

/**
 * 모든 날짜 타입을 yyyy-MM-dd 문자열로 변환
 * @param input - Timestamp, Date, string, number 등 모든 날짜 형식
 * @returns yyyy-MM-dd 형식의 날짜 문자열
 */
export function toDateString(input: DateInput): string {
  return coreToDateString(input);
}

/**
 * 날짜 문자열을 정규화 (YYYY-MM-DD 형식으로 강제 변환)
 * @param dateString - 정규화할 날짜 문자열
 * @returns YYYY-MM-DD 형식의 정규화된 날짜 문자열
 *
 * @example
 * normalizeDate('2025-1-16') => '2025-01-16'
 * normalizeDate('2025-01-16') => '2025-01-16'
 */
export function normalizeDate(dateString: string): string {
  if (!dateString) return '';

  try {
    // 이미 정규화된 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Date 객체로 변환 후 정규화
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return '';
    }

    return formatDateToISO(date);
  } catch {
    return '';
  }
}

/**
 * 한국 시간대 기준으로 현재 날짜 반환
 * @returns YYYY-MM-DD 형식의 한국 시간대 날짜
 *
 * @example
 * // 한국 시간 2025-01-17 00:30 (UTC 2025-01-16 15:30)
 * getKoreanDate() => '2025-01-17'
 */
export function getKoreanDate(): string {
  return coreGetKoreanDate();
}

/**
 * 시간을 HH:mm 형식으로 변환
 * @param input - 시간 정보를 포함한 모든 형식
 * @returns HH:mm 형식의 시간 문자열
 */
export function toTimeString(input: DateInput): string {
  if (!input) return '';

  // 이미 HH:mm 형식인 경우
  if (typeof input === 'string' && /^\d{1,2}:\d{2}$/.test(input)) {
    return input;
  }

  try {
    let date: Date;

    // Firebase Timestamp 객체 처리
    if (hasToDateMethod(input)) {
      date = input.toDate();
    }
    // TimestampLike 객체 처리
    else if (hasSecondsProperty(input)) {
      date = new Date(input.seconds * 1000);
    }
    // Date, string, number 처리
    else if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'string' || typeof input === 'number') {
      date = new Date(input);
    } else {
      return '';
    }

    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch {
    // 에러 무시
  }

  return '';
}

/**
 * 날짜를 읽기 쉬운 형식으로 표시 (12월 29일 (일))
 * @param dateString - yyyy-MM-dd 형식의 날짜 문자열
 * @returns 한국어 형식의 날짜 표시
 */
export function formatDateDisplay(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return dateString;

    const date = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()] || '';
    return `${month}월 ${day}일 (${weekday})`;
  } catch {
    return dateString;
  }
}

/**
 * 날짜를 Firebase Timestamp로 변환
 * @param input - 모든 날짜 형식
 * @returns Firebase Timestamp 객체
 */
export function toTimestamp(input: DateInput): Timestamp {
  const dateStr = toDateString(input);
  const date = new Date(dateStr);
  return Timestamp.fromDate(date);
}

/**
 * yy-MM-dd(요일) 형식의 문자열을 yyyy-MM-dd로 변환
 * @param dateStr - yy-MM-dd(요일) 형식 문자열
 * @returns yyyy-MM-dd 형식 문자열
 */
export function parseShortDateFormat(dateStr: string): string {
  if (/^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/.test(dateStr)) {
    const datePart = dateStr.split('(')[0];
    if (datePart) {
      const parts = datePart.split('-');
      const yearPart = parts[0];
      const monthPart = parts[1];
      const dayPart = parts[2];

      if (yearPart && monthPart && dayPart) {
        const year = 2000 + parseInt(yearPart, 10);
        const month = monthPart.padStart(2, '0');
        const day = dayPart.padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }
  return dateStr;
}

// ===== 하위 호환성을 위한 기존 함수명 export =====

/**
 * @deprecated Use toDateString instead
 */
export const timestampToLocalDateString = toDateString;

/**
 * 통합된 시간 포맷팅 함수
 * @deprecated Use toTimeString for simple cases
 */
export function formatTime(
  timestamp: DateInput,
  options: {
    defaultValue?: string;
    format?: 'HH:MM' | 'korean' | 'full';
    timezone?: string;
  } = {}
): string {
  const { defaultValue = '', format = 'HH:MM' } = options;

  if (!timestamp) return defaultValue;

  if (format === 'korean') {
    const time = toTimeString(timestamp);
    if (!time) return defaultValue;

    const parts = time.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${ampm} ${displayHour}:${String(minutes).padStart(2, '0')}`;
  }

  if (format === 'full') {
    const dateStr = toDateString(timestamp);
    const timeStr = toTimeString(timestamp);
    return dateStr && timeStr ? `${dateStr} ${timeStr}` : defaultValue;
  }

  return toTimeString(timestamp) || defaultValue;
}

/**
 * @deprecated Use toTimeString instead
 */
export const formatTimeForInput = toTimeString;

/**
 * @deprecated Use formatTime with korean option
 */
export function formatTimeKorean(timestamp: DateInput): string {
  return formatTime(timestamp, { defaultValue: '미정', format: 'korean' });
}

// ===== Phase 3: TypeScript Strict Mode 준수 함수 =====

/**
 * ISO 날짜 문자열로 변환 (YYYY-MM-DD)
 *
 * 기존 toISOString().split('T')[0] 패턴 대체
 * TypeScript strict mode 준수: null 반환, any 타입 금지
 *
 * @param date - 변환할 날짜 (Date, string, null, undefined)
 * @returns YYYY-MM-DD 형식 문자열 또는 null (에러 시)
 *
 * @example
 * toISODateString(new Date()); // "2025-11-20"
 * toISODateString("2025-11-20T15:30:00Z"); // "2025-11-20"
 * toISODateString(null); // null
 * toISODateString("invalid"); // null (logger 경고)
 */
export function toISODateString(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (!isValidDate(dateObj)) {
      logger.warn('toISODateString: Invalid date', { date });
      return null;
    }

    return formatDateToISO(dateObj);
  } catch (error) {
    logger.warn('toISODateString: Conversion error', {
      component: 'dateUtils',
      data: { date },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 날짜를 지정된 포맷으로 변환
 *
 * @param date - 변환할 날짜 (Date, string, null, undefined)
 * @param format - 'date' (YYYY-MM-DD) 또는 'datetime' (YYYY-MM-DD HH:mm)
 * @returns 포맷된 날짜 문자열 또는 null (에러 시)
 *
 * @example
 * formatDate(new Date(), 'date'); // "2025-11-20"
 * formatDate(new Date(), 'datetime'); // "2025-11-20 14:30"
 * formatDate(null, 'date'); // null
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: 'date' | 'datetime'
): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (!isValidDate(dateObj)) {
      logger.warn('formatDate: Invalid date', {
        component: 'dateUtils',
        data: { date, format },
      });
      return null;
    }

    if (format === 'date') {
      return formatDateToISO(dateObj);
    }

    // datetime format: YYYY-MM-DD HH:mm
    const datePart = formatDateToISO(dateObj);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${datePart} ${hours}:${minutes}`;
  } catch (error) {
    logger.warn('formatDate: Conversion error', {
      component: 'dateUtils',
      data: { date, format },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 날짜 문자열을 Date 객체로 변환
 *
 * @param dateString - 변환할 날짜 문자열
 * @returns Date 객체 또는 null (에러 시)
 *
 * @example
 * parseDate("2025-11-20"); // Date(2025-11-20T00:00:00Z)
 * parseDate("invalid"); // null (logger 경고)
 * parseDate(null); // null
 */
export function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);

    if (!isValidDate(date)) {
      logger.warn('parseDate: Invalid date string', {
        component: 'dateUtils',
        data: { dateString },
      });
      return null;
    }

    return date;
  } catch (error) {
    logger.warn('parseDate: Parse error', {
      component: 'dateUtils',
      data: { dateString },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 날짜 유효성 검증 (Type Guard)
 *
 * @param date - 검증할 값
 * @returns Date 객체이고 유효하면 true
 *
 * @example
 * isValidDate(new Date()); // true
 * isValidDate(new Date('invalid')); // false
 * isValidDate(null); // false
 * isValidDate("2025-11-20"); // false (문자열은 Date 타입 아님)
 */
export function isValidDate(date: unknown): date is Date {
  return coreIsValidDate(date);
}
