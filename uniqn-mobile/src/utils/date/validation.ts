/**
 * 날짜 검증 유틸리티
 *
 * @description 날짜 형식 검증 및 범위 확인 함수들
 * @version 1.0.0
 */

import { toDate, toISODateString } from './core';

/**
 * HH:mm 형식 검증
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * yyyy-MM-dd 형식 검증
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * 날짜 문자열을 Date 객체로 변환
 */
export function parseDate(dateString: string): Date | null {
  if (!isValidDateFormat(dateString)) return null;
  return toDate(dateString);
}

/**
 * 긴급 공고 날짜 제한 (7일 이내)
 */
export function isWithinUrgentDateLimit(date: string): boolean {
  const targetDate = parseDate(date);
  if (!targetDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 7);

  return targetDate >= today && targetDate <= limitDate;
}

/**
 * 타입별 날짜 개수 검증
 */
export function validateDateCount(
  postingType: 'regular' | 'urgent' | 'tournament' | 'fixed',
  count: number
): boolean {
  if (postingType === 'regular' || postingType === 'urgent') {
    return count === 1;
  }
  if (postingType === 'tournament') {
    return count >= 1 && count <= 30;
  }
  // fixed 타입은 날짜 기반이 아니므로 날짜 수 검증을 건너뜀
  return true;
}

/**
 * 중복 날짜 검사
 */
export function isDuplicateDate(existingDates: string[], newDate: string): boolean {
  return existingDates.includes(newDate);
}

/**
 * N일 후 날짜 문자열
 */
export function getDateAfterDays(days: number): string {
  const today = new Date();
  today.setDate(today.getDate() + days);
  return toISODateString(today) ?? '';
}
