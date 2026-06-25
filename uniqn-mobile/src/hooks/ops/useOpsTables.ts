/**
 * ops 테이블 읽기 훅 + 리얼타임 구독.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTableRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsTables(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.tables(tournamentId)
      : [...queryKeys.ops.all, 'tables', 'none'],
    queryFn: () => opsTableRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_tables', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  return {
    tables: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
