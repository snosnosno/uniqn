/**
 * useGridSummary — 운영처 월 그리드 셀맵 조회 훅(읽기 전용 TanStack Query).
 *
 * 비활성(venueId null)이면 disabled. 월의 from/to 를 toDateString(SSOT)으로 산출 →
 * 그리드 요약 RPC + 컨테이너 softTargets 를 buildGridCells 로 합성 → Record<dateKey, GridDayCell> 반환.
 * 월별 독립 캐시(frequent staleTime) — 월 전환 후 재방문 시 cache hit.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import { workScheduleRepository } from '@/repositories/workSchedule';
import { buildGridCells, type GridDayCell } from '@/domains/workSchedule';
import { toDateString } from '@/utils/date';

export function useGridSummary(
  venueId: string | null,
  monthDate: Date | string,
  // 기능 플래그 OFF 시 호출측에서 쿼리를 비활성화할 수 있게 한다(기본 활성).
  options?: { enabled?: boolean }
) {
  const featureEnabled = options?.enabled ?? true;
  const range = useMemo(() => {
    const base = typeof monthDate === 'string' ? new Date(monthDate) : monthDate;
    return {
      from: toDateString(startOfMonth(base)),
      to: toDateString(endOfMonth(base)),
    };
  }, [monthDate]);

  return useQuery<Record<string, GridDayCell>>({
    queryKey: venueId
      ? queryKeys.workSchedule.summary(venueId, range.from, range.to)
      : [...queryKeys.workSchedule.all, 'summary', 'none'],
    queryFn: async () => {
      const vid = venueId as string;
      const [rows, container] = await Promise.all([
        workScheduleRepository.getVenueGridSummary(vid, range.from, range.to),
        jobPostingRepository.getVenueContainerById(vid),
      ]);
      return buildGridCells(rows, container?.softTargets ?? {});
    },
    enabled: featureEnabled && !!venueId && !!range.from && !!range.to,
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
  });
}
