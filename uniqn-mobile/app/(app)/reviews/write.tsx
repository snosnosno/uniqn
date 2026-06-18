import { useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import ReviewForm from '@/components/review/ReviewForm';
import { isReviewerType } from '@/domains/review';
import { useCreateReview } from '@/hooks/useReviews';
import { getReviewTextFallback, type ReviewerType } from '@/types/review';
import type { ReviewFormSchema } from '@/schemas/review.schema';

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
    () => (isReviewerType(params.reviewerType) ? params.reviewerType : null),
    [params.reviewerType]
  );
  const fallbackRevieweeName = reviewerType === 'employer' ? '스태프' : '구인자';
  const resolvedRevieweeName = useMemo(
    () => getReviewTextFallback(params.revieweeName, fallbackRevieweeName) ?? fallbackRevieweeName,
    [fallbackRevieweeName, params.revieweeName]
  );
  const resolvedJobPostingTitle = useMemo(
    () => getReviewTextFallback(params.jobPostingTitle, '공고') ?? '공고',
    [params.jobPostingTitle]
  );

  const createReviewMutation = useCreateReview();
  const { mutate } = createReviewMutation;
  const goToHistory = useCallback(() => {
    router.replace('/(app)/reviews/history');
  }, []);

  const handleSubmit = useCallback(
    (values: ReviewFormSchema) => {
      if (!reviewerType || !params.workLogId || !params.revieweeId || !params.jobPostingId) {
        return;
      }

      mutate(
        {
          workLogId: params.workLogId,
          jobPostingId: params.jobPostingId,
          jobPostingTitle: resolvedJobPostingTitle,
          workDate: params.workDate,
          revieweeId: params.revieweeId,
          revieweeName: resolvedRevieweeName,
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
    [mutate, params, resolvedJobPostingTitle, resolvedRevieweeName, reviewerType]
  );

  if (!params.workLogId || !params.revieweeId || !params.jobPostingId || !reviewerType) {
    return (
      <SafeAreaView className="flex-1 bg-surface-card" edges={['top', 'bottom']}>
        <StackHeader title="평가 작성" fallbackHref="/(app)/reviews/pending" />
        <View className="flex-1">
          <ErrorState
            title="잘못된 접근입니다"
            message="리뷰 작성에 필요한 정보를 확인할 수 없습니다."
            onRetry={goToHistory}
            retryText="히스토리로 이동"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-card" edges={['top', 'bottom']}>
      <StackHeader title="평가 작성" fallbackHref="/(app)/reviews/pending" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow p-4 pb-8"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <ReviewForm
            reviewerType={reviewerType}
            revieweeName={resolvedRevieweeName}
            onSubmit={handleSubmit}
            isSubmitting={createReviewMutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
