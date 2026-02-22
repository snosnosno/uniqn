/**
 * UNIQN Mobile - Review Write Screen
 * 평가 작성 화면
 */

import { useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorState } from '@/components/ui';
import ReviewForm from '@/components/review/ReviewForm';
import { useCreateReview } from '@/hooks/useReviews';
import { REVIEWER_TYPES } from '@/types/review';
import type { ReviewerType } from '@/types/review';
import type { ReviewFormSchema } from '@/schemas/review.schema';

function isValidReviewerType(value: string | undefined): value is ReviewerType {
  return !!value && (REVIEWER_TYPES as readonly string[]).includes(value);
}

export default function ReviewWriteScreen() {
  const params = useLocalSearchParams<{
    workLogId: string;
    revieweeId: string;
    revieweeName: string;
    reviewerType: string;
    jobPostingId: string;
    jobPostingTitle: string;
    workDate: string;
  }>();

  const reviewerType = useMemo<ReviewerType | null>(
    () => (isValidReviewerType(params.reviewerType) ? params.reviewerType : null),
    [params.reviewerType]
  );

  const createReviewMutation = useCreateReview();
  const { mutate } = createReviewMutation;

  const handleSubmit = useCallback(
    (values: ReviewFormSchema) => {
      if (!reviewerType || !params.workLogId || !params.revieweeId) return;
      mutate(
        {
          workLogId: params.workLogId,
          jobPostingId: params.jobPostingId,
          jobPostingTitle: params.jobPostingTitle,
          workDate: params.workDate,
          revieweeId: params.revieweeId,
          revieweeName: params.revieweeName,
          reviewerType,
          sentiment: values.sentiment,
          tags: values.tags,
          comment: values.comment,
        },
        {
          onSuccess: () => {
            router.back();
          },
        }
      );
    },
    [params, reviewerType, mutate]
  );

  // 필수 파라미터 검증
  if (!params.workLogId || !params.revieweeId || !reviewerType) {
    return <ErrorState title="잘못된 접근입니다" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        <ReviewForm
          reviewerType={reviewerType}
          revieweeName={params.revieweeName}
          onSubmit={handleSubmit}
          isSubmitting={createReviewMutation.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
