/**
 * useSetVenueRoleSalary — 지점 역할별 단가 쓰기 변이 훅.
 * onSuccess: weeklyGrid(컨테이너 roleSalaries 재조회) + settlement(폴백→단가 재계산) 무효화.
 * 토스트/실패 UX 는 호출부 책임(JIT 는 실패해도 배치 진행 — 설계 §B).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { setVenueRoleSalary } from '@/services/weeklyGrid/gridWriteService';
import type { SetVenueRoleSalaryInput } from '@/repositories';

export interface SetVenueRoleSalaryVars extends SetVenueRoleSalaryInput {
  venueId: string;
}

export function useSetVenueRoleSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, ...input }: SetVenueRoleSalaryVars) =>
      setVenueRoleSalary(venueId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
      qc.invalidateQueries({ queryKey: queryKeys.settlement.all });
    },
  });
}
