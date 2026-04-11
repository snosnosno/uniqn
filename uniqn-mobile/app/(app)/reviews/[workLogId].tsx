import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Loading, ErrorState } from '@/components/ui';
import ReviewCard from '@/components/review/ReviewCard';
import ReviewBlindMessage from '@/components/review/ReviewBlindMessage';
import { Button } from '@/components/ui/Button';
import { resolveReviewerType } from '@/domains/review';
import { useWorkLogReviews } from '@/hooks/useReviews';
import { useAuth } from '@/hooks/useAuth';
import { getReviewTextFallback, type ReviewerType } from '@/types/review';

export default function ReviewDetailScreen() {
  const {
    workLogId,
    reviewerType,
    revieweeId,
    revieweeName,
    jobPostingId,
    jobPostingTitle,
    workDate,
  } = useLocalSearchParams<{
    workLogId: string;
    reviewerType: string;
    revieweeId: string;
    revieweeName: string;
    jobPostingId: string;
    jobPostingTitle: string;
    workDate: string;
  }>();
  const { profile } = useAuth();

  const myReviewerType: ReviewerType = resolveReviewerType(reviewerType, profile?.role);
  const goToHistory = useCallback(() => {
    router.replace('/(app)/reviews/history');
  }, []);
  const { data, isLoading, error, refetch } = useWorkLogReviews(workLogId, myReviewerType);
  const fallbackRevieweeName = myReviewerType === 'employer' ? '스태프' : '구인자';
  const resolvedRevieweeName =
    getReviewTextFallback(
      revieweeName,
      data?.myReview?.revieweeName,
      data?.opponentReview?.reviewerName,
      fallbackRevieweeName
    ) ?? fallbackRevieweeName;
  const resolvedJobPostingTitle =
    getReviewTextFallback(
      jobPostingTitle,
      data?.myReview?.jobPostingTitle,
      data?.opponentReview?.jobPostingTitle,
      '공고'
    ) ?? '공고';
  const canNavigateToWrite = Boolean(revieweeId && jobPostingId);

  const openWriteScreen = useCallback(() => {
    if (!workLogId || !canNavigateToWrite) {
      return;
    }

    router.push({
      pathname: '/(app)/reviews/write',
      params: {
        workLogId,
        revieweeId,
        revieweeName: resolvedRevieweeName,
        reviewerType: myReviewerType,
        jobPostingId,
        jobPostingTitle: resolvedJobPostingTitle,
        workDate,
      },
    });
  }, [
    canNavigateToWrite,
    jobPostingId,
    myReviewerType,
    revieweeId,
    resolvedRevieweeName,
    resolvedJobPostingTitle,
    workDate,
    workLogId,
  ]);

  if (!workLogId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
        <ErrorState
          title="잘못된 접근입니다"
          message="리뷰 정보를 확인할 수 없습니다."
          onRetry={goToHistory}
          retryText="히스토리로 이동"
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading variant="layout" message="리뷰 정보를 불러오는 중..." />;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1">
          <ErrorState
            title="리뷰를 불러올 수 없습니다"
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
          <View className="px-8 pb-8">
            <Button variant="outline" onPress={goToHistory} fullWidth>
              히스토리로 이동
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hasMyReview = Boolean(data?.myReview);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <View>
          <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            내 리뷰
          </Text>
          {data?.myReview ? (
            <ReviewCard review={data.myReview} showReviewer={false} />
          ) : canNavigateToWrite ? (
            <Pressable
              onPress={openWriteScreen}
              className="items-center rounded-md border border-dashed border-gray-300 bg-white py-8 active:opacity-80 dark:border-gray-600 dark:bg-gray-800"
            >
              <Text className="text-sm text-primary-500 dark:text-primary-400">리뷰 작성하기</Text>
            </Pressable>
          ) : (
            <View className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Text className="text-sm text-gray-600 dark:text-gray-300">
                리뷰 작성에 필요한 정보를 확인할 수 없어요.
              </Text>
              <View className="mt-3">
                <Button variant="outline" onPress={goToHistory} fullWidth>
                  히스토리로 이동
                </Button>
              </View>
            </View>
          )}
        </View>

        <View>
          <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            상대방 리뷰
          </Text>
          {data?.canViewOpponent && data?.opponentReview ? (
            <ReviewCard review={data.opponentReview} showReviewer={false} />
          ) : (
            <ReviewBlindMessage hasMyReview={hasMyReview} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
