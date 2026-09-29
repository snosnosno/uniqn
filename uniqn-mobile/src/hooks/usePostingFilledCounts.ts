import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { jobPostingRepository } from '@/repositories';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';

interface UsePostingFilledCountsOptions {
  /**
   * 조회 키가 바뀌는 동안 직전 결과를 유지한다. 무한 스크롤 목록 전용 — 페이지가 붙을 때마다
   * 이미 보이던 카드의 확정 수가 깜빡이지 않게 한다. 키가 공고별로 접두돼 있어 직전 맵에
   * 새 공고 값이 없을 뿐 잘못된 숫자가 섞이지는 않는다.
   * 단일 공고 상세 화면에서는 켜지 말 것 — 다른 공고로 이동할 때 이전 공고 숫자가 잠깐 보인다.
   */
  keepPrevious?: boolean;
}

/**
 * 가시 공고들의 (date,timeSlot,role)별 활성 확정 수 배치 조회 (H0).
 * 반환 Map 키: `${jobPostingId}__${date}__${timeSlot}__${roleKey}`. 실패 시 빈 맵.
 */
export function usePostingFilledCounts(
  jobPostingIds: string[],
  options?: UsePostingFilledCountsOptions
) {
  const ids = Array.from(new Set(jobPostingIds.filter(Boolean)));
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: [POSTING_FILLED_COUNTS_QUERY_KEY, key],
    queryFn: () => jobPostingRepository.getPostingFilledCounts(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
    ...(options?.keepPrevious ? { placeholderData: keepPreviousData } : {}),
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

/**
 * 글로벌 맵을 공고별 서브맵으로 한 번에 묶는다 — 목록 화면용.
 * 카드마다 extractPostingFilledSubmap 을 부르면 카드 수 × 맵 크기만큼 훑게 된다.
 * 공고 ID(uuid)에는 `__` 가 없으므로 첫 `__` 앞이 공고 ID 다.
 */
export function groupPostingFilledCounts(
  all: Map<string, number> | undefined
): Map<string, Map<string, number>> {
  const grouped = new Map<string, Map<string, number>>();
  if (!all) return grouped;
  for (const [k, v] of all) {
    const separator = k.indexOf('__');
    if (separator <= 0) continue;
    const postingId = k.slice(0, separator);
    let sub = grouped.get(postingId);
    if (!sub) {
      sub = new Map();
      grouped.set(postingId, sub);
    }
    sub.set(k.slice(separator + 2), v);
  }
  return grouped;
}
