import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { invalidateRelated } from '@/lib/invalidationStrategy';
import { queryCachingOptions, queryKeys } from '@/lib/queryClient';
import { isWithinReviewDeadline, resolveReviewerTypeFromRole } from '@/domains/review';
import { getReviewBaseTime } from '@/domains/review/reviewDeadline';
import { jobPostingRepository, workLogRepository } from '@/repositories';
import type { CreateReviewContext, ReviewPaginationCursor } from '@/repositories';
import { errorHandlerPresets } from '@/shared/errors/hookErrorHandler';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { WorkLog } from '@/types';
import { REVIEWABLE_STATUSES, REVIEW_DEADLINE_DAYS } from '@/types/review';
import type { CreateReviewInput, Review, ReviewerType } from '@/types/review';
import { toDateString, type DateInput } from '@/utils/date';
import * as reviewService from '@/services/reviewService';

export function useWorkLogReviews(workLogId: string | undefined, myReviewerType: ReviewerType) {
  const currentUserId = useAuthStore((state) => state.profile?.uid);

  return useQuery({
    queryKey: [...queryKeys.reviews.byWorkLog(workLogId ?? ''), myReviewerType, currentUserId],
    queryFn: () =>
      reviewService.getReviewsWithBlindCheck(workLogId!, myReviewerType, currentUserId!),
    enabled: !!workLogId && !!currentUserId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

export function useReceivedReviews(revieweeId: string | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.reviews.myReceived(), revieweeId ?? 'anonymous', pageSize],
    queryFn: async ({ pageParam }) =>
      reviewService.getReceivedReviews(
        revieweeId!,
        pageSize,
        pageParam as ReviewPaginationCursor | undefined
      ),
    initialPageParam: undefined as ReviewPaginationCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!revieweeId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

export function useGivenReviews(reviewerId: string | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.reviews.myGiven(), reviewerId ?? 'anonymous', pageSize],
    queryFn: async ({ pageParam }) =>
      reviewService.getGivenReviews(
        reviewerId!,
        pageSize,
        pageParam as ReviewPaginationCursor | undefined
      ),
    initialPageParam: undefined as ReviewPaginationCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!reviewerId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });
}

export function useCreateReview() {
  const addToast = useToastStore((state) => state.addToast);
  const profile = useAuthStore((state) => state.profile);

  const mutation = useMutation({
    mutationFn: (input: CreateReviewInput) => {
      if (!profile?.uid) {
        return Promise.reject(new Error('Login is required.'));
      }

      const context: CreateReviewContext = {
        reviewerId: profile.uid,
        reviewerName: profile.nickname ?? profile.name ?? '',
      };

      return reviewService.createReview(input, context);
    },
    onSuccess: (_reviewId, input) => {
      useToastStore.getState().success('평가가 완료되었습니다.');
      invalidateRelated('review.create', {
        workLogId: input.workLogId,
        revieweeId: input.revieweeId,
      });
    },
    onError: errorHandlerPresets.review(addToast),
  });

  return {
    ...mutation,
    mutate: useThrottledCallback(mutation.mutate, 1000),
  };
}

export function useBubbleScore() {
  const profile = useAuthStore((state) => state.profile);
  return profile?.bubbleScore ?? null;
}

export interface PendingReviewItem {
  workLogId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  workDate: string;
  location: string;
  reviewerType: ReviewerType;
  revieweeId: string;
  revieweeName: string;
  checkOutTime?: DateInput;
}

interface PendingReviewPostingInfo {
  title?: string;
  ownerName?: string;
  location?: {
    name?: string;
  } | null;
}

interface BuildPendingReviewItemsInput {
  staffWorkLogs: WorkLog[];
  employerWorkLogs: WorkLog[];
  givenReviews: Review[];
  isEmployerReviewer: boolean;
  jobPostingMap: Map<string, PendingReviewPostingInfo>;
  currentUserId?: string;
}

function mergeWorkLogsById(...groups: WorkLog[][]): WorkLog[] {
  const workLogMap = new Map<string, WorkLog>();

  for (const group of groups) {
    for (const workLog of group) {
      if (!workLog.id || workLogMap.has(workLog.id)) continue;
      workLogMap.set(workLog.id, workLog);
    }
  }

  return Array.from(workLogMap.values());
}

function comparePendingReviewItems(a: PendingReviewItem, b: PendingReviewItem): number {
  const baseTimeA = getReviewBaseTime(a.checkOutTime, a.workDate);
  const baseTimeB = getReviewBaseTime(b.checkOutTime, b.workDate);

  if (baseTimeA === null && baseTimeB === null) {
    return `${a.workLogId}_${a.reviewerType}`.localeCompare(`${b.workLogId}_${b.reviewerType}`);
  }

  if (baseTimeA === null) return 1;
  if (baseTimeB === null) return -1;
  if (baseTimeA !== baseTimeB) return baseTimeA - baseTimeB;

  return `${a.workLogId}_${a.reviewerType}`.localeCompare(`${b.workLogId}_${b.reviewerType}`);
}

function getPendingReviewDateRange(now = new Date()): { startDate: string; endDate: string } {
  const endDate = toDateString(now);
  const startDateValue = new Date(now);
  startDateValue.setDate(startDateValue.getDate() - REVIEW_DEADLINE_DAYS);

  return {
    startDate: toDateString(startDateValue),
    endDate,
  };
}

export function buildPendingReviewItems({
  staffWorkLogs,
  employerWorkLogs,
  givenReviews,
  isEmployerReviewer,
  jobPostingMap,
  currentUserId,
}: BuildPendingReviewItemsInput): PendingReviewItem[] {
  const givenSet = new Set(
    givenReviews.map((review) => `${review.workLogId}_${review.reviewerType}`)
  );
  const items: PendingReviewItem[] = [];

  for (const workLog of staffWorkLogs) {
    if (!workLog.id || !workLog.ownerId) continue;
    if (!REVIEWABLE_STATUSES.has(workLog.status)) continue;
    if (!isWithinReviewDeadline(workLog.checkOutTime, workLog.date)) continue;
    if (givenSet.has(`${workLog.id}_staff`)) continue;
    if (currentUserId && workLog.ownerId === currentUserId) continue;

    const posting = jobPostingMap.get(workLog.jobPostingId);
    const jobPostingName = (workLog as WorkLog & { jobPostingName?: string }).jobPostingName;

    items.push({
      workLogId: workLog.id,
      jobPostingId: workLog.jobPostingId,
      jobPostingTitle: jobPostingName || posting?.title || '',
      workDate: workLog.date || '',
      location: posting?.location?.name ?? '',
      reviewerType: 'staff',
      revieweeId: workLog.ownerId,
      revieweeName: posting?.ownerName || jobPostingName || posting?.title || '구인자',
      checkOutTime: workLog.checkOutTime,
    });
  }

  if (isEmployerReviewer) {
    for (const workLog of employerWorkLogs) {
      if (!workLog.id || !workLog.ownerId || !workLog.staffId) continue;
      if (!REVIEWABLE_STATUSES.has(workLog.status)) continue;
      if (!isWithinReviewDeadline(workLog.checkOutTime, workLog.date)) continue;
      if (givenSet.has(`${workLog.id}_employer`)) continue;
      if (currentUserId && workLog.staffId === currentUserId) continue;

      const posting = jobPostingMap.get(workLog.jobPostingId);
      const jobPostingName = (workLog as WorkLog & { jobPostingName?: string }).jobPostingName;

      items.push({
        workLogId: workLog.id,
        jobPostingId: workLog.jobPostingId,
        jobPostingTitle: posting?.title ?? jobPostingName ?? '',
        workDate: workLog.date || '',
        location: posting?.location?.name ?? '',
        reviewerType: 'employer',
        revieweeId: workLog.staffId,
        revieweeName: workLog.staffName ?? workLog.staffNickname ?? '스태프',
        checkOutTime: workLog.checkOutTime,
      });
    }
  }

  return items.sort(comparePendingReviewItems);
}

export function usePendingReviews() {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.uid;
  const reviewerType = resolveReviewerTypeFromRole(profile?.role);
  const isEmployerReviewer = reviewerType === 'employer';
  const pendingReviewDateRange = getPendingReviewDateRange();

  const { data: staffWorkLogs = [], isLoading: staffLoading } = useQuery({
    queryKey: [
      ...queryKeys.reviews.pending(),
      userId ?? 'anonymous',
      'staff-worklogs',
      pendingReviewDateRange.startDate,
      pendingReviewDateRange.endDate,
    ],
    queryFn: async () => {
      const [datedWorkLogs, undatedWorkLogs] = await Promise.all([
        workLogRepository.getByDateRange(
          userId!,
          pendingReviewDateRange.startDate,
          pendingReviewDateRange.endDate
        ),
        workLogRepository.getUndatedByStaffId(userId!),
      ]);

      return mergeWorkLogsById(datedWorkLogs, undatedWorkLogs);
    },
    enabled: !!userId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const { data: employerWorkLogs = [], isLoading: employerLoading } = useQuery({
    queryKey: [
      ...queryKeys.reviews.pending(),
      userId ?? 'anonymous',
      'employer',
      pendingReviewDateRange.startDate,
      pendingReviewDateRange.endDate,
    ],
    queryFn: async () => {
      const [datedWorkLogs, undatedWorkLogs] = await Promise.all([
        workLogRepository.getCompletedByOwnerId(userId!, {
          start: pendingReviewDateRange.startDate,
          end: pendingReviewDateRange.endDate,
        }),
        workLogRepository.getUndatedCompletedByOwnerId(userId!),
      ]);

      return mergeWorkLogsById(datedWorkLogs, undatedWorkLogs);
    },
    enabled: !!userId && isEmployerReviewer,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const uniqueJobPostingIds = useMemo(() => {
    return [
      ...new Set(
        [...(staffWorkLogs as WorkLog[]), ...(employerWorkLogs as WorkLog[])]
          .map((workLog) => workLog.jobPostingId)
          .filter((jobPostingId) => !!jobPostingId)
      ),
    ].sort();
  }, [employerWorkLogs, staffWorkLogs]);

  const { data: jobPostingMap = new Map(), isLoading: jobPostingsLoading } = useQuery({
    queryKey: [
      ...queryKeys.reviews.pending(),
      userId ?? 'anonymous',
      'jobpostings',
      ...uniqueJobPostingIds,
    ],
    queryFn: async () => {
      const postings = await jobPostingRepository.getByIdBatch(uniqueJobPostingIds);
      return new Map(postings.map((posting) => [posting.id, posting]));
    },
    enabled: uniqueJobPostingIds.length > 0,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const { data: givenPage, isLoading: reviewsLoading } = useQuery({
    queryKey: [...queryKeys.reviews.myGiven(), userId ?? 'anonymous', 'pending-dedup'],
    queryFn: () => reviewService.getGivenReviews(userId!),
    enabled: !!userId,
    staleTime: queryCachingOptions.reviews.staleTime,
    gcTime: queryCachingOptions.reviews.gcTime,
  });

  const pendingReviews = useMemo(
    () =>
      buildPendingReviewItems({
        staffWorkLogs: staffWorkLogs as WorkLog[],
        employerWorkLogs: employerWorkLogs as WorkLog[],
        givenReviews: givenPage?.items ?? [],
        isEmployerReviewer,
        jobPostingMap,
        currentUserId: userId,
      }),
    [staffWorkLogs, employerWorkLogs, givenPage, isEmployerReviewer, jobPostingMap, userId]
  );

  return {
    pendingReviews,
    pendingCount: pendingReviews.length,
    isLoading:
      staffLoading ||
      reviewsLoading ||
      jobPostingsLoading ||
      (isEmployerReviewer && employerLoading),
  };
}
