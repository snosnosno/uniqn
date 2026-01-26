/**
 * 날짜 핵심 유틸리티
 *
 * @description 기본 날짜 변환 및 파싱 함수들
 * @version 1.0.0
 */

import { format, parseISO, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

/**
 * Date 또는 Timestamp를 Date로 변환
 */
export function toDate(value: Date | Timestamp | string | undefined | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const parsed = parseISO(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * ISO 날짜 문자열 생성 (YYYY-MM-DD)
 */
export function toISODateString(date: Date | null): string | null {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * 다양한 날짜 형식을 YYYY-MM-DD 문자열로 변환
 */
export function toDateString(
  dateInput: string | Date | Timestamp | { toDate?: () => Date } | { seconds: number } | null | undefined
): string {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    return dateInput;
  }

  if (dateInput instanceof Date) {
    return format(dateInput, 'yyyy-MM-dd');
  }

  if (dateInput instanceof Timestamp) {
    return format(dateInput.toDate(), 'yyyy-MM-dd');
  }

  if ('toDate' in dateInput && typeof dateInput.toDate === 'function') {
    return format(dateInput.toDate(), 'yyyy-MM-dd');
  }

  if ('seconds' in dateInput) {
    return format(new Date(dateInput.seconds * 1000), 'yyyy-MM-dd');
  }

  return '';
}

/**
 * YYYY-MM-DD 문자열을 Date 객체로 변환
 */
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : null;
}

/**
 * 고유 ID 생성
 *
 * @description 타임스탬프 + 랜덤값으로 고유 ID 생성
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
