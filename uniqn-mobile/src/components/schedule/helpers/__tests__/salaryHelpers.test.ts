import {
  getRoleSalaryFromProjection,
  formatSalaryDisplay,
  formatGroupSalaryDisplay,
} from '../salaryHelpers';
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

describe('formatGroupSalaryDisplay', () => {
  // 회귀 방어: 예전에는 공고 defaultSalary(시급 10,000원)를 그려, 매니저로 지원했는데
  // 남의 단가가 카드에 떴다.
  it('그룹에 담긴 역할의 단가를 쓴다 (공고 기본값이 아니라)', () => {
    expect(formatGroupSalaryDisplay(createProjection(), ['other'], ['매니저'])).toBe(
      '일급 ₩200,000'
    );
    expect(formatGroupSalaryDisplay(createProjection(), ['dealer'])).toBe('시급 ₩15,000');
  });

  it('역할마다 단가가 다르면 하나를 대표로 내세우지 않는다', () => {
    expect(
      formatGroupSalaryDisplay(createProjection(), ['dealer', 'other'], [undefined, '매니저'])
    ).toBe('역할별 상이');
  });

  it('역할이 여럿이어도 단가가 같으면 그 단가를 쓴다', () => {
    expect(formatGroupSalaryDisplay(createProjection(), ['dealer', 'dealer'])).toBe('시급 ₩15,000');
  });

  it('공고 정보나 역할이 없으면 null', () => {
    expect(formatGroupSalaryDisplay(undefined, ['dealer'])).toBeNull();
    expect(formatGroupSalaryDisplay(createProjection(), [])).toBeNull();
  });
});
