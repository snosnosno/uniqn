/**
 * UNIQN Mobile - ScheduleCard salary helper
 *
 * @description Reads canonical settlement projection data for schedule UI.
 */

import {
  formatCurrency,
  getRoleSalaryFromSettlementSource,
  getSalaryTypeLabel,
  type SalaryInfo,
} from '@/utils/settlement';
import type { SchedulePostingProjection } from '@/types';

export function getRoleSalaryFromProjection(
  projection: SchedulePostingProjection | undefined,
  role: string,
  customRole?: string
): SalaryInfo | undefined {
  if (!projection) {
    return undefined;
  }

  return getRoleSalaryFromSettlementSource(projection.settlement, role, customRole);
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

  const distinct = new Set(displays.filter((display): display is string => Boolean(display)));
  if (distinct.size === 0) return null;
  if (distinct.size > 1) return '역할별 상이';

  return distinct.values().next().value ?? null;
}
