import { getReviewDaysRemaining, isWithinReviewDeadline } from '../reviewDeadline';

describe('reviewDeadline', () => {
  const now = new Date('2025-01-10T12:00:00.000Z').getTime();

  it('handles serialized checkout timestamps', () => {
    const checkOutTime = { seconds: 1736251200, nanoseconds: 0 };

    expect(isWithinReviewDeadline(checkOutTime, '2025-01-07', now)).toBe(true);
    expect(getReviewDaysRemaining(checkOutTime, '2025-01-07', now)).toBeGreaterThan(0);
  });

  it('does not throw on malformed checkout times', () => {
    const malformed = { toDate: () => new Date('invalid-date') };

    expect(() => isWithinReviewDeadline(malformed, 'invalid-date', now)).not.toThrow();
    expect(() => getReviewDaysRemaining(malformed, 'invalid-date', now)).not.toThrow();
    expect(isWithinReviewDeadline(malformed, 'invalid-date', now)).toBe(false);
    expect(getReviewDaysRemaining(malformed, 'invalid-date', now)).toBe(0);
  });
});
