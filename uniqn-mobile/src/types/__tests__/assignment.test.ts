import { createSimpleAssignment, normalizeAssignmentRole } from '../assignment';

describe('assignment utilities', () => {
  it('preserves custom role names in simple assignments', () => {
    const assignment = createSimpleAssignment('사회자', '18:00~22:00', '2025-01-10');

    expect(assignment.roleIds).toEqual(['사회자']);
  });

  it('normalizes custom role strings into other + customRole', () => {
    expect(normalizeAssignmentRole('사회자')).toEqual({
      role: 'other',
      customRole: '사회자',
    });
  });

  it('keeps standard roles unchanged when normalizing', () => {
    expect(normalizeAssignmentRole('dealer')).toEqual({
      role: 'dealer',
    });
  });
});
