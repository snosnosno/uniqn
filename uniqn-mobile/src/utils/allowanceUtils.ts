/**
 * UNIQN Mobile - 수당 표시 유틸리티
 *
 * @description 수당 정보를 표시용 문자열로 변환하는 유틸리티
 * @version 2.0.0 (이모지 제거 — DESIGN.md 이모지 UI 금지 정책)
 */

import { PROVIDED_FLAG } from '@/utils/settlement';
import type { Allowances } from '@/utils/settlement';

// ============================================================================
// Functions
// ============================================================================

/**
 * 수당 정보를 표시용 문자열 배열로 변환
 *
 * @param allowances - 수당 정보 객체
 * @returns 수당 항목 문자열 배열
 *
 * @example
 * getAllowanceItems(allowances) // ['보장 8시간', '식사제공', '교통비 10,000원']
 */
export function getAllowanceItems(allowances: Allowances | undefined): string[] {
  if (!allowances) return [];

  const items: string[] = [];

  // 보장시간
  if (allowances.guaranteedHours && allowances.guaranteedHours > 0) {
    items.push(`보장 ${allowances.guaranteedHours}시간`);
  }

  // 식비
  if (allowances.meal === PROVIDED_FLAG) {
    items.push('식사제공');
  } else if (allowances.meal && allowances.meal > 0) {
    items.push(`식비 ${allowances.meal.toLocaleString()}원`);
  }

  // 교통비
  if (allowances.transportation === PROVIDED_FLAG) {
    items.push('교통비제공');
  } else if (allowances.transportation && allowances.transportation > 0) {
    items.push(`교통비 ${allowances.transportation.toLocaleString()}원`);
  }

  // 숙박비
  if (allowances.accommodation === PROVIDED_FLAG) {
    items.push('숙박제공');
  } else if (allowances.accommodation && allowances.accommodation > 0) {
    items.push(`숙박비 ${allowances.accommodation.toLocaleString()}원`);
  }

  return items;
}

/**
 * 총 수당 금액 계산 (제공 항목 제외)
 *
 * @param allowances - 수당 정보 객체
 * @returns 총 수당 금액 (원)
 *
 * @example
 * calculateTotalAllowance({ meal: 10000, transportation: -1, accommodation: 50000 })
 * // 60000 (교통비제공은 금액에서 제외)
 */
export function calculateTotalAllowance(allowances: Allowances | undefined): number {
  if (!allowances) return 0;

  let total = 0;

  if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
    total += allowances.meal;
  }
  if (
    allowances.transportation &&
    allowances.transportation !== PROVIDED_FLAG &&
    allowances.transportation > 0
  ) {
    total += allowances.transportation;
  }
  if (
    allowances.accommodation &&
    allowances.accommodation !== PROVIDED_FLAG &&
    allowances.accommodation > 0
  ) {
    total += allowances.accommodation;
  }
  if (allowances.additional && allowances.additional > 0) {
    total += allowances.additional;
  }

  return total;
}
