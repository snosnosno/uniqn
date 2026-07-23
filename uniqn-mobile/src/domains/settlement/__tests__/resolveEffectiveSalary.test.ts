import { resolveEffectiveSalaryWithSource, getEffectiveSalaryInfoFromRoles } from '../helpers';

const roles = [
  { role: 'dealer', salary: { type: 'hourly' as const, amount: 20000 } },
  { role: 'other', customRole: '칩 러너', salary: { type: 'daily' as const, amount: 150000 } },
];
const override = { type: 'hourly' as const, amount: 30000 };

describe('resolveEffectiveSalaryWithSource', () => {
  it('1순위 — customSalaryInfo override', () => {
    const r = resolveEffectiveSalaryWithSource(
      { role: 'dealer', customSalaryInfo: override },
      roles
    );
    expect(r).toEqual({ salaryInfo: override, source: 'override' });
  });
  it('2순위 — 역할 단가표(커스텀은 customRole 단위)', () => {
    expect(resolveEffectiveSalaryWithSource({ role: 'dealer' }, roles).source).toBe('roleTable');
    expect(
      resolveEffectiveSalaryWithSource({ role: 'other', customRole: '칩 러너' }, roles)
    ).toEqual({ salaryInfo: { type: 'daily', amount: 150000 }, source: 'roleTable' });
  });
  it('3순위 — 미매칭/빈 표는 fallback', () => {
    expect(resolveEffectiveSalaryWithSource({ role: 'serving' }, roles).source).toBe('fallback');
    expect(resolveEffectiveSalaryWithSource({ role: 'dealer' }, []).source).toBe('fallback');
    expect(resolveEffectiveSalaryWithSource({}, roles).source).toBe('fallback');
  });
  it('기존 getEffectiveSalaryInfoFromRoles 와 salaryInfo 등가(전 케이스)', () => {
    const cases = [
      { role: 'dealer' },
      { role: 'other', customRole: '칩 러너' },
      { role: 'serving' },
      { role: 'dealer', customSalaryInfo: override },
      {},
    ];
    for (const wl of cases) {
      expect(resolveEffectiveSalaryWithSource(wl as never, roles).salaryInfo).toEqual(
        getEffectiveSalaryInfoFromRoles(wl as never, roles)
      );
    }
  });
  it('defaultSalary 파라미터 경로 — 미매칭은 그 값으로 fallback + 기존 헬퍼와 등가(T4)', () => {
    const defaultSalary = { type: 'hourly' as const, amount: 12000 };
    // 미매칭 역할: fallback 은 DEFAULT_SALARY_INFO 가 아니라 전달된 defaultSalary 여야 한다.
    const r = resolveEffectiveSalaryWithSource({ role: 'serving' }, roles, defaultSalary);
    expect(r).toEqual({ salaryInfo: defaultSalary, source: 'fallback' });
    // salaryInfo 는 defaultSalary 를 넘긴 기존 헬퍼와 전 케이스 등가.
    const cases = [{ role: 'serving' }, { role: 'dealer' }, {}];
    for (const wl of cases) {
      expect(
        resolveEffectiveSalaryWithSource(wl as never, roles, defaultSalary).salaryInfo
      ).toEqual(getEffectiveSalaryInfoFromRoles(wl as never, roles, defaultSalary));
    }
  });
});
