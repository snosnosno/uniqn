/**
 * UNIQN Mobile - Review Hooks
 *
 * @description 리뷰/평가(버블) 시스템 커스텀 훅
 * @version 1.1.0
 */

import { useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';
import { invalidateRelated } from '@/lib/invalidationStrategy';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { errorHandlerPresets } from '@/shared/errors/hookErrorHandler';
import * as reviewService from '@/services/reviewService';
import { getMySchedules } from '@/services/scheduleService';
import { workLogRepository } from '@/repositories';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import type { CreateReviewInput, ReviewerType } from '@/types/review';
import type { ScheduleEvent, WorkLog } from '@/types';
import type { Timestamp } from 'firebase/firestore';
import type { CreateReviewContext, ReviewPaginationCursor } from '@/repositories';

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
    queryKey: [...queryKeys.reviews.byWorkLog(workLogId ?? ''), myReviewerType, currentUserId],
    queryFn: () => reviewService.getReviewsWithBlindCheck(workLogId!, myReviewerType, currentUserId!),
    enabled: !!workLogId && !!currentUserId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

/**
 * 받은 리뷰 목록 조회 (커서 기반 무한 스크롤)
 */
export function useReceivedReviews(revieweeId: string | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.myReceived(),
    queryFn: async ({ pageParam }) => {
      return reviewService.getReceivedReviews(
        revieweeId!,
        pageSize,
        pageParam as ReviewPaginationCursor | undefined
      );
    },
    initialPageParam: undefined as ReviewPaginationCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!revieweeId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

/**
 * 작성한 리뷰 목록 조회 (커서 기반 무한 스크롤)
 */
export function useGivenReviews(reviewerId: string | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.myGiven(),
    queryFn: async ({ pageParam }) => {
      return reviewService.getGivenReviews(
        reviewerId!,
        pageSize,
        pageParam as ReviewPaginationCursor | undefined
      );
    },
    initialPageParam: undefined as ReviewPaginationCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
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
// Helpers
// ============================================================================

/** checkOutTime → ms 변환 (Timestamp | Date | string 지원) */
function toBaseTime(checkOutTime: unknown, fallbackDate: string): number {
  if (checkOutTime) {
    if (checkOutTime instanceof Date) return checkOutTime.getTime();
    if (typeof checkOutTime === 'string') return new Date(checkOutTime).getTime();
    return (checkOutTime as Timestamp).toDate().getTime();
  }
  return new Date(fallbackDate).getTime();
}

/** 7일 기한 내인지 확인 */
function isWithinDeadline(checkOutTime: unknown, date: string): boolean {
  const baseTime = toBaseTime(checkOutTime, date);
  const daysDiff = (Date.now() - baseTime) / (1000 * 60 * 60 * 24);
  return daysDiff >= 0 && daysDiff <= REVIEW_DEADLINE_DAYS;
}

// ============================================================================
// Pending Reviews
// ============================================================================

/**
 * 미작성 평가 항목 (UI용 정규화된 데이터)
 */
export interface PendingReviewItem {
  workLogId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  workDate: string;
  location: string;
  reviewerType: ReviewerType;
  revieweeId: string;
  revieweeName: string;
  checkOutTime?: unknown;
}

/**
 * 미작성 평가 목록
 *
 * - Staff: getMySchedules → 완료된 근무 중 staff 리뷰 미작성 항목
 * - Employer: getCompletedByOwnerId → 소유 워크로그 중 employer 리뷰 미작성 항목
 * - givenWorkLogIds를 `${workLogId}_${reviewerType}` 키로 구분하여 정확한 중복 체크
 */
export function usePendingReviews() {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.uid;
  const isEmployer = profile?.role === 'employer' || profile?.role === 'admin';

  // Staff-side: 내 스케줄 (스태프로 참여한 근무)
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: [...queryKeys.reviews.pending(), 'staff'],
    queryFn: async () => {
      if (!userId) return [];
      const result = await getMySchedules(userId);
      return result.schedules;
    },
    enabled: !!userId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  // Employer-side: 내가 소유한 완료된 워크로그
  const { data: employerWorkLogs = [], isLoading: employerLoading } = useQuery({
    queryKey: [...queryKeys.reviews.pending(), 'employer'],
    queryFn: () => workLogRepository.getCompletedByOwnerId(userId!),
    enabled: !!userId && isEmployer,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  // 내 작성 리뷰 (dedup용 — 첫 페이지만 조회, pending은 7일 이내이므로 충분)
  const { data: givenPage, isLoading: reviewsLoading } = useQuery({
    queryKey: [...queryKeys.reviews.myGiven(), 'pending-dedup'],
    queryFn: () => reviewService.getGivenReviews(userId!),
    enabled: !!userId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const pendingReviews = useMemo(() => {
    const givenReviews = givenPage?.items ?? [];
    // givenReviews를 ${workLogId}_${reviewerType} 키로 관리 — 역할별 중복 체크
    const givenSet = new Set(
      givenReviews.map((r) => `${r.workLogId}_${r.reviewerType}`)
    );

    const items: PendingReviewItem[] = [];

    // 1) Staff-side pending
    for (const s of schedules as ScheduleEvent[]) {
      if (!s.workLogId || !s.ownerId) continue;
      const isWorkCompleted = s.status === 'checked_out' || s.type === 'completed';
      if (!isWorkCompleted) continue;
      if (!isWithinDeadline(s.checkOutTime, s.date)) continue;
      if (givenSet.has(`${s.workLogId}_staff`)) continue;
      items.push({
        workLogId: s.workLogId,
        jobPostingId: s.jobPostingId,
        jobPostingTitle: s.jobPostingName,
        workDate: s.date,
        location: s.location,
        reviewerType: 'staff',
        revieweeId: s.ownerId,
        revieweeName: s.jobPostingName,
        checkOutTime: s.checkOutTime,
      });
    }

    // 2) Employer-side pending
    if (isEmployer) {
      for (const wl of employerWorkLogs as WorkLog[]) {
        if (!wl.id || !wl.ownerId) continue;
        if (!isWithinDeadline(wl.checkOutTime, wl.date)) continue;
        if (givenSet.has(`${wl.id}_employer`)) continue;
        items.push({
          workLogId: wl.id,
          jobPostingId: wl.jobPostingId,
          jobPostingTitle: '',
          workDate: wl.date,
          location: '',
          reviewerType: 'employer',
          revieweeId: wl.staffId,
          revieweeName: wl.staffName ?? wl.staffNickname ?? '스태프',
          checkOutTime: wl.checkOutTime,
        });
      }
    }

    return items;
  }, [schedules, employerWorkLogs, givenPage, isEmployer]);

  return {
    pendingReviews,
    pendingCount: pendingReviews.length,
    isLoading: schedulesLoading || reviewsLoading || (isEmployer && employerLoading),
  };
}
