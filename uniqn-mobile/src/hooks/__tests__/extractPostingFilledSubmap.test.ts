import { extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';

/**
 * P1 회귀 방어: usePostingFilledCounts 는 전역맵(`${postingId}__${date}__${slot}__${role}`)을
 * 반환하는데, 모델 조회 키는 postingId 접두가 없는 `date__slot__role` 이다.
 * 전역맵을 그대로 넘기면 전건 미스 → 확정 인원 0/N (employer "내 공고" 카드 회귀).
 * 이 추출기가 접두를 제거해 두 키공간을 일치시킨다.
 */
describe('extractPostingFilledSubmap', () => {
  it('전역맵에서 해당 공고의 서브맵(postingId 접두 제거)만 추출한다', () => {
    const global = new Map<string, number>([
      ['jp-1__FIXED_SCHEDULE__19:00__dealer', 2],
      ['jp-1__2026-07-20__14:00__floor', 1],
      ['jp-2__FIXED_SCHEDULE__19:00__dealer', 5],
    ]);

    const sub = extractPostingFilledSubmap(global, 'jp-1');

    expect(sub).toBeDefined();
    // 모델 조회 키(접두 없음)로 매칭돼야 한다
    expect(sub!.get('FIXED_SCHEDULE__19:00__dealer')).toBe(2);
    expect(sub!.get('2026-07-20__14:00__floor')).toBe(1);
    // 다른 공고(jp-2) 키는 새지 않는다
    expect(sub!.size).toBe(2);
  });

  it('매칭되는 공고 키가 없으면 undefined', () => {
    const global = new Map<string, number>([['jp-2__x__y__z', 1]]);
    expect(extractPostingFilledSubmap(global, 'jp-1')).toBeUndefined();
  });

  it('빈 맵/undefined/빈 postingId 는 undefined', () => {
    expect(extractPostingFilledSubmap(undefined, 'jp-1')).toBeUndefined();
    expect(extractPostingFilledSubmap(new Map(), 'jp-1')).toBeUndefined();
    expect(
      extractPostingFilledSubmap(new Map<string, number>([['jp-1__a__b__c', 1]]), '')
    ).toBeUndefined();
  });
});
