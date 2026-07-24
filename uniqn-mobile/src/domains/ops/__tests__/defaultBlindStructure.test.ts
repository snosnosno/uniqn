import { DEFAULT_BLIND_LEVELS } from '../defaultBlindStructure';

describe('DEFAULT_BLIND_LEVELS', () => {
  it('정확히 30레벨', () => {
    expect(DEFAULT_BLIND_LEVELS).toHaveLength(30);
  });

  it('level 1..30 연속', () => {
    DEFAULT_BLIND_LEVELS.forEach((lv, i) => expect(lv.level).toBe(i + 1));
  });

  it('사용자 확정 앞 3레벨(ante=BB)', () => {
    expect(DEFAULT_BLIND_LEVELS[0]).toMatchObject({ smallBlind: 100, bigBlind: 200, ante: 200 });
    expect(DEFAULT_BLIND_LEVELS[1]).toMatchObject({ smallBlind: 200, bigBlind: 300, ante: 300 });
    expect(DEFAULT_BLIND_LEVELS[2]).toMatchObject({ smallBlind: 200, bigBlind: 400, ante: 400 });
  });

  it('마지막 레벨 100K/200K', () => {
    expect(DEFAULT_BLIND_LEVELS[29]).toMatchObject({
      smallBlind: 100000,
      bigBlind: 200000,
      ante: 200000,
    });
  });

  it('전 레벨 ante=BB · 20분 · 브레이크 아님(B1)', () => {
    DEFAULT_BLIND_LEVELS.forEach((lv) => {
      expect(lv.ante).toBe(lv.bigBlind);
      expect(lv.durationSec).toBe(1200);
      expect(lv.isBreak).toBe(false);
    });
  });

  it('BB 단조 증가', () => {
    for (let i = 1; i < DEFAULT_BLIND_LEVELS.length; i++) {
      expect(DEFAULT_BLIND_LEVELS[i].bigBlind).toBeGreaterThan(
        DEFAULT_BLIND_LEVELS[i - 1].bigBlind
      );
    }
  });
});
