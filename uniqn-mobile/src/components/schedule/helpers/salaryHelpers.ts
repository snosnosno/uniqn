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
