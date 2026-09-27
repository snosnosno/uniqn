import {
  buildExtendedFixedConfig,
  describeFixedExpiry,
  FIXED_EXPIRY_SOON_HOURS,
} from '@/domains/job-posting/fixedExpiry';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-27T05:00:00.000Z');

describe('buildExtendedFixedConfig — 연장·재오픈은 "지금부터 7일"', () => {
  it('만료 시각을 지금부터 7일 뒤로 다시 잡고 생성 시각은 보존한다', () => {
    const next = buildExtendedFixedConfig(
      {
        durationDays: 7,
        createdAt: '2026-09-01T00:00:00.000Z',
        expiresAt: '2026-09-08T00:00:00.000Z',
      },
      NOW
    );

    expect(next).toEqual({
      durationDays: 7,
      createdAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2026-10-04T05:00:00.000Z',
    });
  });

  it('아직 남은 기간을 쌓지 않는다 — 만료가 3일 남아도 지금부터 7일', () => {
    const next = buildExtendedFixedConfig(
      { createdAt: '2026-09-25T00:00:00.000Z', expiresAt: '2026-09-30T05:00:00.000Z' },
      NOW
    );

    expect(next.expiresAt).toBe('2026-10-04T05:00:00.000Z');
  });

  it('설정이 없던 레거시 행은 생성 시각을 지금으로 채운다', () => {
    expect(buildExtendedFixedConfig(undefined, NOW)).toEqual({
      durationDays: 7,
      createdAt: '2026-09-27T05:00:00.000Z',
      expiresAt: '2026-10-04T05:00:00.000Z',
    });
  });

  it('Date 객체로 들어온 생성 시각도 ISO 문자열로 직렬화한다(jsonb 저장 형식)', () => {
    const next = buildExtendedFixedConfig({ createdAt: new Date('2026-09-01T00:00:00.000Z') }, NOW);
    expect(next.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });
});

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
