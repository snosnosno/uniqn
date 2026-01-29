/**
 * UNIQN Mobile - 급여 비용 계산 유틸리티
 *
 * @description 역할별 급여를 기반으로 예상 비용 계산
 * @version 1.0.0
 */

import type { FormRoleWithCount } from '@/types';

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * 숫자를 한국 통화 형식으로 포맷
 *
 * @param value - 포맷할 숫자
 * @returns 포맷된 문자열 (예: "1,234,567")
 *
 * @example
 * formatCurrency(15000) // => "15,000"
 */
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('ko-KR');
};

/**
 * 통화 문자열을 숫자로 파싱
 *
 * @param value - 파싱할 문자열 (쉼표, 원 등 포함 가능)
 * @returns 파싱된 숫자 (유효하지 않으면 0)
 *
 * @example
 * parseCurrency("15,000원") // => 15000
 * parseCurrency("abc") // => 0
 */
export const parseCurrency = (value: string): number => {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
};

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * 1일 기준 예상 총 인건비 계산
 *
 * @description
 * - 협의(other) 타입은 제외
 * - 시급: 급여 × 인원 × 8시간
 * - 일급/월급: 급여 × 인원
 *
 * @param roles - 역할 배열 (급여 정보 포함)
 * @returns 예상 총 비용 (유효한 급여가 없으면 null)
 *
 * @example
 * const roles = [
 *   { name: '딜러', count: 2, salary: { type: 'hourly', amount: 15000 } },
 *   { name: '서버', count: 1, salary: { type: 'daily', amount: 100000 } }
 * ];
 * calculateEstimatedCost(roles);
 * // => 240000 + 100000 = 340000
 */
export function calculateEstimatedCost(
  roles: FormRoleWithCount[]
): number | null {
  let total = 0;
  let hasValidSalary = false;

  roles.forEach((role) => {
    const roleSalary = role.salary;
    if (roleSalary && roleSalary.type !== 'other' && roleSalary.amount > 0) {
      hasValidSalary = true;
      let roleTotal = roleSalary.amount * role.count;
      if (roleSalary.type === 'hourly') {
        roleTotal *= 8; // 시급 × 8시간
      }
      total += roleTotal;
    }
  });

  return hasValidSalary ? total : null;
}

/**
 * 역할 급여 총합 계산 (시간 환산 없이)
 *
 * @description 순수 급여 총합 (시급/일급/월급 구분 없이)
 * @param roles - 역할 배열
 * @returns 급여 총합
 */
export function calculateTotalSalary(roles: FormRoleWithCount[]): number {
  return roles.reduce((sum, role) => {
    const salary = role.salary;
    if (salary && salary.type !== 'other' && salary.amount > 0) {
      return sum + salary.amount * role.count;
    }
    return sum;
  }, 0);
}

/**
 * 역할 총 인원 계산
 *
 * @param roles - 역할 배열
 * @returns 총 인원수
 */
export function calculateTotalCount(roles: FormRoleWithCount[]): number {
  return roles.reduce((sum, r) => sum + r.count, 0);
}
