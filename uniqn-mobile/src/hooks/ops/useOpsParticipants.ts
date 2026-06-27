/**
 * ops 참가자 읽기 훅.
 * STATUS 통계는 1c 부터 서버 단일소스(useOpsLiveStats) — 클라 파생(useOpsPartialStats) 폐기.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsParticipantRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsParticipants(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.participants(tournamentId)
      : [...queryKeys.ops.all, 'participants', 'none'],
    queryFn: () => opsParticipantRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription(
      'ops_participants',
      `tournament_id=eq.${tournamentId}`,
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      }
    );
  }, [tournamentId, queryClient]);

  return {
    participants: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
