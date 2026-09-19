/**
 * UNIQN Mobile - ScheduleCard salary helper
 *
 * @description Reads canonical settlement projection data for schedule UI.
 */

import {
  formatCurrency,
  getDisplayRoleSalaryFromSettlementSource,
  getSalaryTypeLabel,
  type SalaryInfo,
} from '@/utils/settlement';
import type { SchedulePostingProjection } from '@/types';

/**
 * 카드에 표시할 급여 — 합의 근거가 없으면 undefined(감사 3-1).
 *
 * 예전에는 계산용 해소기를 그대로 썼다. 그 해소기는 어떤 분기에서도 시급 15,000원으로
 * 메우므로 **합의한 적 없는 금액이 카드에 확정 표기**됐다. 표시 전용 해소기로 바꿔
 * 근거가 없으면 급여 줄 자체를 그리지 않는다(formatSalaryDisplay 가 null 을 반환).
 */
export function getRoleSalaryFromProjection(
  projection: SchedulePostingProjection | undefined,
  role: string,
  customRole?: string
): SalaryInfo | undefined {
  if (!projection) {
    return undefined;
  }

  return (
    getDisplayRoleSalaryFromSettlementSource(projection.settlement, role, customRole) ?? undefined
  );
}

export function formatSalaryDisplay(salary: SalaryInfo | undefined): string | null {
  if (!salary) return null;

  const { type, amount } = salary;
  const typeLabel = getSalaryTypeLabel(type);

  if (type === 'other') {
    return typeLabel;
  }

  return `${typeLabel} ${formatCurrency(amount)}`;
}

/**
 * 그룹 카드의 급여 표기.
 *
 * 예전에는 `postingProjection.settlement.defaultSalary`(공고 기본값)를 그렸다 —
 * 플로어로 지원했는데 딜러 단가가 뜨는 식으로 **내 역할이 아닌 금액**이 보였다.
 * 그룹에 담긴 역할로 조회하고, 역할마다 단가가 다르면 하나를 대표로 내세우지 않는다.
 */
export function formatGroupSalaryDisplay(
  projection: SchedulePostingProjection | undefined,
  roles: readonly string[],
  customRoles?: readonly (string | undefined)[]
): string | null {
  if (!projection || roles.length === 0) return null;

  const displays = roles.map((role, index) =>
    formatSalaryDisplay(getRoleSalaryFromProjection(projection, role, customRoles?.[index]))
  );

  // 근거 없는 역할(null)을 '없는 것'으로 접으면, 근거가 있는 한 역할의 단가가 그룹
  // 전체 단가처럼 보인다(감사 3-1과 같은 클래스의 조용한 오답). 하나라도 미정이면
  // 대표 금액을 내세우지 않는다.
  if (displays.some((display) => !display)) {
    return displays.every((display) => !display) ? null : '역할별 상이';
  }

  const distinct = new Set(displays.filter((display): display is string => Boolean(display)));
  if (distinct.size === 0) return null;
  if (distinct.size > 1) return '역할별 상이';

  return distinct.values().next().value ?? null;
}
