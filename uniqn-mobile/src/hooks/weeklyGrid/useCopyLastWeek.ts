/**
 * useCopyLastWeek — 지난주 동요일 배치를 이번 주로 복사하는 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(copyLastWeek) 경유(소스 조회 + 벌크 add_direct_staff 오케스트레이션).
 * onSuccess: weeklyGrid 관련 쿼리(summary/containers/daySlots)를 prefix(weeklyGrid.all)로 일괄
 * invalidate → 그리드 셀맵·하루 슬롯 재조회. 토스트/낙관 UI 는 호출부 책임(훅은 변이만).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  copyLastWeek,
  type CopyLastWeekInput,
  type CopyLastWeekResult,
} from '@/services/weeklyGrid/copyLastWeekService';

export function useCopyLastWeek() {
  const qc = useQueryClient();
  return useMutation<CopyLastWeekResult, Error, CopyLastWeekInput>({
    mutationFn: (vars) => copyLastWeek(vars),
    onSuccess: () => {
      // summary/containers/daySlots 공통 prefix 무효화 → 복사된 배치가 그리드에 반영.
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
    },
  });
}

export default useCopyLastWeek;
