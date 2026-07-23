/**
 * useVenueSettlement — monthToRange 월 경계 계산 테스트.
 * 손계산 금지 규칙에 따라 date-fns 로 산출한 경계를 검증한다(윤년 포함).
 */
import { monthToRange } from '../useVenueSettlement';

describe('monthToRange', () => {
  it('YYYY-MM 을 월 시작·끝(YYYY-MM-DD, inclusive)으로 변환한다', () => {
    expect(monthToRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    expect(monthToRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthToRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' }); // 윤년
  });
});
