/**
 * useDeleteSlot — 배치 슬롯 빼기 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.deleteSlot) 경유(아키텍처 Hook→Service→Repository).
 * 직접추가/지원확정 분기는 서비스가 담당. onSuccess: workSchedule prefix 무효화(부족셀·상세 갱신)
 * + 스태프관리/공고 무효화 헬퍼(스태프탭·filled 카운트 정합 — AddSlotSheet 추가 경로와 대칭).
 * 토스트/닫기는 호출부 책임(훅은 변이만).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '@/lib/queryClient';
import { deleteSlot } from '@/services/workSchedule/gridWriteService';
import type { DeleteConfirmedStaffInput } from '@/types';

export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteConfirmedStaffInput) => deleteSlot(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
      invalidateQueries.staffManagement(input.jobPostingId);
      invalidateQueries.jobPostings();
    },
  });
}

export default useDeleteSlot;
