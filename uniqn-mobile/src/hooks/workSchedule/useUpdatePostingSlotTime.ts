/**
 * useUpdatePostingSlotTime — 공고 슬롯 시간 일괄 변경(3-C) 변이 훅.
 *
 * mutationFn 은 Service(gridWriteService.updatePostingSlotTime) 경유
 * (아키텍처 Hook → Service → Repository). 토스트·낙관 UI 는 호출부 책임.
 *
 * 🔑 무효화 범위가 `useUpdateSlot` 보다 **넓다.** 이 변이는 세 원천을 한 번에 바꾸기 때문이다:
 *   · `work_logs`            → workSchedule.all (근무표 일자 상세·월 요약)
 *   · `applications.assignments` → applications.all (지원자 목록·상세의 배정 시각)
 *   · `job_postings.schedule`   → jobPostings.all + postingFilledCounts
 *   · 확정 스태프 목록(공고 상세)  → confirmedStaff.all — `ConfirmedStaff` 가 timeSlot 을 싣는다
 *     공고 원문 정원이 실제로 바뀌므로(설계 §10-3) 공고 카드·상세의 "N/M" 표시가
 *     낡은 채로 남는다. 정원(M)은 jobPostings 캐시에, 확정 수(N)는 postingFilledCounts 에
 *     따로 들어 있어 **둘 다** 버려야 한 화면이 일관되게 갱신된다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';
import { updatePostingSlotTime } from '@/services/workSchedule/gridWriteService';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import type { UpdatePostingSlotTimeInput } from '@/repositories';

export function useUpdatePostingSlotTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePostingSlotTimeInput) => {
      requireOnlineForMutation('공고 슬롯 시간 일괄 변경');
      return updatePostingSlotTime(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
      qc.invalidateQueries({ queryKey: [POSTING_FILLED_COUNTS_QUERY_KEY] });
      // 🔑 확정 스태프 목록(공고 상세)도 `timeSlot` 을 싣는다(types/confirmedStaff.ts).
      //    버리지 않으면 근무표에서 시간을 옮긴 뒤 공고 상세가 옛 시각을 그대로 보여준다.
      qc.invalidateQueries({ queryKey: queryKeys.confirmedStaff.all });
    },
  });
}
