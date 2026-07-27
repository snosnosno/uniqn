/**
 * useSetVenueSoftTarget — 운영처 날짜별 목표인원(soft-target) 쓰기 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.setVenueSoftTarget) 경유(아키텍처 Hook→Service→Repository).
 * 날짜 정규화(E5)는 레포/RPC 가 담당. onSuccess: workSchedule 관련 쿼리(summary/containers/daySlots)를
 * prefix(workSchedule.all)로 일괄 invalidate → useGridSummary(부족 N명)·컨테이너 softTargets 재조회.
 * 토스트/낙관 UI 는 호출부 책임(훅은 변이만).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { setVenueSoftTarget } from '@/services/workSchedule/gridWriteService';

/** soft-target 변이 변수. date 는 레포에서 YYYY-MM-DD 로 정규화된다. */
export interface SetVenueSoftTargetVars {
  venueId: string;
  date: string;
  count: number;
}

export function useSetVenueSoftTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, date, count }: SetVenueSoftTargetVars) =>
      setVenueSoftTarget(venueId, date, count),
    onSuccess: () => {
      // summary/containers/daySlots 공통 prefix 무효화(queryKey 일관) → 부족셀·컨테이너 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
    },
  });
}
