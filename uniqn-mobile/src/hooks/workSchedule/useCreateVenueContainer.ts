/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.createVenueContainer) 경유(아키텍처 Hook→Service→Repository).
 * 이름 XSS 검증(S1)·워크스페이스 권한 게이트·get-or-create 멱등은 레포/RPC 경계가 담당.
 * onSuccess: 컨테이너 목록 캐시에 낙관적 시드 → workSchedule prefix 일괄 invalidate.
 *   낙관적 시드 이유: invalidate 는 비동기 리페치라 동기 렌더 시점엔 새 컨테이너가 목록에 없다.
 *   화면의 자기-치유 useEffect(deps [containers, selectedVenueId]) 가 새 id 를 "유효한 항목"으로
 *   인식해 선택을 유지하려면, setQueryData 로 즉시 반영해야 N→N+1 자동선택 바운스가 사라진다.
 * 토스트/낙관 UI 는 호출부 책임(훅은 변이만). workspaceId 부재 시 변이는 거부(레포 미호출).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { createVenueContainer } from '@/services/workSchedule/gridWriteService';
import type { VenueContainer } from '@/domains/workSchedule';

export function useCreateVenueContainer(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!workspaceId) {
        return Promise.reject(new Error('WORKSPACE_REQUIRED'));
      }
      return createVenueContainer(workspaceId, name);
    },
    onSuccess: (container) => {
      // 낙관적 캐시 시드: 비동기 refetch 전에 새 컨테이너를 목록에 즉시 반영해,
      // 화면의 selectedVenueId 자기-치유 effect 가 새 운영처를 유효하게 보고 선택을 유지하도록 한다.
      // 멱등: 이미 목록에 있으면 추가하지 않는다(get-or-create 재호출 대비).
      if (workspaceId) {
        qc.setQueryData<VenueContainer[]>(queryKeys.workSchedule.containers(workspaceId), (old) =>
          old?.some((c) => c.id === container.id) ? old : [...(old ?? []), container]
        );
      }
      // summary/containers/daySlots 공통 prefix 무효화(queryKey 일관) → 컨테이너 목록 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
    },
  });
}
