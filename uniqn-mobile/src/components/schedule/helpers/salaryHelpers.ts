/**
 * UNIQN Mobile - ScheduleCard 급여 helper
 *
 * @description schedule UI는 canonical settlement projection만 읽는다.
 */

import { getRoleSalaryFromSettlementSource, type SalaryInfo } from '@/utils/settlement';
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
  if (type === 'other') return '?묒쓽';
  const typeLabel = type === 'hourly' ? '?쒓툒' : type === 'daily' ? '?쇨툒' : '?붽툒';
  return `${typeLabel} ${amount.toLocaleString()}??`;
}
