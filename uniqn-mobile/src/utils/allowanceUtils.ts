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
 * 보장시간 표시 라벨 (SETTLE-2)
 *
 * @description 보장시간은 **수당이 아니라 근무 조건**이다 — 금액 계산 경로
 *   (SettlementCalculator·helpers 어느 쪽)에도 반영되지 않는다. 예전엔 이 값이
 *   getAllowanceItems 반환에 섞여 '수당' 목록에 함께 렌더됐고, 그래서 앱이 금액을
 *   약속하는 것처럼 보였다. 복장·경력과 같은 조건 축으로 분리한다.
 *
 * @returns 표시할 라벨. 미설정이면 null.
 */
export function getGuaranteedHoursLabel(allowances: Allowances | undefined): string | null {
  if (!allowances?.guaranteedHours || allowances.guaranteedHours <= 0) return null;
  return `보장 ${allowances.guaranteedHours}시간`;
}

/**
 * 수당 정보를 표시용 문자열 배열로 변환
 *
 * @param allowances - 수당 정보 객체
 * @returns 수당(금액·현물) 항목 문자열 배열
 *
 * @remarks 보장시간은 **포함하지 않는다** — 금액에 반영되지 않는 근무 조건이라
 *   `getGuaranteedHoursLabel` 로 분리했다.
 *
 * @example
 * getAllowanceItems(allowances) // ['식사제공', '교통비 10,000원']
 */
export function getAllowanceItems(allowances: Allowances | undefined): string[] {
  if (!allowances) return [];

  const items: string[] = [];

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
