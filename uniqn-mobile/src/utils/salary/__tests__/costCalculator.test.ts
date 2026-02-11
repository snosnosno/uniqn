/**
 * costCalculator 테스트
 *
 * @description 급여 비용 계산 유틸리티 테스트
 * - formatCurrency: 숫자 → 통화 포맷
 * - parseCurrency: 통화 문자열 → 숫자
 * - calculateEstimatedCost: 1일 기준 예상 비용
 * - calculateTotalSalary: 급여 총합 (시간 환산 없이)
 * - calculateTotalCount: 역할 총 인원
 */

import {
  formatCurrency,
  parseCurrency,
  calculateEstimatedCost,
  calculateTotalSalary,
  calculateTotalCount,
} from '../costCalculator';
import type { FormRoleWithCount } from '@/types';

// ============================================================================
// formatCurrency
// ============================================================================

describe('formatCurrency', () => {
  it('1000 단위로 쉼표를 추가한다', () => {
    expect(formatCurrency(15000)).toBe('15,000');
  });

  it('0을 포맷한다', () => {
    expect(formatCurrency(0)).toBe('0');
  });

  it('큰 숫자를 올바르게 포맷한다', () => {
    expect(formatCurrency(1234567890)).toBe('1,234,567,890');
  });

  it('1000 미만 숫자는 쉼표 없이 반환한다', () => {
    expect(formatCurrency(999)).toBe('999');
  });

  it('음수도 포맷한다', () => {
    const result = formatCurrency(-15000);
    expect(result).toBe('-15,000');
  });
});

// ============================================================================
// parseCurrency
// ============================================================================

describe('parseCurrency', () => {
  it('쉼표가 포함된 문자열을 파싱한다', () => {
    expect(parseCurrency('15,000')).toBe(15000);
  });

  it('원화 기호가 포함된 문자열을 파싱한다', () => {
    expect(parseCurrency('15,000원')).toBe(15000);
  });

  it('숫자만 있는 문자열을 파싱한다', () => {
    expect(parseCurrency('12345')).toBe(12345);
  });

  it('문자만 있으면 0을 반환한다', () => {
    expect(parseCurrency('abc')).toBe(0);
  });

  it('빈 문자열이면 0을 반환한다', () => {
    expect(parseCurrency('')).toBe(0);
  });

  it('공백 문자열이면 0을 반환한다', () => {
    expect(parseCurrency('   ')).toBe(0);
  });

  it('혼합 문자열에서 숫자만 추출한다', () => {
    expect(parseCurrency('약 150,000원 정도')).toBe(150000);
  });
});

// ============================================================================
// calculateEstimatedCost
// ============================================================================

describe('calculateEstimatedCost', () => {
  it('시급 역할: 급여 x 인원 x 8시간으로 계산한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 15000 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(15000 * 2 * 8);
  });

  it('일급 역할: 급여 x 인원으로 계산한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '서빙', count: 1, salary: { type: 'daily', amount: 100000 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(100000);
  });

  it('월급 역할: 급여 x 인원으로 계산한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '매니저', count: 1, salary: { type: 'monthly', amount: 3000000 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(3000000);
  });

  it('협의(other) 타입은 계산에서 제외한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 15000 } },
      { name: '기타', count: 1, salary: { type: 'other', amount: 0 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(15000 * 2 * 8);
  });

  it('여러 역할의 비용을 합산한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 15000 } },
      { name: '서빙', count: 1, salary: { type: 'daily', amount: 100000 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(15000 * 2 * 8 + 100000);
  });

  it('급여가 없는 역할은 무시한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2 },
    ];
    expect(calculateEstimatedCost(roles)).toBe(null);
  });

  it('모든 역할이 협의(other) 타입이면 null을 반환한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '기타', count: 1, salary: { type: 'other', amount: 0 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(null);
  });

  it('빈 배열이면 null을 반환한다', () => {
    expect(calculateEstimatedCost([])).toBe(null);
  });

  it('amount가 0인 역할은 무시한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 0 } },
    ];
    expect(calculateEstimatedCost(roles)).toBe(null);
  });
});

// ============================================================================
// calculateTotalSalary
// ============================================================================

describe('calculateTotalSalary', () => {
  it('급여 x 인원의 총합을 반환한다 (시간 환산 없이)', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 15000 } },
      { name: '서빙', count: 1, salary: { type: 'daily', amount: 100000 } },
    ];
    expect(calculateTotalSalary(roles)).toBe(15000 * 2 + 100000);
  });

  it('협의(other) 타입은 제외한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 1, salary: { type: 'hourly', amount: 10000 } },
      { name: '기타', count: 1, salary: { type: 'other', amount: 0 } },
    ];
    expect(calculateTotalSalary(roles)).toBe(10000);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculateTotalSalary([])).toBe(0);
  });

  it('salary가 없는 역할은 무시한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2 },
    ];
    expect(calculateTotalSalary(roles)).toBe(0);
  });

  it('amount가 0인 역할은 무시한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 2, salary: { type: 'hourly', amount: 0 } },
    ];
    expect(calculateTotalSalary(roles)).toBe(0);
  });
});

// ============================================================================
// calculateTotalCount
// ============================================================================

describe('calculateTotalCount', () => {
  it('모든 역할의 인원 합계를 반환한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 3 },
      { name: '서빙', count: 2 },
      { name: '매니저', count: 1 },
    ];
    expect(calculateTotalCount(roles)).toBe(6);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculateTotalCount([])).toBe(0);
  });

  it('단일 역할의 인원을 반환한다', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 5 },
    ];
    expect(calculateTotalCount(roles)).toBe(5);
  });
});
