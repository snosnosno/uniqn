/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.createVenueContainer) 경유(아키텍처 Hook→Service→Repository).
 * 이름 XSS 검증(S1)·워크스페이스 권한 게이트·get-or-create 멱등은 레포/RPC 경계가 담당.
 * onSuccess: weeklyGrid prefix 일괄 invalidate → useVenueContainers(목록) 재조회.
 * 토스트/낙관 UI 는 호출부 책임(훅은 변이만). workspaceId 부재 시 변이는 거부(레포 미호출).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { createVenueContainer } from '@/services/weeklyGrid/gridWriteService';

export function useCreateVenueContainer(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!workspaceId) {
        return Promise.reject(new Error('WORKSPACE_REQUIRED'));
      }
      return createVenueContainer(workspaceId, name);
    },
    onSuccess: () => {
      // summary/containers/daySlots 공통 prefix 무효화(queryKey 일관) → 컨테이너 목록 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
    },
  });
}

export default useCreateVenueContainer;
