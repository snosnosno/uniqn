import type { JobPostingStatus } from '@/types/jobPosting';

/**
 * 구인자 공고관리 화면의 상단 필터 탭 값.
 * UI 탭은 전체/모집중/마감 3종이며, 공고의 세부 status 를 이 3개 버킷으로 묶는다.
 */
export type PostingFilterStatus = 'all' | 'active' | 'closed';

/**
 * 공고 status → 필터 버킷 매핑.
 *
 * capacity_full(정원 자동마감)은 마감일 전까지 노출되는 '진행중' 상태이므로 '모집중'에 합류한다.
 * 매핑되지 않은 status(draft/pending/expired/cancelled 등)는 어떤 탭에도 잡히지 않고
 * '전체'에서만 보인다(기존 동작 유지).
 */
const STATUS_FILTER_BUCKET: Partial<Record<JobPostingStatus, Exclude<PostingFilterStatus, 'all'>>> =
  {
    active: 'active',
    capacity_full: 'active',
    closed: 'closed',
  };

/** 공고 status 가 주어진 필터에 해당하는지 판정한다. */
export function postingMatchesFilter(
  status: JobPostingStatus,
  filter: PostingFilterStatus
): boolean {
  if (filter === 'all') {
    return true;
  }
  return STATUS_FILTER_BUCKET[status] === filter;
}

/** 공고 목록을 필터 버킷별로 집계한다(전체 + 매핑된 버킷). */
export function countPostingsByFilter<T extends { status: JobPostingStatus }>(
  postings: readonly T[]
): Partial<Record<PostingFilterStatus, number>> {
  const counts: Partial<Record<PostingFilterStatus, number>> = {
    all: postings.length,
  };

  for (const posting of postings) {
    const bucket = STATUS_FILTER_BUCKET[posting.status];
    if (bucket) {
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
  }

  return counts;
}
