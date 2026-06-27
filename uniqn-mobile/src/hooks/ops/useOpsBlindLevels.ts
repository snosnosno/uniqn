/**
 * ops 블라인드 레벨 읽기 훅 + 리얼타임 구독 (1c).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsBlindLevelRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsBlindLevels(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.blindLevels(tournamentId)
      : [...queryKeys.ops.all, 'blindLevels', 'none'],
    queryFn: () => opsBlindLevelRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription(
      'ops_blind_levels',
      `tournament_id=eq.${tournamentId}`,
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ops.blindLevels(tournamentId) });
      }
    );
  }, [tournamentId, queryClient]);

  return {
    blindLevels: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
