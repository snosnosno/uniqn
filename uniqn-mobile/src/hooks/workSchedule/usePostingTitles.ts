/**
 * usePostingTitles — 근무표 출처 칩용 공고 제목 조회(읽기 전용 TanStack Query, 구인자 IA S4)
 *
 * 근무표 하루 슬롯 RPC(`get_venue_day_slots`)는 공고 id 만 내려준다. 이 웨이브는 RPC 를 바꾸지
 * 않으므로 기존 배치 리더(`getByIdBatch`)로 제목만 채운다. RLS(`jp_select_managed`)가 소유자·팀원·
 * 협업자에게 상태와 무관하게 읽기를 허용한다. 읽지 못한 id 는 Map 에 없고, 칩은 `공고에서` 로 남는다.
 *
 * 로딩·실패 중에도 빈 Map 을 돌려준다 — 출처 칩은 부가 정보라 사람 줄 렌더를 막지 않는다.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

const EMPTY_TITLES: ReadonlyMap<string, string> = new Map();

export function usePostingTitles(jobPostingIds: readonly string[]): ReadonlyMap<string, string> {
  // 순서가 달라도 같은 집합이면 같은 캐시를 쓴다.
  const sortedIds = useMemo(() => [...jobPostingIds].sort(), [jobPostingIds]);

  const query = useQuery({
    queryKey: [...queryKeys.workSchedule.all, 'postingTitles', sortedIds.join(',')],
    queryFn: async () => {
      const postings = await jobPostingRepository.getByIdBatch(sortedIds);
      return new Map(postings.map((posting) => [posting.id, posting.title] as const));
    },
    enabled: sortedIds.length > 0,
    staleTime: cachingPolicies.standard,
  });

  return query.data ?? EMPTY_TITLES;
}
