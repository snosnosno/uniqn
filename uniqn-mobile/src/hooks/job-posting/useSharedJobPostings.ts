/**
 * UNIQN Mobile - useSharedJobPostings
 *
 * @description collaborator 본인이 협업하는 공고 목록 — "공유받은 공고" 섹션용
 *              RLS 격리: 본인이 collaborator 인 공고만 반환. 다른 워크스페이스는 차단.
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { collaboratorService } from '@/services/jobs/collaboratorService';
import { createRealtimeSubscription } from '@/utils/supabase';
import type { SharedJobPosting } from '@/types/jobPostingCollaborator';

export interface UseSharedJobPostingsResult {
  sharedPostings: SharedJobPosting[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useSharedJobPostings(): UseSharedJobPostingsResult {
  const { user } = useAuthStore();
  const userId = user?.uid;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: userId
      ? queryKeys.jobPostingCollaborators.sharedForUser(userId)
      : [...queryKeys.jobPostingCollaborators.all, 'shared', 'anonymous'],
    queryFn: () => collaboratorService.listSharedJobPostings(),
    enabled: !!userId,
    staleTime: cachingPolicies.frequent,
  });

  // Realtime — 본인 user_id 의 jpc INSERT/DELETE 시 자동 갱신
  // (collaborator 추가/제거 → 푸시 알림 + 리스트 동기화)
  useEffect(() => {
    if (!userId) return undefined;
    return createRealtimeSubscription('job_posting_collaborators', `user_id=eq.${userId}`, () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostingCollaborators.sharedForUser(userId),
      });
    });
  }, [userId, queryClient]);

  return {
    sharedPostings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
