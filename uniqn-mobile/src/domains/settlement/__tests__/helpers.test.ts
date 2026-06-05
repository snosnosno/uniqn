/**
 * settlement/helpers — 권위 함수(SettlementCalculator)와의 정합 회귀 테스트
 *
 * 2차 리뷰 적발: helpers.ts 의 calculatePayByType / calculateAllowanceAmount 가
 * SettlementCalculator.calculateBasePay / calculateAllowances 와 발산(음수가드 누락 /
 * additional 수당 미합산). 두 helpers 는 calculateSettlement 경유 라이브 정산 경로다.
 */
import {
  calculatePayByType,
  calculateAllowanceAmount,
  calculateSettlement,
} from '@/domains/settlement/helpers';
import { SettlementCalculator } from '@/domains/settlement/SettlementCalculator';
import type { SalaryInfo } from '@/types/jobPosting';

describe('settlement/helpers ↔ SettlementCalculator 정합', () => {
  describe('calculatePayByType: 음수 금액 방어', () => {
    it('시급이 음수면 0을 반환한다 (calculateBasePay 동치)', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: -15000 };
      expect(calculatePayByType(salary, 8)).toBe(0);
      expect(calculatePayByType(salary, 8)).toBe(SettlementCalculator.calculateBasePay(salary, 8));
    });

    it('일급/월급이 음수면 0을 반환한다', () => {
      expect(calculatePayByType({ type: 'daily', amount: -150000 }, 5)).toBe(0);
      expect(calculatePayByType({ type: 'monthly', amount: -3000000 }, 8)).toBe(0);
    });

    it('양수 금액은 기존대로 계산한다 (회귀 방지)', () => {
      expect(calculatePayByType({ type: 'hourly', amount: 15000 }, 8)).toBe(120000);
      expect(calculatePayByType({ type: 'daily', amount: 150000 }, 5)).toBe(150000);
    });
  });

  describe('calculateAllowanceAmount: additional 수당 합산', () => {
    it('additional 수당을 합계에 포함한다 (calculateAllowances 동치)', () => {
      expect(calculateAllowanceAmount({ additional: 3000 })).toBe(3000);
      expect(calculateAllowanceAmount({ additional: 3000 })).toBe(
        SettlementCalculator.calculateAllowances({ additional: 3000 })
      );
    });

    it('meal/transportation/accommodation + additional 을 모두 합산한다', () => {
      const allowances = {
        meal: 1000,
        transportation: 2000,
        accommodation: 3000,
        additional: 4000,
      };
      expect(calculateAllowanceAmount(allowances)).toBe(10000);
      expect(calculateAllowanceAmount(allowances)).toBe(
        SettlementCalculator.calculateAllowances(allowances)
      );
    });

    it('additional 이 0/음수면 합산하지 않는다 (회귀 방지)', () => {
      expect(calculateAllowanceAmount({ additional: 0 })).toBe(0);
      expect(calculateAllowanceAmount({ additional: -5000 })).toBe(0);
    });
  });

  describe('calculateSettlement: additional 수당이 totalPay 에 반영된다', () => {
    it('additional 수당이 있으면 totalPay 에 더해진다', () => {
      const result = calculateSettlement(
        '18:00',
        '20:00',
        { type: 'hourly', amount: 10000 },
        {
          additional: 5000,
        }
      );
      // basePay(2h * 10000 = 20000) + allowancePay(additional 5000) = 25000
      expect(result.allowancePay).toBe(5000);
      expect(result.totalPay).toBe(result.basePay + result.allowancePay);
      expect(result.totalPay).toBe(25000);
    });
  });
});
