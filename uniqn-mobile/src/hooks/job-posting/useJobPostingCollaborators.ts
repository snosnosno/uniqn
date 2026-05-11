/**
 * UNIQN Mobile - useJobPostingCollaborators
 *
 * @description 공고별 협업자 목록 + add/remove mutations + Realtime 구독
 *              TanStack Query. 권한 분기는 데이터 형태로 (RLS 가 진짜 게이트).
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { collaboratorService } from '@/services/jobs/collaboratorService';
import { createRealtimeSubscription } from '@/utils/supabase';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';
import { extractUserMessage } from '@/errors';
import type {
  JobPostingCollaboratorWithUser,
  CollaboratorSearchCandidate,
} from '@/types/jobPostingCollaborator';

const toast = {
  success: (msg: string) => useToastStore.getState().success(msg),
  error: (msg: string) => useToastStore.getState().error(msg),
};

export interface UseJobPostingCollaboratorsResult {
  collaborators: JobPostingCollaboratorWithUser[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** 협업자 추가 (workspace owner 만 — RLS 가 강제) */
  add: (userId: string) => Promise<void>;
  isAdding: boolean;
  /** 협업자 제거 (workspace owner OR 본인 — RLS 가 강제) */
  remove: (userId: string) => Promise<void>;
  isRemoving: boolean;
  /** 본인 나가기 */
  leaveSelf: () => Promise<void>;
}

export function useJobPostingCollaborators(
  jobPostingId: string | undefined
): UseJobPostingCollaboratorsResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: jobPostingId
      ? queryKeys.jobPostingCollaborators.list(jobPostingId)
      : [...queryKeys.jobPostingCollaborators.all, 'list', 'none'],
    queryFn: () => collaboratorService.listForJobPosting(jobPostingId!),
    enabled: !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });

  // Realtime — collaborator INSERT/DELETE 시 자동 갱신
  useEffect(() => {
    if (!jobPostingId) return undefined;
    return createRealtimeSubscription(
      'job_posting_collaborators',
      `job_posting_id=eq.${jobPostingId}`,
      () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobPostingCollaborators.list(jobPostingId),
        });
      }
    );
  }, [jobPostingId, queryClient]);

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      collaboratorService.add({ jobPostingId: jobPostingId!, userId }),
    onSuccess: () => {
      if (jobPostingId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobPostingCollaborators.list(jobPostingId),
        });
      }
      toast.success('협업자를 추가했습니다');
    },
    onError: (error) => {
      logger.error('협업자 추가 실패', error);
      toast.error(extractUserMessage(error) || '협업자 추가에 실패했습니다');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      collaboratorService.remove({ jobPostingId: jobPostingId!, userId }),
    onSuccess: () => {
      if (jobPostingId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobPostingCollaborators.list(jobPostingId),
        });
      }
      toast.success('협업자를 제거했습니다');
    },
    onError: (error) => {
      logger.error('협업자 제거 실패', error);
      toast.error(extractUserMessage(error) || '협업자 제거에 실패했습니다');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => collaboratorService.leaveSelf(jobPostingId!),
    onSuccess: () => {
      // 본인 나가기 후 cleanup — Codex outside-voice 5 단계
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostingCollaborators.all,
      });
      if (jobPostingId) {
        queryClient.removeQueries({
          queryKey: queryKeys.jobPostingCollaborators.list(jobPostingId),
        });
      }
      toast.success('공고 관리에서 나갔습니다');
    },
    onError: (error) => {
      logger.error('자가 나가기 실패', error);
      toast.error(extractUserMessage(error) || '나가기에 실패했습니다');
    },
  });

  return {
    collaborators: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    add: async (userId: string) => {
      await addMutation.mutateAsync(userId);
    },
    isAdding: addMutation.isPending,
    remove: async (userId: string) => {
      await removeMutation.mutateAsync(userId);
    },
    isRemoving: removeMutation.isPending,
    leaveSelf: async () => {
      await leaveMutation.mutateAsync();
    },
  };
}

// ============================================================================
// useCollaboratorCandidates — 이메일 검색 (debounce 는 호출자가 처리)
// ============================================================================

export interface UseCollaboratorCandidatesResult {
  candidates: CollaboratorSearchCandidate[];
  isLoading: boolean;
  error: unknown;
}

export function useCollaboratorCandidates(
  jobPostingId: string | undefined,
  emailQuery: string
): UseCollaboratorCandidatesResult {
  const enabled = !!jobPostingId && emailQuery.trim().length >= 3;

  const query = useQuery({
    queryKey: jobPostingId
      ? queryKeys.jobPostingCollaborators.candidates(jobPostingId, emailQuery)
      : [...queryKeys.jobPostingCollaborators.all, 'candidates', 'none'],
    queryFn: () =>
      collaboratorService.searchCandidates({ jobPostingId: jobPostingId!, emailQuery }),
    enabled,
    staleTime: 30_000,
  });

  return {
    candidates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
