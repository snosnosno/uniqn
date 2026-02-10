/**
 * UNIQN Mobile - 대회공고 승인 관리 훅
 *
 * @description TanStack Query 기반 대회공고 승인/거부/재제출 관리
 * @version 1.0.0
 *
 * 사용처:
 * - 관리자: 승인 대기 목록 조회, 승인/거부 처리
 * - 구인자: 내 대회공고 상태 확인, 거부 시 재제출
 */

import { useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tournamentApprovalService } from '@/services/tournamentApprovalService';
import type { TournamentApprovalStatus } from '@/types';
import { queryKeys, cachingPolicies, invalidateQueries } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractErrorMessage } from '@/shared/errors';
import { STATUS } from '@/constants';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface UseTournamentApprovalOptions {
  /** 자동 조회 활성화 (기본: true) */
  enabled?: boolean;
}

interface UseTournamentApprovalReturn {
  // 승인 대기 목록 (관리자용)
  pendingPostings: JobPosting[];
  isLoadingPending: boolean;
  pendingError: Error | null;
  refetchPending: () => void;

  // 내 대회공고 (구인자용)
  myPendingPostings: JobPosting[];
  isLoadingMyPending: boolean;
  myPendingError: Error | null;
  refetchMyPending: () => void;

  // 승인 mutation
  approve: {
    mutate: (postingId: string) => void;
    mutateAsync: (data: { postingId: string }) => Promise<unknown>;
    isPending: boolean;
  };

  // 거부 mutation
  reject: {
    mutate: (data: { postingId: string; reason: string }) => void;
    mutateAsync: (data: { postingId: string; reason: string }) => Promise<unknown>;
    isPending: boolean;
  };

  // 재제출 mutation
  resubmit: {
    mutate: (postingId: string) => void;
    mutateAsync: (data: { postingId: string }) => Promise<unknown>;
    isPending: boolean;
  };

  // 처리 중 여부
  isProcessing: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 대회공고 승인 관리 훅
 *
 * @example
 * ```tsx
 * // 관리자 승인 페이지
 * const { pendingPostings, approve, reject, isProcessing } = useTournamentApproval();
 *
 * // 구인자 내 공고 페이지
 * const { myPendingPostings, resubmit } = useTournamentApproval();
 * ```
 */
export function useTournamentApproval(
  options: UseTournamentApprovalOptions = {}
): UseTournamentApprovalReturn {
  const { enabled = true } = options;
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  // ============================================================================
  // Queries
  // ============================================================================

  // 승인 대기 목록 (관리자용)
  const pendingQuery = useQuery({
    queryKey: queryKeys.tournaments.pending(),
    queryFn: tournamentApprovalService.getPending,
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000,
    enabled: enabled && isAdmin,
  });

  // 내 대회공고 - pending/rejected (구인자용)
  const myPendingQuery = useQuery({
    queryKey: queryKeys.tournaments.myPending(),
    queryFn: () =>
      user?.uid ? tournamentApprovalService.getMyPending(user.uid) : Promise.resolve([]),
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000,
    enabled: enabled && !!user?.uid && !isAdmin,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  // 승인 뮤테이션
  const approveMutation = useMutation({
    mutationFn: (postingId: string) => tournamentApprovalService.approve({ postingId }),
    onSuccess: (_, postingId) => {
      toast.success('대회공고가 승인되었습니다');
      invalidateQueries.tournamentApproval();
      logger.info('대회공고 승인 완료', { postingId });
    },
    onError: (error: Error, postingId) => {
      toast.error(extractErrorMessage(error, '승인에 실패했습니다'));
      logger.error('대회공고 승인 실패', error, { postingId });
    },
  });

  // 거부 뮤테이션
  const rejectMutation = useMutation({
    mutationFn: ({ postingId, reason }: { postingId: string; reason: string }) =>
      tournamentApprovalService.reject({ postingId, reason }),
    onSuccess: (_, { postingId }) => {
      toast.success('대회공고가 거부되었습니다');
      invalidateQueries.tournamentApproval();
      logger.info('대회공고 거부 완료', { postingId });
    },
    onError: (error: Error, { postingId }) => {
      toast.error(extractErrorMessage(error, '거부에 실패했습니다'));
      logger.error('대회공고 거부 실패', error, { postingId });
    },
  });

  // 재제출 뮤테이션
  const resubmitMutation = useMutation({
    mutationFn: (postingId: string) => tournamentApprovalService.resubmit({ postingId }),
    onSuccess: (_, postingId) => {
      toast.success('대회공고가 재제출되었습니다');
      invalidateQueries.tournamentApproval();
      logger.info('대회공고 재제출 완료', { postingId });
    },
    onError: (error: Error, postingId) => {
      toast.error(extractErrorMessage(error, '재제출에 실패했습니다'));
      logger.error('대회공고 재제출 실패', error, { postingId });
    },
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  const approve = useCallback(
    (postingId: string) => {
      approveMutation.mutate(postingId);
    },
    [approveMutation]
  );

  const reject = useCallback(
    (data: { postingId: string; reason: string }) => {
      rejectMutation.mutate(data);
    },
    [rejectMutation]
  );

  const resubmit = useCallback(
    (postingId: string) => {
      resubmitMutation.mutate(postingId);
    },
    [resubmitMutation]
  );

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // 승인 대기 목록 (관리자용)
    pendingPostings: pendingQuery.data ?? [],
    isLoadingPending: pendingQuery.isLoading,
    pendingError: pendingQuery.error,
    refetchPending: pendingQuery.refetch,

    // 내 대회공고 (구인자용)
    myPendingPostings: myPendingQuery.data ?? [],
    isLoadingMyPending: myPendingQuery.isLoading,
    myPendingError: myPendingQuery.error,
    refetchMyPending: myPendingQuery.refetch,

    // 승인 mutation
    approve: {
      mutate: approve,
      mutateAsync: async (data: { postingId: string }) => {
        return approveMutation.mutateAsync(data.postingId);
      },
      isPending: approveMutation.isPending,
    },

    // 거부 mutation
    reject: {
      mutate: reject,
      mutateAsync: rejectMutation.mutateAsync,
      isPending: rejectMutation.isPending,
    },

    // 재제출 mutation
    resubmit: {
      mutate: resubmit,
      mutateAsync: async (data: { postingId: string }) => {
        return resubmitMutation.mutateAsync(data.postingId);
      },
      isPending: resubmitMutation.isPending,
    },

    // 처리 중 여부
    isProcessing:
      approveMutation.isPending || rejectMutation.isPending || resubmitMutation.isPending,
  };
}

// ============================================================================
// Additional Hooks
// ============================================================================

/**
 * 대회공고 상세 조회 훅
 */
export function useTournamentDetail(postingId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournaments.detail(postingId),
    queryFn: () => tournamentApprovalService.getById(postingId),
    staleTime: cachingPolicies.standard,
    enabled: enabled && !!postingId,
  });
}

/**
 * 특정 상태의 대회공고 목록 조회 훅
 */
export function useTournamentsByStatus(status: TournamentApprovalStatus, enabled = true) {
  const queryKey =
    status === STATUS.TOURNAMENT.PENDING
      ? queryKeys.tournaments.pending()
      : status === STATUS.TOURNAMENT.APPROVED
        ? queryKeys.tournaments.approved()
        : queryKeys.tournaments.rejected();

  return useQuery({
    queryKey,
    queryFn: () => tournamentApprovalService.getByStatus(status),
    staleTime: cachingPolicies.frequent,
    enabled,
  });
}

export default useTournamentApproval;
