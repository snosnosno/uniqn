import { chatPostingBadge } from '../postingBadge';

describe('chatPostingBadge', () => {
  it.each([['active'], ['approved']])('%s → 배지 없음', (status) => {
    expect(chatPostingBadge(status, true)).toBeNull();
  });

  it('마감·정원 마감', () => {
    expect(chatPostingBadge('closed', true)?.label).toBe('마감');
    expect(chatPostingBadge('capacity_full', true)?.label).toBe('정원 마감');
  });

  it.each([['cancelled'], ['expired'], [null]])('%p → 종료된 공고(D-g)', (status) => {
    expect(chatPostingBadge(status, true)).toEqual({ label: '종료된 공고', tone: 'warning' });
  });

  it('상태를 아직 모르면(목록 캐시 없음) 배지를 달지 않는다', () => {
    expect(chatPostingBadge(undefined, false)).toBeNull();
  });
});
