/**
 * slotSource — 근무표 사람 줄의 출처 판정 (구인자 IA S4)
 *
 * "공고는 근무표를 채우는 도구"가 화면에서 성립하려면 줄마다 어디서 왔는지 보여야 한다.
 * - 컨테이너 직속 배치(job_posting_id = 지점) → `직접 배치`
 * - 공고에서 확정 → `{공고 제목} 공고에서`
 * - 공고 제목을 못 읽었으면(다른 팀 공고·삭제·조회 실패) → `공고에서` — 제목을 지어내지 않는다.
 */
import { collectSourcePostingIds, resolveSlotSource, slotSourceLabel } from '../slotSource';

const titles = new Map<string, string>([
  ['jp-1', '토요일 딜러 4명'],
  ['jp-blank', '   '],
]);

describe('resolveSlotSource', () => {
  it('컨테이너 직속 배치는 직접 배치다', () => {
    expect(resolveSlotSource({ jobPostingId: 'venue-1', isContainer: true }, titles)).toEqual({
      kind: 'direct',
    });
  });

  it('공고에서 온 줄은 공고 id 와 제목을 싣는다', () => {
    expect(resolveSlotSource({ jobPostingId: 'jp-1', isContainer: false }, titles)).toEqual({
      kind: 'posting',
      jobPostingId: 'jp-1',
      title: '토요일 딜러 4명',
    });
  });

  it('제목을 모르면 null 로 둔다 — 비어 있는 제목도 모르는 것으로 본다', () => {
    expect(resolveSlotSource({ jobPostingId: 'jp-x', isContainer: false }, titles)).toEqual({
      kind: 'posting',
      jobPostingId: 'jp-x',
      title: null,
    });
    expect(resolveSlotSource({ jobPostingId: 'jp-blank', isContainer: false }, titles)).toEqual({
      kind: 'posting',
      jobPostingId: 'jp-blank',
      title: null,
    });
  });
});

describe('slotSourceLabel', () => {
  it('출처별 문구', () => {
    expect(slotSourceLabel({ kind: 'direct' })).toBe('직접 배치');
    expect(
      slotSourceLabel({ kind: 'posting', jobPostingId: 'jp-1', title: '토요일 딜러 4명' })
    ).toBe('토요일 딜러 4명 공고에서');
    expect(slotSourceLabel({ kind: 'posting', jobPostingId: 'jp-x', title: null })).toBe(
      '공고에서'
    );
  });
});

describe('collectSourcePostingIds', () => {
  it('컨테이너 직속을 빼고 공고 id 를 중복 없이 모은다', () => {
    expect(
      collectSourcePostingIds([
        { jobPostingId: 'venue-1', isContainer: true },
        { jobPostingId: 'jp-1', isContainer: false },
        { jobPostingId: 'jp-2', isContainer: false },
        { jobPostingId: 'jp-1', isContainer: false },
      ])
    ).toEqual(['jp-1', 'jp-2']);
  });

  it('빈 목록이면 빈 배열', () => {
    expect(collectSourcePostingIds([])).toEqual([]);
  });
});
