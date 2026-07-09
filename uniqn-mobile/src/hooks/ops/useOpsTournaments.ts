/**
 * ops 대회 읽기 훅 (목록/상세/공고연동). 읽기는 Repository 직접 호출(읽기전용 예외).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTournamentRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsTournaments() {
  const query = useQuery({
    queryKey: queryKeys.ops.tournaments(),
    queryFn: () => opsTournamentRepository.listForUser(),
    staleTime: cachingPolicies.frequent,
  });
  return {
    tournaments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useOpsTournament(id: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: id
      ? queryKeys.ops.tournamentDetail(id)
      : [...queryKeys.ops.all, 'tournament', 'none'],
    queryFn: () => opsTournamentRepository.getById(id as string),
    enabled: !!id,
    staleTime: cachingPolicies.frequent,
  });

  useEffect(() => {
    if (!id) return undefined;
    return createRealtimeSubscription('ops_tournaments', `id=eq.${id}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(id) });
    });
  }, [id, queryClient]);

  return {
    tournament: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** 브릿지: 공고에 연결된 ops 대회 목록(N:1, created_at desc). null-safe(빈 배열). */
export function useOpsTournamentsForPosting(jobPostingId: string | undefined) {
  const query = useQuery({
    queryKey: jobPostingId
      ? queryKeys.ops.forPosting(jobPostingId)
      : [...queryKeys.ops.all, 'forPosting', 'none'],
    queryFn: () => opsTournamentRepository.listByPosting(jobPostingId as string),
    enabled: !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
  return { opsTournaments: query.data ?? [], isLoading: query.isLoading };
}
