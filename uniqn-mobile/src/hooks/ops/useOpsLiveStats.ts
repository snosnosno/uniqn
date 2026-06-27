/**
 * ops 라이브 통계 읽기 훅(단일행) + 리얼타임 구독 (1c).
 * 서버 트리거 재계산 단일소스 — 클라 파생 없음.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsLiveStatsRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsLiveStats(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.liveStats(tournamentId)
      : [...queryKeys.ops.all, 'liveStats', 'none'],
    queryFn: () => opsLiveStatsRepository.get(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_live_stats', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
