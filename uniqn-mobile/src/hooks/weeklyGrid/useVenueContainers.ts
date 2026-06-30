/**
 * useVenueContainers — 워크스페이스의 운영처(컨테이너) 목록 조회 훅(읽기 전용 TanStack Query).
 *
 * 컨테이너는 rigid JobPosting 으로 읽지 않고 경량 VenueContainer 전용 경로로만 조회한다
 * (jobPostingRepository.getVenueContainers). 읽기 전용이라 Repository 직접 호출 허용.
 * workspaceId 가 없으면 disabled.
 */
import { useQuery } from '@tanstack/react-query';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import type { VenueContainer } from '@/domains/weeklyGrid';

export function useVenueContainers(
  workspaceId: string | null | undefined,
  // 기능 플래그 OFF 시 호출측에서 쿼리를 비활성화할 수 있게 한다(기본 활성).
  options?: { enabled?: boolean }
) {
  const featureEnabled = options?.enabled ?? true;
  return useQuery<VenueContainer[]>({
    queryKey: workspaceId
      ? queryKeys.weeklyGrid.containers(workspaceId)
      : [...queryKeys.weeklyGrid.all, 'containers', 'none'],
    queryFn: () => jobPostingRepository.getVenueContainers(workspaceId as string),
    enabled: featureEnabled && !!workspaceId,
    staleTime: cachingPolicies.frequent,
  });
}

export default useVenueContainers;
