import { TimeNormalizer } from '../TimeNormalizer';

describe('TimeNormalizer.calculateDurationInHours 자정 보정', () => {
  it('같은 날 종료가 시작보다 이르면 +24h 보정한다', () => {
    const start = new Date(2026, 6, 17, 18, 0, 0); // 18:00
    const end = new Date(2026, 6, 17, 2, 0, 0); // 같은 날 02:00 (익일 미보정 Date)
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });

  it('정상 구간은 그대로 계산한다', () => {
    const start = new Date(2026, 6, 17, 9, 0, 0);
    const end = new Date(2026, 6, 17, 17, 0, 0);
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });

  it('이미 익일로 보정된 Date(다음날 02:00)도 8시간', () => {
    const start = new Date(2026, 6, 17, 18, 0, 0);
    const end = new Date(2026, 6, 18, 2, 0, 0);
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });
});
