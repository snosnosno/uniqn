import { resolvePrimaryApplicationRole } from '../applicationRoleUtils';

const customAssignment = {
  roleIds: ['사회자'],
  timeSlot: '18:00~22:00',
  dates: ['2025-01-10'],
  isGrouped: false,
};

const standardAssignment = {
  roleIds: ['dealer'],
  timeSlot: '18:00~22:00',
  dates: ['2025-01-10'],
  isGrouped: false,
};

describe('resolvePrimaryApplicationRole', () => {
  it('normalizes raw custom assignment roles into other + customRole', () => {
    const result = resolvePrimaryApplicationRole({
      assignments: [customAssignment],
      customRole: undefined,
      applicantRole: undefined,
    });

    expect(result).toEqual({
      role: 'other',
      customRole: '사회자',
    });
  });

  it('falls back to application customRole when assignments are missing', () => {
    const result = resolvePrimaryApplicationRole({
      assignments: [],
      customRole: '조명담당',
      applicantRole: 'other',
    });

    expect(result).toEqual({
      role: 'other',
      customRole: '조명담당',
    });
  });

  it('keeps standard staff roles unchanged', () => {
    const result = resolvePrimaryApplicationRole({
      assignments: [standardAssignment],
      customRole: undefined,
      applicantRole: undefined,
    });

    expect(result).toEqual({
      role: 'dealer',
    });
  });
});
