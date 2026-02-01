/**
 * SettlementCalculator 테스트
 *
 * @description Phase 6 - 정산 계산기 통합
 * 정산 계산, 세금 계산, 캐싱 로직 테스트
 */

import { SettlementCalculator } from '../settlement/SettlementCalculator';
import { TaxCalculator } from '../settlement/TaxCalculator';
import { SettlementCache } from '../settlement/SettlementCache';
import type { SalaryInfo, Allowances, TaxSettings } from '@/utils/settlement';

// ============================================================================
// Test Helpers
// ============================================================================

function createDate(hours: number, minutes = 0): Date {
  const date = new Date('2025-01-20');
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function createMockTimestamp(date: Date) {
  const seconds = Math.floor(date.getTime() / 1000);
  return {
    toDate: () => date,
    seconds,
    nanoseconds: 0,
    toMillis: () => date.getTime(),
    isEqual: () => false,
    valueOf: () => '',
    toJSON: () => ({ seconds, nanoseconds: 0, type: 'timestamp' }),
  };
}

// ============================================================================
// TaxCalculator Tests
// ============================================================================

describe('TaxCalculator', () => {
  describe('calculate', () => {
    it('세금 없음 (none)', () => {
      const result = TaxCalculator.calculate(100000, { type: 'none', value: 0 });
      expect(result.taxAmount).toBe(0);
      expect(result.taxType).toBe('none');
    });

    it('고정 세금 (fixed)', () => {
      const result = TaxCalculator.calculate(100000, { type: 'fixed', value: 3000 });
      expect(result.taxAmount).toBe(3000);
      expect(result.taxType).toBe('fixed');
    });

    it('비율 세금 (rate) - 3.3%', () => {
      const result = TaxCalculator.calculate(100000, { type: 'rate', value: 3.3 });
      expect(result.taxAmount).toBe(3300);
      expect(result.taxRate).toBe(3.3);
      expect(result.taxType).toBe('rate');
    });

    it('비율 세금 소수점 반올림', () => {
      const result = TaxCalculator.calculate(100000, { type: 'rate', value: 3.33 });
      // 100000 * 3.33% = 3330
      expect(result.taxAmount).toBe(3330);
    });
  });

  describe('calculateByItems', () => {
    it('기본급만 세금 적용', () => {
      const settings: TaxSettings = {
        type: 'rate',
        value: 10,
        taxableItems: {
          basePay: true,
          meal: false,
          transportation: false,
        },
      };
      const result = TaxCalculator.calculateByItems(
        100000,
        { basePay: 100000, meal: 10000, transportation: 5000 },
        settings
      );
      // 기본급 100000 * 10% = 10000
      expect(result.taxAmount).toBe(10000);
    });

    it('전체 항목에 세금 적용 (기본)', () => {
      const settings: TaxSettings = {
        type: 'rate',
        value: 10,
      };
      const result = TaxCalculator.calculateByItems(
        115000,
        { basePay: 100000, meal: 10000, transportation: 5000 },
        settings
      );
      // 전체 115000 * 10% = 11500
      expect(result.taxAmount).toBe(11500);
    });

    it('PROVIDED_FLAG(-1) 항목은 세금 대상에서 제외', () => {
      const settings: TaxSettings = {
        type: 'rate',
        value: 10,
      };
      const result = TaxCalculator.calculateByItems(
        100000, // basePay only
        { basePay: 100000, meal: -1, transportation: -1 },
        settings
      );
      // 기본급만 적용: 100000 * 10% = 10000
      expect(result.taxAmount).toBe(10000);
    });
  });
});

// ============================================================================
// SettlementCalculator Tests
// ============================================================================

describe('SettlementCalculator', () => {
  describe('calculateHours', () => {
    it('8시간 근무 계산', () => {
      const start = createDate(9, 0); // 09:00
      const end = createDate(18, 0); // 18:00 (9시간이지만 휴게시간 제외 시 8시간)
      const hours = SettlementCalculator.calculateHours(start, end);
      expect(hours).toBe(9); // 실제 9시간 (휴게시간 별도 처리 없음)
    });

    it('Firebase Timestamp 형식 지원', () => {
      const start = createMockTimestamp(createDate(9, 0));
      const end = createMockTimestamp(createDate(17, 0));
      const hours = SettlementCalculator.calculateHours(start, end);
      expect(hours).toBe(8);
    });

    it('문자열 형식 지원', () => {
      const start = '2025-01-20T09:00:00';
      const end = '2025-01-20T17:00:00';
      const hours = SettlementCalculator.calculateHours(start, end);
      expect(hours).toBe(8);
    });

    it('null 입력 시 0 반환', () => {
      expect(SettlementCalculator.calculateHours(null, null)).toBe(0);
      expect(SettlementCalculator.calculateHours(createDate(9), null)).toBe(0);
      expect(SettlementCalculator.calculateHours(null, createDate(17))).toBe(0);
    });

    it('30분 단위 근무시간', () => {
      const start = createDate(9, 0);
      const end = createDate(13, 30); // 4시간 30분
      const hours = SettlementCalculator.calculateHours(start, end);
      expect(hours).toBe(4.5);
    });
  });

  describe('calculateBasePay', () => {
    it('시급 계산', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: 15000 };
      const pay = SettlementCalculator.calculateBasePay(salary, 8);
      expect(pay).toBe(120000); // 15000 * 8
    });

    it('일급 계산 (출근 시 전액)', () => {
      const salary: SalaryInfo = { type: 'daily', amount: 150000 };
      const pay = SettlementCalculator.calculateBasePay(salary, 5); // 시간 무관
      expect(pay).toBe(150000);
    });

    it('월급 계산 (출근 시 전액)', () => {
      const salary: SalaryInfo = { type: 'monthly', amount: 3000000 };
      const pay = SettlementCalculator.calculateBasePay(salary, 8);
      expect(pay).toBe(3000000);
    });

    it('시급 소수점 반올림', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: 15000 };
      const pay = SettlementCalculator.calculateBasePay(salary, 4.5);
      expect(pay).toBe(67500); // 15000 * 4.5 = 67500
    });

    it('근무시간 0이면 급여 0', () => {
      const salary: SalaryInfo = { type: 'hourly', amount: 15000 };
      expect(SettlementCalculator.calculateBasePay(salary, 0)).toBe(0);
    });
  });

  describe('calculateAllowances', () => {
    it('수당 합산', () => {
      const allowances: Allowances = {
        meal: 10000,
        transportation: 5000,
        accommodation: 50000,
      };
      const total = SettlementCalculator.calculateAllowances(allowances);
      expect(total).toBe(65000);
    });

    it('PROVIDED_FLAG(-1)는 금액에 포함 안 함', () => {
      const allowances: Allowances = {
        meal: -1, // 제공
        transportation: 5000,
        accommodation: -1, // 제공
      };
      const total = SettlementCalculator.calculateAllowances(allowances);
      expect(total).toBe(5000);
    });

    it('수당 없으면 0', () => {
      expect(SettlementCalculator.calculateAllowances(undefined)).toBe(0);
      expect(SettlementCalculator.calculateAllowances({})).toBe(0);
    });

    it('추가 수당 포함', () => {
      const allowances: Allowances = {
        meal: 10000,
        additional: 20000,
      };
      const total = SettlementCalculator.calculateAllowances(allowances);
      expect(total).toBe(30000);
    });
  });

  describe('calculate', () => {
    it('기본 정산 계산 (시급)', () => {
      const result = SettlementCalculator.calculate({
        startTime: createDate(9, 0),
        endTime: createDate(17, 0),
        salaryInfo: { type: 'hourly', amount: 15000 },
      });

      expect(result.hoursWorked).toBe(8);
      expect(result.basePay).toBe(120000);
      expect(result.allowancePay).toBe(0);
      expect(result.totalPay).toBe(120000);
    });

    it('수당 포함 정산 계산', () => {
      const result = SettlementCalculator.calculate({
        startTime: createDate(9, 0),
        endTime: createDate(17, 0),
        salaryInfo: { type: 'hourly', amount: 15000 },
        allowances: { meal: 10000, transportation: 5000 },
      });

      expect(result.basePay).toBe(120000);
      expect(result.allowancePay).toBe(15000);
      expect(result.totalPay).toBe(135000);
    });

    it('세금 포함 정산 계산', () => {
      const result = SettlementCalculator.calculate({
        startTime: createDate(9, 0),
        endTime: createDate(17, 0),
        salaryInfo: { type: 'hourly', amount: 15000 },
        taxSettings: { type: 'rate', value: 3.3 },
      });

      expect(result.totalPay).toBe(120000);
      expect(result.taxAmount).toBe(3960); // 120000 * 3.3%
      expect(result.afterTaxPay).toBe(116040);
    });

    it('시간 정보 없으면 0 반환', () => {
      const result = SettlementCalculator.calculate({
        startTime: null,
        endTime: null,
        salaryInfo: { type: 'hourly', amount: 15000 },
      });

      expect(result.hoursWorked).toBe(0);
      expect(result.totalPay).toBe(0);
    });
  });

  describe('calculateTotal', () => {
    it('여러 근무 기록 합산 (세전)', () => {
      const inputs = [
        {
          startTime: createDate(9, 0),
          endTime: createDate(17, 0),
          salaryInfo: { type: 'hourly' as const, amount: 15000 },
        },
        {
          startTime: createDate(9, 0),
          endTime: createDate(13, 0),
          salaryInfo: { type: 'hourly' as const, amount: 15000 },
        },
      ];

      const total = SettlementCalculator.calculateTotal(inputs);
      expect(total).toBe(180000); // 120000 + 60000
    });

    it('여러 근무 기록 합산 (세후)', () => {
      const inputs = [
        {
          startTime: createDate(9, 0),
          endTime: createDate(17, 0),
          salaryInfo: { type: 'hourly' as const, amount: 15000 },
          taxSettings: { type: 'rate' as const, value: 10 },
        },
        {
          startTime: createDate(9, 0),
          endTime: createDate(13, 0),
          salaryInfo: { type: 'hourly' as const, amount: 15000 },
          taxSettings: { type: 'rate' as const, value: 10 },
        },
      ];

      const total = SettlementCalculator.calculateTotal(inputs, true);
      // 120000 * 0.9 = 108000, 60000 * 0.9 = 54000 -> 162000
      expect(total).toBe(162000);
    });

    it('빈 배열이면 0', () => {
      expect(SettlementCalculator.calculateTotal([])).toBe(0);
    });
  });

  describe('getSalaryForRole', () => {
    const mockJobPosting = {
      useSameSalary: false,
      defaultSalary: { type: 'hourly' as const, amount: 15000 },
      dateRequirements: [
        {
          timeSlots: [
            {
              roles: [
                { role: 'dealer', salary: { type: 'hourly' as const, amount: 20000 } },
                { role: 'floor', salary: { type: 'hourly' as const, amount: 18000 } },
                {
                  role: 'other',
                  customRole: '조명',
                  salary: { type: 'hourly' as const, amount: 25000 },
                },
              ],
            },
          ],
        },
      ],
    };

    it('역할별 급여 조회', () => {
      const salary = SettlementCalculator.getSalaryForRole(
        'dealer',
        undefined,
        mockJobPosting as never
      );
      expect(salary.amount).toBe(20000);
    });

    it('커스텀 역할 급여 조회', () => {
      const salary = SettlementCalculator.getSalaryForRole(
        'other',
        '조명',
        mockJobPosting as never
      );
      expect(salary.amount).toBe(25000);
    });

    it('역할 없으면 defaultSalary 반환', () => {
      const salary = SettlementCalculator.getSalaryForRole(
        'unknown',
        undefined,
        mockJobPosting as never
      );
      expect(salary.amount).toBe(15000);
    });

    it('useSameSalary=true면 defaultSalary 사용', () => {
      const posting = {
        ...mockJobPosting,
        useSameSalary: true,
        defaultSalary: { type: 'daily' as const, amount: 200000 },
      };
      const salary = SettlementCalculator.getSalaryForRole('dealer', undefined, posting as never);
      expect(salary.amount).toBe(200000);
    });
  });
});

// ============================================================================
// SettlementCache Tests
// ============================================================================

describe('SettlementCache', () => {
  beforeEach(() => {
    SettlementCache.clear();
  });

  describe('set / get', () => {
    it('캐시 저장 및 조회', () => {
      const breakdown = {
        hoursWorked: 8,
        basePay: 120000,
        allowancePay: 0,
        totalPay: 120000,
        taxAmount: 0,
        afterTaxPay: 120000,
      };

      SettlementCache.set('workLog1', breakdown, 'hash1');
      const cached = SettlementCache.get('workLog1');

      expect(cached).not.toBeNull();
      expect(cached?.basePay).toBe(120000);
    });

    it('존재하지 않는 키 조회 시 null', () => {
      const cached = SettlementCache.get('nonexistent');
      expect(cached).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('단일 키 무효화', () => {
      const breakdown = {
        hoursWorked: 8,
        basePay: 120000,
        allowancePay: 0,
        totalPay: 120000,
        taxAmount: 0,
        afterTaxPay: 120000,
      };
      SettlementCache.set('workLog1', breakdown, 'hash1');

      SettlementCache.invalidate('workLog1');

      expect(SettlementCache.get('workLog1')).toBeNull();
    });

    it('clear()로 전체 무효화', () => {
      const breakdown = {
        hoursWorked: 8,
        basePay: 120000,
        allowancePay: 0,
        totalPay: 120000,
        taxAmount: 0,
        afterTaxPay: 120000,
      };
      SettlementCache.set('workLog1', breakdown, 'hash1');
      SettlementCache.set('workLog2', breakdown, 'hash2');

      SettlementCache.clear();

      expect(SettlementCache.get('workLog1')).toBeNull();
      expect(SettlementCache.get('workLog2')).toBeNull();
    });
  });

  describe('isStale', () => {
    it('inputHash가 다르면 stale', () => {
      const breakdown = {
        hoursWorked: 8,
        basePay: 120000,
        allowancePay: 0,
        totalPay: 120000,
        taxAmount: 0,
        afterTaxPay: 120000,
      };
      SettlementCache.set('workLog1', breakdown, 'hash1');

      expect(SettlementCache.isStale('workLog1', 'hash2')).toBe(true);
    });

    it('inputHash가 같으면 fresh', () => {
      const breakdown = {
        hoursWorked: 8,
        basePay: 120000,
        allowancePay: 0,
        totalPay: 120000,
        taxAmount: 0,
        afterTaxPay: 120000,
      };
      SettlementCache.set('workLog1', breakdown, 'hash1');

      expect(SettlementCache.isStale('workLog1', 'hash1')).toBe(false);
    });

    it('캐시에 없으면 stale', () => {
      expect(SettlementCache.isStale('nonexistent', 'hash1')).toBe(true);
    });
  });

  describe('generateKey', () => {
    it('workLogId로 키 생성', () => {
      const key = SettlementCache.generateKey('workLog1');
      expect(key).toBe('workLog1');
    });

    it('오버라이드 포함 시 해시 추가', () => {
      const key = SettlementCache.generateKey('workLog1', { customAmount: 10000 });
      expect(key).toContain('workLog1');
      expect(key.length).toBeGreaterThan('workLog1'.length);
    });
  });
});

// ============================================================================
// Integration Tests (기존 함수와 결과 비교)
// ============================================================================

describe('Integration: 기존 utils/settlement와 결과 일치', () => {
  it('기본 정산 계산 결과 일치', () => {
    // 새 SettlementCalculator
    const newResult = SettlementCalculator.calculate({
      startTime: createDate(9, 0),
      endTime: createDate(17, 0),
      salaryInfo: { type: 'hourly', amount: 15000 },
      allowances: { meal: 10000, transportation: 5000 },
      taxSettings: { type: 'rate', value: 3.3 },
    });

    // 예상 값 (기존 calculateSettlementWithTax와 동일해야 함)
    // hoursWorked: 8
    // basePay: 120000
    // allowancePay: 15000
    // totalPay: 135000
    // taxAmount: 135000 * 3.3% = 4455
    // afterTaxPay: 135000 - 4455 = 130545

    expect(newResult.hoursWorked).toBe(8);
    expect(newResult.basePay).toBe(120000);
    expect(newResult.allowancePay).toBe(15000);
    expect(newResult.totalPay).toBe(135000);
    expect(newResult.taxAmount).toBe(4455);
    expect(newResult.afterTaxPay).toBe(130545);
  });

  it('일급 정산 계산 결과 일치', () => {
    const newResult = SettlementCalculator.calculate({
      startTime: createDate(9, 0),
      endTime: createDate(14, 0), // 5시간만 일해도
      salaryInfo: { type: 'daily', amount: 150000 },
    });

    // 일급은 출근하면 전액
    expect(newResult.basePay).toBe(150000);
    expect(newResult.totalPay).toBe(150000);
  });

  it('PROVIDED_FLAG 수당 처리 일치', () => {
    const newResult = SettlementCalculator.calculate({
      startTime: createDate(9, 0),
      endTime: createDate(17, 0),
      salaryInfo: { type: 'hourly', amount: 15000 },
      allowances: { meal: -1, transportation: 5000 }, // meal은 제공
    });

    // meal(-1)은 금액에 포함 안 됨
    expect(newResult.allowancePay).toBe(5000);
    expect(newResult.totalPay).toBe(125000); // 120000 + 5000
  });
});
