import { useQuery } from '@tanstack/react-query';
import { jobPostingRepository } from '@/repositories';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';

/**
 * 가시 공고들의 (date,timeSlot,role)별 활성 확정 수 배치 조회 (H0).
 * 반환 Map 키: `${jobPostingId}__${date}__${timeSlot}__${roleKey}`. 실패 시 빈 맵.
 */
export function usePostingFilledCounts(jobPostingIds: string[]) {
  const ids = Array.from(new Set(jobPostingIds.filter(Boolean)));
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: [POSTING_FILLED_COUNTS_QUERY_KEY, key],
    queryFn: () => jobPostingRepository.getPostingFilledCounts(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

/** 글로벌 맵(posting-prefixed)에서 한 공고의 모델 레벨 서브맵(`date__slot__role`)을 추출. */
export function extractPostingFilledSubmap(
  all: Map<string, number> | undefined,
  postingId: string
): Map<string, number> | undefined {
  if (!all || all.size === 0 || !postingId) return undefined;
  const prefix = `${postingId}__`;
  let sub: Map<string, number> | undefined;
  for (const [k, v] of all) {
    if (k.startsWith(prefix)) {
      (sub ??= new Map()).set(k.slice(prefix.length), v);
    }
  }
  return sub;
}
