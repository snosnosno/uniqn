import { getRoleSalaryFromProjection, formatSalaryDisplay } from '../salaryHelpers';
import type { SchedulePostingProjection } from '@/types';
import type { SalaryInfo } from '@/utils/settlement';

const createProjection = (
  overrides: Partial<SchedulePostingProjection> = {}
): SchedulePostingProjection => ({
  ownerName: '고용주',
  settlement: {
    roles: [
      { role: 'dealer', count: 2, filled: 0, salary: { type: 'hourly', amount: 15000 } },
      {
        role: 'other',
        customRole: '매니저',
        count: 1,
        filled: 0,
        salary: { type: 'daily', amount: 200000 },
      },
    ],
    defaultSalary: { type: 'hourly', amount: 10000 },
  },
  ...overrides,
});

describe('getRoleSalaryFromProjection', () => {
  it('returns undefined when projection is missing', () => {
    expect(getRoleSalaryFromProjection(undefined, 'dealer')).toBeUndefined();
  });

  it('returns the role-specific salary from canonical settlement data', () => {
    expect(getRoleSalaryFromProjection(createProjection(), 'dealer')).toEqual({
      type: 'hourly',
      amount: 15000,
    });
  });

  it('matches custom roles via customRole', () => {
    expect(getRoleSalaryFromProjection(createProjection(), 'other', '매니저')).toEqual({
      type: 'daily',
      amount: 200000,
    });
  });

  it('falls back to defaultSalary when no role-specific salary exists', () => {
    expect(
      getRoleSalaryFromProjection(
        createProjection({
          settlement: {
            roles: [],
            defaultSalary: { type: 'hourly', amount: 10000 },
          },
        }),
        'dealer'
      )
    ).toEqual({ type: 'hourly', amount: 10000 });
  });
});

describe('formatSalaryDisplay', () => {
  it('returns null for undefined salary', () => {
    expect(formatSalaryDisplay(undefined)).toBeNull();
  });

  it('formats hourly salary', () => {
    expect(formatSalaryDisplay({ type: 'hourly', amount: 15000 })).toBe('시급 ₩15,000');
  });

  it('formats daily salary', () => {
    expect(formatSalaryDisplay({ type: 'daily', amount: 150000 })).toBe('일급 ₩150,000');
  });

  it('formats monthly salary', () => {
    expect(formatSalaryDisplay({ type: 'monthly', amount: 3000000 })).toBe('월급 ₩3,000,000');
  });

  it('returns "협의" for other type', () => {
    expect(formatSalaryDisplay({ type: 'other', amount: 0 })).toBe('협의');
  });

  it('accepts large amounts', () => {
    const salary: SalaryInfo = { type: 'monthly', amount: 10000000 };
    expect(formatSalaryDisplay(salary)).toBe('월급 ₩10,000,000');
  });
});
