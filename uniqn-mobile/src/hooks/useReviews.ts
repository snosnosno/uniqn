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
import { buildCurrentUserIdentitySnapshot } from '@/shared/profile/identity';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { WorkLog } from '@/types';
import {
  getReviewTextFallback,
  REVIEWABLE_STATUSES,
  REVIEW_DEADLINE_DAYS,
  type CreateReviewInput,
  type Review,
  type ReviewerType,
} from '@/types/review';
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
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const mutation = useMutation({
    mutationFn: (input: CreateReviewInput) => {
      if (!profile?.uid) {
        return Promise.reject(new Error('Login is required.'));
      }
      const identity = buildCurrentUserIdentitySnapshot({
        profile,
        authUser: user,
        fallbackName: '',
      });

      const context: CreateReviewContext = {
        reviewerId: profile.uid,
        reviewerName: identity.reviewName || '',
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

interface PendingReviewLookups {
  givenSet: Set<string>;
  jobPostingMap: Map<string, PendingReviewPostingInfo>;
  currentUserId?: string;
}

// 스태프→구인자 리뷰 항목. 가드: id+ownerId(staffId 불요), 키 `_staff`, self-exclusion=ownerId,
// title fallback 순서=jobPostingName 우선. 구인자 매퍼와 비대칭이므로 통합 금지.
function buildStaffPendingReviewItem(
  workLog: WorkLog,
  { givenSet, jobPostingMap, currentUserId }: PendingReviewLookups
): PendingReviewItem | null {
  if (!workLog.id || !workLog.ownerId) return null;
  if (!REVIEWABLE_STATUSES.has(workLog.status)) return null;
  if (!isWithinReviewDeadline(workLog.checkOutTime, workLog.date)) return null;
  if (givenSet.has(`${workLog.id}_staff`)) return null;
  if (currentUserId && workLog.ownerId === currentUserId) return null;

  const posting = jobPostingMap.get(workLog.jobPostingId);
  const jobPostingName = (workLog as WorkLog & { jobPostingName?: string }).jobPostingName;

  return {
    workLogId: workLog.id,
    jobPostingId: workLog.jobPostingId,
    jobPostingTitle: getReviewTextFallback(jobPostingName, posting?.title, '공고')!,
    workDate: workLog.date || '',
    location: posting?.location?.name ?? '',
    reviewerType: 'staff',
    revieweeId: workLog.ownerId,
    revieweeName: getReviewTextFallback(posting?.ownerName, '구인자')!,
    checkOutTime: workLog.checkOutTime,
  };
}

// 구인자→스태프 리뷰 항목. 가드: id+ownerId+staffId(staffId 추가), 키 `_employer`, self-exclusion=staffId,
// title fallback 순서=posting.title 우선(스태프 매퍼와 역순). 비대칭이므로 통합 금지.
function buildEmployerPendingReviewItem(
  workLog: WorkLog,
  { givenSet, jobPostingMap, currentUserId }: PendingReviewLookups
): PendingReviewItem | null {
  if (!workLog.id || !workLog.ownerId || !workLog.staffId) return null;
  if (!REVIEWABLE_STATUSES.has(workLog.status)) return null;
  if (!isWithinReviewDeadline(workLog.checkOutTime, workLog.date)) return null;
  if (givenSet.has(`${workLog.id}_employer`)) return null;
  if (currentUserId && workLog.staffId === currentUserId) return null;

  const posting = jobPostingMap.get(workLog.jobPostingId);
  const jobPostingName = (workLog as WorkLog & { jobPostingName?: string }).jobPostingName;

  return {
    workLogId: workLog.id,
    jobPostingId: workLog.jobPostingId,
    jobPostingTitle: getReviewTextFallback(posting?.title, jobPostingName, '공고')!,
    workDate: workLog.date || '',
    location: posting?.location?.name ?? '',
    reviewerType: 'employer',
    revieweeId: workLog.staffId,
    revieweeName: getReviewTextFallback(workLog.staffName, workLog.staffNickname, '스태프')!,
    checkOutTime: workLog.checkOutTime,
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
  const lookups: PendingReviewLookups = { givenSet, jobPostingMap, currentUserId };

  const staffItems = staffWorkLogs
    .map((workLog) => buildStaffPendingReviewItem(workLog, lookups))
    .filter((item): item is PendingReviewItem => item !== null);

  const employerItems = isEmployerReviewer
    ? employerWorkLogs
        .map((workLog) => buildEmployerPendingReviewItem(workLog, lookups))
        .filter((item): item is PendingReviewItem => item !== null)
    : [];

  // staff 전체 → employer 전체 concat 순서 보존 후 안정 정렬(원본 push 순서와 동일).
  return [...staffItems, ...employerItems].sort(comparePendingReviewItems);
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
