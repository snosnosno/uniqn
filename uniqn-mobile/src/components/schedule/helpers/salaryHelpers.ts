/**
 * UNIQN Mobile - ScheduleCard 급여 헬퍼
 *
 * @description 급여 조회 및 계산 관련 유틸리티
 * @version 1.0.0
 */

import type { SalaryInfo } from '@/utils/settlement';
import type { JobPostingCard } from '@/types';

/**
 * 역할별 급여 조회 (dateRequirements에서 해당 날짜/역할의 급여 찾기)
 */
export function getRoleSalaryFromCard(
  card: JobPostingCard | undefined,
  date: string,
  role: string,
  customRole?: string
): SalaryInfo | undefined {
  if (!card?.dateRequirements) return undefined;

  const dateReq = card.dateRequirements.find((dr) => dr.date === date);
  if (!dateReq) return undefined;

  for (const timeSlot of dateReq.timeSlots || []) {
    const roleInfo = timeSlot.roles?.find(
      (r) =>
        r.role === role ||
        (role === 'other' && r.role === 'other' && r.customRole === customRole)
    );
    if (roleInfo?.salary) {
      return roleInfo.salary;
    }
  }
  return undefined;
}

/**
 * 급여 표시 문자열 생성
 */
export function formatSalaryDisplay(salary: SalaryInfo | undefined): string | null {
  if (!salary) return null;

  const { type, amount } = salary;
  if (type === 'other') return '협의';
  const typeLabel = type === 'hourly' ? '시급' : type === 'daily' ? '일급' : '월급';
  return `${typeLabel} ${amount.toLocaleString()}원`;
}
