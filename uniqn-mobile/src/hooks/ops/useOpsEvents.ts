/**
 * ops 이벤트(HISTORY) 읽기 훅 (1c).
 * ops_events 는 Realtime publication 미등록 → 구독 없이 30s staleTime + 변이 후 자연 refetch.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsEventRepository } from '@/repositories/ops';

export function useOpsEvents(tournamentId: string | undefined, limit = 100) {
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.events(tournamentId)
      : [...queryKeys.ops.all, 'events', 'none'],
    queryFn: () => opsEventRepository.listByTournament(tournamentId as string, limit),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
