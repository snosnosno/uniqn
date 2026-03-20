import { isReviewerType, resolveReviewerType, resolveReviewerTypeFromRole } from '../reviewerType';

describe('reviewerType helpers', () => {
  it('treats admin as an employer-side reviewer', () => {
    expect(resolveReviewerTypeFromRole('admin')).toBe('employer');
    expect(resolveReviewerTypeFromRole('employer')).toBe('employer');
    expect(resolveReviewerTypeFromRole('staff')).toBe('staff');
  });

  it('prefers a valid route reviewer type over the role fallback', () => {
    expect(resolveReviewerType('staff', 'admin')).toBe('staff');
    expect(resolveReviewerType('employer', 'staff')).toBe('employer');
  });

  it('falls back to the role-derived reviewer type when the route value is invalid', () => {
    expect(isReviewerType('manager')).toBe(false);
    expect(resolveReviewerType('manager', 'admin')).toBe('employer');
    expect(resolveReviewerType(undefined, 'staff')).toBe('staff');
  });
});
