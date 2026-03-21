import { getEffectiveRoleId, getRoleCheckboxKey } from '../utils';

describe('AssignmentSelector utils', () => {
  it('returns customName as the effective role id for custom roles', () => {
    expect(
      getEffectiveRoleId({
        roleId: 'other',
        customName: '사회자',
      })
    ).toBe('사회자');
  });

  it('builds distinct checkbox keys for multiple custom roles', () => {
    const firstKey = getRoleCheckboxKey(
      {
        roleId: 'other',
        customName: '사회자',
      },
      0
    );
    const secondKey = getRoleCheckboxKey(
      {
        roleId: 'other',
        customName: '조명담당',
      },
      1
    );

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain('사회자');
    expect(secondKey).toContain('조명담당');
  });
});
