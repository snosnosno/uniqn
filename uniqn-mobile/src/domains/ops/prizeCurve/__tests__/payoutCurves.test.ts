import { PAYOUT_CURVES, recommendPayoutCurve } from '../payoutCurves';

describe('PAYOUT_CURVES', () => {
  it('곡선표 10행 전부 합계 100 고정', () => {
    for (let itm = 1; itm <= 10; itm++) {
      const curve = PAYOUT_CURVES[itm];
      expect(curve).toHaveLength(itm);
      expect(curve.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    }
  });
});

describe('recommendPayoutCurve', () => {
  it('ITM = ceil(entries × ratio), cap 1~10', () => {
    expect(recommendPayoutCurve(30, 0.1)).toEqual(PAYOUT_CURVES[3]);
    expect(recommendPayoutCurve(101, 0.1)).toEqual(PAYOUT_CURVES[10]); // ceil(10.1)=11 → cap 10
    expect(recommendPayoutCurve(5, 0.2)).toEqual(PAYOUT_CURVES[1]);
  });
  it('entries 0/1 경계 → 최소 1', () => {
    expect(recommendPayoutCurve(0, 0.15)).toEqual(PAYOUT_CURVES[1]);
    expect(recommendPayoutCurve(1, 0.15)).toEqual(PAYOUT_CURVES[1]);
  });
  it('부동소수 함정: 20×0.15 는 JS 에서 3.0000000000000004 — ceil 이 4 가 되면 안 됨', () => {
    expect(recommendPayoutCurve(20, 0.15)).toEqual(PAYOUT_CURVES[3]);
  });
});
