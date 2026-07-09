/**
 * UNIQN Mobile - 일반 공고 일자별 개수 조회 훅
 *
 * @description DateCalendar UI의 달력 셀 뱃지용.
 *              보이는 월 기준 주 단위 확장된 범위(이전/다음 달 일부 포함)로 RPC 호출.
 *              월별 독립 캐시(5분 staleTime) — 월 전환 후 재방문 시 cache hit.
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

export function useRegularDateCounts(visibleMonth: Date) {
  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }, [visibleMonth]);

  return useQuery({
    queryKey: [...queryKeys.jobPostings.all, 'regularDateCounts', range.start, range.end] as const,
    queryFn: () => jobPostingRepository.getRegularDateCounts(range.start, range.end),
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
  });
}
