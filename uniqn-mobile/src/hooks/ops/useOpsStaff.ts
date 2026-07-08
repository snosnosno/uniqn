/**
 * ops 스태프 로스터(1e) 읽기 훅 — Realtime 구독(useOpsParticipants 문형 복제).
 * 읽기는 Repository 직접(TanStack Query 규약) + 'ops_staff' 변경 시 invalidate.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsStaffRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';
import type { OpsStaff } from '@/types/ops';

export function useOpsStaff(tournamentId: string | undefined): UseQueryResult<OpsStaff[]> {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.staff(tournamentId)
      : [...queryKeys.ops.all, 'staff', 'none'],
    queryFn: () => opsStaffRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_staff', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  return query;
}
