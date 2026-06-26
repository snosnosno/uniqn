/**
 * ops 좌석 읽기 훅 + 리얼타임 구독.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsSeatRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsSeats(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.seats(tournamentId)
      : [...queryKeys.ops.all, 'seats', 'none'],
    queryFn: () => opsSeatRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_seats', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  return {
    seats: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
