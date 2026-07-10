/**
 * useSetVenueSoftTargetBulk — 운영처 목표인원(soft-target) 벌크 쓰기 변이 훅(TanStack useMutation).
 *
 * "이번 달 같은 요일 전체 적용"(P1-5)처럼 여러 날짜에 같은 목표인원을 한 번에 저장할 때 사용한다.
 * 단건 훅(useSetVenueSoftTarget)을 날짜 수만큼 반복 호출하면 매 성공마다 weeklyGrid.all 이
 * 무효화돼 재조회가 폭주하므로, 이 훅은 서비스(gridWriteService.setVenueSoftTargetBulk)에 벌크
 * 위임하고 **전체 완료 후 onSuccess 에서 딱 1회만** invalidate 한다.
 * mutationFn 은 Service 경유(아키텍처 Hook→Service→Repository). 토스트/낙관 UI 는 호출부 책임.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { setVenueSoftTargetBulk } from '@/services/weeklyGrid/gridWriteService';

/** soft-target 벌크 변이 변수. dates 는 각 항목이 레포에서 YYYY-MM-DD 로 정규화된다. */
export interface SetVenueSoftTargetBulkVars {
  venueId: string;
  dates: string[];
  count: number;
}

export function useSetVenueSoftTargetBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, dates, count }: SetVenueSoftTargetBulkVars) =>
      setVenueSoftTargetBulk(venueId, dates, count),
    onSuccess: () => {
      // 벌크 전체 완료 후 1회만 무효화(단건 반복 대비 무효화 폭주 방지) → 부족셀·컨테이너 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
    },
  });
}

export default useSetVenueSoftTargetBulk;
