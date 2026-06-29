/**
 * useUpdateSlot — 배치 슬롯 편집(시간·역할·색상·메모) 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Repository(workLogRepository.updateSlot) 경유(색상 화이트리스트·메모 XSS 검증은
 * 레포 경계가 담당). onSuccess: weeklyGrid prefix(weeklyGrid.all) 일괄 invalidate →
 * daySlots/summary 재조회. 토스트/낙관 UI 는 호출부 책임(훅은 변이만).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { workLogRepository } from '@/repositories';
import type { UpdateSlotInput } from '@/repositories';

/** 슬롯 편집 변이 변수. */
export interface UpdateSlotVars {
  workLogId: string;
  input: UpdateSlotInput;
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workLogId, input }: UpdateSlotVars) =>
      workLogRepository.updateSlot(workLogId, input),
    onSuccess: () => {
      // summary/daySlots 공통 prefix 무효화 → 편집 결과(시간/역할/색상/메모) 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
    },
  });
}

export default useUpdateSlot;
