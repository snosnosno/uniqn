/**
 * ops 참가자 읽기 훅 + STATUS 부분통계 파생(클라이언트 계산).
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsParticipantRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';
import { computeOpsPartialStats } from '@/domains/ops';
import type { OpsParticipant, OpsTournament, OpsPartialStats } from '@/types/ops';

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

/** STATUS 부분통계 — 참가자 + 대회 비용설정에서 순수 계산. tournament 없으면 null. */
export function useOpsPartialStats(
  tournament: OpsTournament | null,
  participants: readonly OpsParticipant[]
): OpsPartialStats | null {
  return useMemo(() => {
    if (!tournament) return null;
    return computeOpsPartialStats(participants, tournament);
  }, [tournament, participants]);
}
