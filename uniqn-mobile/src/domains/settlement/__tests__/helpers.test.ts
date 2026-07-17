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
  calculateSettlementWithTax,
  getRoleSalaryFromRoles,
} from '@/domains/settlement/helpers';
import { SettlementCalculator } from '@/domains/settlement/SettlementCalculator';
import type { TaxSettings } from '@/utils/settlement';
import type { SalaryInfo, JobPostingCard, PostingSalaryRow } from '@/types/jobPosting';

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

  describe('세금 등가성: 두 정산 경로가 동일 taxAmount 를 낸다 (taxCore 단일 경유)', () => {
    it('calculateSettlementWithTax(helpers) 와 SettlementCalculator.calculate 의 세금·합계가 동치', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: 10000 };
      const allowances = { meal: 10000, transportation: 5000, additional: 3000 };
      const taxSettings: TaxSettings = { type: 'rate', value: 3.3 };

      const helpersResult = calculateSettlementWithTax(
        '18:00',
        '22:00',
        salary,
        allowances,
        taxSettings
      );
      const calcResult = SettlementCalculator.calculate({
        startTime: '18:00',
        endTime: '22:00',
        salaryInfo: salary,
        allowances,
        taxSettings,
      });

      // 항목별 세율 과세가 taxCore(calculateItemizedRateTax)로 단일 경유 → 세금 동치(비-공허)
      expect(helpersResult.taxAmount).toBeGreaterThan(0);
      expect(helpersResult.taxAmount).toBe(calcResult.taxAmount);
      expect(helpersResult.basePay).toBe(calcResult.basePay);
      expect(helpersResult.totalPay).toBe(calcResult.totalPay);
      expect(helpersResult.afterTaxPay).toBe(calcResult.afterTaxPay);
    });

    it('고정 세금(fixed)도 두 경로가 동일 taxAmount 를 낸다', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: 10000 };
      const allowances = { meal: 10000 };
      const taxSettings: TaxSettings = { type: 'fixed', value: 7000 };

      const helpersResult = calculateSettlementWithTax(
        '18:00',
        '22:00',
        salary,
        allowances,
        taxSettings
      );
      const calcResult = SettlementCalculator.calculate({
        startTime: '18:00',
        endTime: '22:00',
        salaryInfo: salary,
        allowances,
        taxSettings,
      });

      expect(helpersResult.taxAmount).toBe(7000);
      expect(helpersResult.taxAmount).toBe(calcResult.taxAmount);
      expect(helpersResult.afterTaxPay).toBe(calcResult.afterTaxPay);
    });
  });

  describe('역할급여 조회: getSalaryForRole vs getRoleSalaryFromRoles 의 useSameSalary 발산 (현행 문서화)', () => {
    const roleSalary: SalaryInfo = { type: 'hourly', amount: 20000 };
    const defaultSalary: SalaryInfo = { type: 'hourly', amount: 12000 };
    const salaryRow: PostingSalaryRow = {
      key: 'dealer',
      role: 'dealer',
      roleLabel: '딜러',
      salary: roleSalary,
      text: '',
    };
    const buildCard = (useSameSalary: boolean): JobPostingCard =>
      ({
        useSameSalary,
        defaultSalary,
        salaryRows: [salaryRow],
        fullSalaryRows: [salaryRow],
      }) as unknown as JobPostingCard;

    it('useSameSalary=false 면 두 함수가 동일하게 역할별 급여를 반환한다 (동치 축)', () => {
      expect(SettlementCalculator.getSalaryForRole('dealer', undefined, buildCard(false))).toEqual(
        roleSalary
      );
      expect(
        getRoleSalaryFromRoles(
          [{ role: 'dealer', salary: roleSalary }],
          'dealer',
          undefined,
          defaultSalary
        )
      ).toEqual(roleSalary);
    });

    it('useSameSalary=true 면 getSalaryForRole 는 defaultSalary, getRoleSalaryFromRoles 는 역할별 급여로 갈라진다 (발산 축 — 미수렴 현행)', () => {
      // getSalaryForRole: useSameSalary=true → defaultSalary 로 단락(12000)
      expect(SettlementCalculator.getSalaryForRole('dealer', undefined, buildCard(true))).toEqual(
        defaultSalary
      );
      // getRoleSalaryFromRoles: useSameSalary 미고려 → 역할별 급여 유지(20000)
      expect(
        getRoleSalaryFromRoles(
          [{ role: 'dealer', salary: roleSalary }],
          'dealer',
          undefined,
          defaultSalary
        )
      ).toEqual(roleSalary);
      // 두 결과가 실제로 다르다(발산)는 것을 명시적으로 잠근다
      expect(
        SettlementCalculator.getSalaryForRole('dealer', undefined, buildCard(true))
      ).not.toEqual(
        getRoleSalaryFromRoles(
          [{ role: 'dealer', salary: roleSalary }],
          'dealer',
          undefined,
          defaultSalary
        )
      );
    });
  });
});
