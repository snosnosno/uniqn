import { describeFixedExpiry, FIXED_EXPIRY_SOON_HOURS } from '@/domains/job-posting/fixedExpiry';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-27T05:00:00.000Z');

describe('describeFixedExpiry', () => {
  it('만료 시각이 없거나 잘못되면 null', () => {
    expect(describeFixedExpiry(undefined, NOW)).toBeNull();
    expect(describeFixedExpiry('not-a-date', NOW)).toBeNull();
  });

  it(`${FIXED_EXPIRY_SOON_HOURS}시간 안이면 임박`, () => {
    const soon = describeFixedExpiry(new Date(NOW.getTime() + 23 * HOUR).toISOString(), NOW);
    expect(soon).toMatchObject({ isExpired: false, isSoon: true, remainingDays: 1 });
  });

  it('24시간보다 많이 남으면 임박이 아니고, 남은 날은 올림', () => {
    const later = describeFixedExpiry(new Date(NOW.getTime() + 49 * HOUR).toISOString(), NOW);
    expect(later).toMatchObject({ isExpired: false, isSoon: false, remainingDays: 3 });
  });

  it('지났으면 만료', () => {
    const past = describeFixedExpiry(new Date(NOW.getTime() - HOUR).toISOString(), NOW);
    expect(past).toMatchObject({ isExpired: true, isSoon: false, remainingDays: 0 });
  });
});
