import { countPostingsByFilter, postingMatchesFilter } from '@/utils/employerPostingFilter';
import type { JobPostingStatus } from '@/types/jobPosting';

const posting = (status: JobPostingStatus) => ({ status });

describe('postingMatchesFilter', () => {
  it("'all' 필터는 모든 status 를 포함한다", () => {
    expect(postingMatchesFilter('active', 'all')).toBe(true);
    expect(postingMatchesFilter('capacity_full', 'all')).toBe(true);
    expect(postingMatchesFilter('expired', 'all')).toBe(true);
  });

  it("capacity_full(정원 자동마감) 공고는 '모집중' 필터에 포함된다", () => {
    // 회귀 가드: capacity_full 은 마감일 전 진행중 상태라 active 버킷에 합류해야 함
    expect(postingMatchesFilter('capacity_full', 'active')).toBe(true);
    expect(postingMatchesFilter('active', 'active')).toBe(true);
  });

  it("capacity_full 은 '마감' 필터에는 포함되지 않는다", () => {
    expect(postingMatchesFilter('capacity_full', 'closed')).toBe(false);
  });

  it("'마감' 필터는 closed status 만 포함한다", () => {
    expect(postingMatchesFilter('closed', 'closed')).toBe(true);
    expect(postingMatchesFilter('active', 'closed')).toBe(false);
  });

  it('버킷에 매핑되지 않은 status(expired 등)는 active/closed 어디에도 포함되지 않는다', () => {
    expect(postingMatchesFilter('expired', 'active')).toBe(false);
    expect(postingMatchesFilter('expired', 'closed')).toBe(false);
    expect(postingMatchesFilter('cancelled', 'active')).toBe(false);
  });
});

describe('countPostingsByFilter', () => {
  it('전체(all) 카운트는 공고 총 개수와 같다', () => {
    const counts = countPostingsByFilter([
      posting('active'),
      posting('capacity_full'),
      posting('closed'),
      posting('expired'),
    ]);
    expect(counts.all).toBe(4);
  });

  it("capacity_full 은 '모집중' 카운트에 합산된다", () => {
    const counts = countPostingsByFilter([
      posting('active'),
      posting('active'),
      posting('capacity_full'),
      posting('closed'),
    ]);
    expect(counts.active).toBe(3); // active 2 + capacity_full 1
    expect(counts.closed).toBe(1);
  });

  it('버킷 없는 status 는 active/closed 카운트를 부풀리지 않는다', () => {
    const counts = countPostingsByFilter([
      posting('active'),
      posting('expired'),
      posting('cancelled'),
    ]);
    expect(counts.active).toBe(1);
    expect(counts.closed ?? 0).toBe(0);
  });
});
