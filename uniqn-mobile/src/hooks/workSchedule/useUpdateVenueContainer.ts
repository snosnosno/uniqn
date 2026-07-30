/**
 * useUpdateVenueContainer — 지점 프로필(이름·장소명·연락처·소개) 수정 변이 훅.
 *
 * mutationFn 은 Service(gridWriteService.updateVenueContainer) 경유(아키텍처 Hook→Service→Repository).
 * onSuccess: workSchedule(컨테이너 목록·그리드) 무효화 + schedule(스태프 "내 스케줄"의 지점
 * 표시 정보) 무효화 — 지점명을 바꾸면 구인자 화면만이 아니라 배치된 스태프 화면도 갱신돼야 한다.
 * 토스트/실패 UX 는 호출부 책임(훅은 변이만).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { updateVenueContainer } from '@/services/workSchedule/gridWriteService';
import type { UpdateVenueContainerInput } from '@/repositories';

export interface UpdateVenueContainerVars extends UpdateVenueContainerInput {
  containerId: string;
}

export function useUpdateVenueContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ containerId, ...input }: UpdateVenueContainerVars) =>
      updateVenueContainer(containerId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

export default useUpdateVenueContainer;
