/**
 * syncRoleSalaries — 역할별 급여 자동 프리필 순수 함수 (설계 §S2.3)
 *
 * 추가/제거/보존 3경로 + 시급 차등(딜러 2만/플로어 3만/기타 2만)·일/월급 균일.
 * 고아(사라진 역할) 엔트리는 제거하지 않고 잔류 — "직접 수정→역할 잠깐 제거→재추가" 시
 * 사용자 금액 침묵 리셋 방지(CEO-2/Eng-M3). 쓰기 경로는 toRoleCatalog가 timeSlots 기준
 * 전사라 고아는 무해.
 */
import { defaultAmountForRole, syncRoleSalaries, syncRoleSalariesForRoles } from '../roleSalaries';

const slot = (roles: { role: string; customRole?: string; count?: number }[]) => ({
  startTime: '19:00',
  roles: roles.map((r) => ({
    role: r.role as 'dealer' | 'floor' | 'serving' | 'manager' | 'staff' | 'other',
    ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
    count: r.count ?? 1,
  })),
});

describe('defaultAmountForRole', () => {
  it('시급은 역할 차등 — 딜러 20,000 / 플로어 30,000 / 그 외 20,000', () => {
    expect(defaultAmountForRole('dealer', 'hourly')).toBe(20000);
    expect(defaultAmountForRole('floor', 'hourly')).toBe(30000);
    expect(defaultAmountForRole('serving', 'hourly')).toBe(20000);
    expect(defaultAmountForRole('manager', 'hourly')).toBe(20000);
    expect(defaultAmountForRole('staff', 'hourly')).toBe(20000);
    expect(defaultAmountForRole('other', 'hourly')).toBe(20000);
  });
  it('일급/월급은 균일 — 200,000 / 2,500,000', () => {
    expect(defaultAmountForRole('dealer', 'daily')).toBe(200000);
    expect(defaultAmountForRole('floor', 'daily')).toBe(200000);
    expect(defaultAmountForRole('dealer', 'monthly')).toBe(2500000);
  });
  it('협의(other)는 금액 없음 — 0', () => {
    expect(defaultAmountForRole('dealer', 'other')).toBe(0);
  });
});

describe('syncRoleSalaries', () => {
  it('미커버 역할에 기본값 엔트리를 추가한다 (시급 차등)', () => {
    const result = syncRoleSalaries([slot([{ role: 'dealer' }, { role: 'floor' }])], [], 'hourly');
    expect(result).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
    ]);
  });

  it('기타(customRole)는 customRole 단위 키 + 기본값 20,000', () => {
    const result = syncRoleSalaries(
      [slot([{ role: 'other', customRole: '푸드러너' }])],
      [],
      'hourly'
    );
    expect(result).toEqual([
      { role: 'other', customRole: '푸드러너', salary: { type: 'hourly', amount: 20000 } },
    ]);
  });

  it('일급이면 균일 기본값 200,000', () => {
    const result = syncRoleSalaries([slot([{ role: 'dealer' }, { role: 'floor' }])], [], 'daily');
    expect(result.map((r) => r.salary)).toEqual([
      { type: 'daily', amount: 200000 },
      { type: 'daily', amount: 200000 },
    ]);
  });

  it('협의(other) 타입이면 amount 0 엔트리를 추가한다', () => {
    const result = syncRoleSalaries([slot([{ role: 'dealer' }])], [], 'other');
    expect(result).toEqual([{ role: 'dealer', salary: { type: 'other', amount: 0 } }]);
  });

  it('기존(사용자 수정) 엔트리 금액은 보존하고 미커버만 추가한다', () => {
    const existing = [
      { role: 'dealer' as const, salary: { type: 'hourly' as const, amount: 25000 } },
    ];
    const result = syncRoleSalaries(
      [slot([{ role: 'dealer' }, { role: 'floor' }])],
      existing,
      'hourly'
    );
    expect(result).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
    ]);
  });

  it('timeSlots에서 사라진 역할 엔트리는 제거하지 않고 잔류한다 (고아 잔류)', () => {
    const existing = [
      { role: 'dealer' as const, salary: { type: 'hourly' as const, amount: 25000 } },
      { role: 'serving' as const, salary: { type: 'hourly' as const, amount: 21000 } },
    ];
    const result = syncRoleSalaries([slot([{ role: 'dealer' }])], existing, 'hourly');
    expect(result).toEqual(existing);
  });

  it('customRole 리네임은 구 엔트리 잔류 + 신 키 기본값 (금액 소실 아님)', () => {
    const existing = [
      {
        role: 'other' as const,
        customRole: '칩카운터',
        salary: { type: 'hourly' as const, amount: 22000 },
      },
    ];
    const result = syncRoleSalaries(
      [slot([{ role: 'other', customRole: '칩러너' }])],
      existing,
      'hourly'
    );
    expect(result).toEqual([
      { role: 'other', customRole: '칩카운터', salary: { type: 'hourly', amount: 22000 } },
      { role: 'other', customRole: '칩러너', salary: { type: 'hourly', amount: 20000 } },
    ]);
  });

  it('입력 배열을 변이하지 않는다 (불변성)', () => {
    const existing = [
      { role: 'dealer' as const, salary: { type: 'hourly' as const, amount: 25000 } },
    ];
    const snapshot = JSON.parse(JSON.stringify(existing));
    syncRoleSalaries([slot([{ role: 'dealer' }, { role: 'floor' }])], existing, 'hourly');
    expect(existing).toEqual(snapshot);
  });
});

describe('syncRoleSalariesForRoles (SalarySheet 오픈 시드용)', () => {
  it('고유 역할 목록 기준으로 미커버 기본값을 시드한다', () => {
    const result = syncRoleSalariesForRoles(
      [{ role: 'dealer' }, { role: 'floor' }],
      [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
      'hourly'
    );
    expect(result).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
    ]);
  });
});
