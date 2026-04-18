import { getReviewDaysRemaining, isWithinReviewDeadline } from '../reviewDeadline';

describe('reviewDeadline', () => {
  const now = new Date('2025-01-10T12:00:00.000Z').getTime();

  it('handles checkout time as epoch milliseconds (post-schema 정규화)', () => {
    // Task 4 이후: timestampSchema는 ISO string/number를 받음. Firebase seconds → ms 변환은 스키마 쪽에서 담당.
    const checkOutMs = 1736251200 * 1000; // 1736251200초 → ms
    const checkOutIso = new Date(checkOutMs).toISOString();

    expect(isWithinReviewDeadline(checkOutIso, '2025-01-07', now)).toBe(true);
    expect(getReviewDaysRemaining(checkOutIso, '2025-01-07', now)).toBeGreaterThan(0);
  });

  it('does not throw on malformed checkout times', () => {
    const malformed = 'invalid-date';

    expect(() => isWithinReviewDeadline(malformed, 'invalid-date', now)).not.toThrow();
    expect(() => getReviewDaysRemaining(malformed, 'invalid-date', now)).not.toThrow();
    expect(isWithinReviewDeadline(malformed, 'invalid-date', now)).toBe(false);
    expect(getReviewDaysRemaining(malformed, 'invalid-date', now)).toBe(0);
  });
});
