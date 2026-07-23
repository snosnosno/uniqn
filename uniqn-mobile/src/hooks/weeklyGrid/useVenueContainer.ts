/**
 * useVenueContainer — 컨테이너 단건 조회(roleSalaries 포함). JIT 노출 판정용.
 * 읽기 전용 TanStack 조회는 Repository 직접 호출 허용(아키텍처 규칙).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

export function useVenueContainer(venueId: string | null) {
  return useQuery({
    queryKey: queryKeys.weeklyGrid.container(venueId ?? ''),
    queryFn: () => jobPostingRepository.getVenueContainerById(venueId as string),
    enabled: !!venueId,
  });
}
