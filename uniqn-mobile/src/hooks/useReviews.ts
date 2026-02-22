/**
 * UNIQN Mobile - Review Hooks
 *
 * @description 리뷰/평가(버블) 시스템 커스텀 훅
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';
import { invalidateRelated } from '@/lib/invalidationStrategy';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { errorHandlerPresets } from '@/shared/errors/hookErrorHandler';
import * as reviewService from '@/services/reviewService';
import { getMySchedules } from '@/services/scheduleService';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import type { CreateReviewInput, ReviewerType } from '@/types/review';
import type { ScheduleEvent } from '@/types';
import type { CreateReviewContext } from '@/repositories';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * 블라인드 리뷰 조회
 *
 * @param workLogId - 근무 기록 ID
 * @param myReviewerType - 내 평가자 유형
 */
export function useWorkLogReviews(workLogId: string | undefined, myReviewerType: ReviewerType) {
  const currentUserId = useAuthStore((s) => s.profile?.uid);
  return useQuery({
    queryKey: [...queryKeys.reviews.byWorkLog(workLogId ?? ''), myReviewerType],
    queryFn: () => reviewService.getReviewsWithBlindCheck(workLogId!, myReviewerType, currentUserId!),
    enabled: !!workLogId && !!currentUserId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

/**
 * 받은 리뷰 목록 조회
 */
export function useReceivedReviews(revieweeId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.reviews.myReceived(), limit],
    queryFn: () => reviewService.getReceivedReviews(revieweeId!, limit),
    enabled: !!revieweeId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

/**
 * 작성한 리뷰 목록 조회
 */
export function useGivenReviews(reviewerId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.reviews.myGiven(), limit],
    queryFn: () => reviewService.getGivenReviews(reviewerId!, limit),
    enabled: !!reviewerId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * 리뷰 생성 뮤테이션
 */
export function useCreateReview() {
  const addToast = useToastStore((s) => s.addToast);
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: (input: CreateReviewInput) => {
      if (!profile?.uid) {
        return Promise.reject(new Error('로그인이 필요합니다'));
      }
      const context: CreateReviewContext = {
        reviewerId: profile.uid,
        reviewerName: profile.nickname ?? profile.name ?? '',
      };
      return reviewService.createReview(input, context);
    },
    onSuccess: (_reviewId, input) => {
      useToastStore.getState().success('평가가 완료되었습니다');
      invalidateRelated('review.create', {
        workLogId: input.workLogId,
        revieweeId: input.revieweeId,
      });
    },
    onError: errorHandlerPresets.review(addToast),
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * 현재 사용자의 버블 점수
 */
export function useBubbleScore() {
  const profile = useAuthStore((s) => s.profile);
  return profile?.bubbleScore ?? null;
}

// ============================================================================
// Pending Reviews
// ============================================================================

/**
 * 미작성 평가 목록
 *
 * 완료된 근무 중 평가 미작성 + 기한(7일) 내 항목을 반환.
 * schedules.mine 결과에서 클라이언트 필터링.
 */
export function usePendingReviews() {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.uid;

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: queryKeys.reviews.pending(),
    queryFn: async () => {
      if (!userId) return [];
      const result = await getMySchedules(userId);
      return result.schedules;
    },
    enabled: !!userId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const { data: givenReviews = [], isLoading: reviewsLoading } = useGivenReviews(userId);

  const pendingReviews = useMemo(() => {
    const givenWorkLogIds = new Set(givenReviews.map((r) => r.workLogId));
    const now = Date.now();

    return (schedules as ScheduleEvent[]).filter((s) => {
      // 필수 필드 확인
      if (!s.workLogId || !s.ownerId) return false;
      // 완료된 근무만
      // - status(AttendanceStatus) 'checked_out': 퇴근 완료 + 정산 완료(WorkLogStatus.completed → checked_out)
      // - type(ScheduleType) 'completed': Application 소스 이벤트의 안전망
      const isWorkCompleted = s.status === 'checked_out' || s.type === 'completed';
      if (!isWorkCompleted) return false;
      // 7일 기한 내 (checkOutTime 우선, 없으면 date 기준 — ReviewValidator.isExpired와 일관)
      let baseTime: number;
      if (s.checkOutTime) {
        const cot = s.checkOutTime;
        if (cot instanceof Date) {
          baseTime = cot.getTime();
        } else if (typeof cot === 'string') {
          baseTime = new Date(cot).getTime();
        } else {
          baseTime = cot.toDate().getTime();
        }
      } else {
        baseTime = new Date(s.date).getTime();
      }
      const daysDiff = (now - baseTime) / (1000 * 60 * 60 * 24);
      if (daysDiff > REVIEW_DEADLINE_DAYS || daysDiff < 0) return false;
      // 이미 작성한 리뷰 제외
      return !givenWorkLogIds.has(s.workLogId);
    });
  }, [schedules, givenReviews]);

  return {
    pendingReviews,
    pendingCount: pendingReviews.length,
    isLoading: schedulesLoading || reviewsLoading,
  };
}
