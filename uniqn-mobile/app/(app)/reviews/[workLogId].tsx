/**
 * UNIQN Mobile - Review Detail Screen
 * 양방향 리뷰 상세 화면 (블라인드 적용)
 */

import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Loading, ErrorState } from '@/components/ui';
import ReviewCard from '@/components/review/ReviewCard';
import ReviewBlindMessage from '@/components/review/ReviewBlindMessage';
import { useWorkLogReviews } from '@/hooks/useReviews';
import { useAuth } from '@/hooks/useAuth';
import { REVIEWER_TYPES } from '@/types/review';
import type { ReviewerType } from '@/types/review';

export default function ReviewDetailScreen() {
  const { workLogId, reviewerType, revieweeId, revieweeName, jobPostingId, jobPostingTitle, workDate } =
    useLocalSearchParams<{
      workLogId: string;
      reviewerType: string;
      revieweeId: string;
      revieweeName: string;
      jobPostingId: string;
      jobPostingTitle: string;
      workDate: string;
    }>();
  const { profile } = useAuth();

  const myReviewerType: ReviewerType =
    reviewerType && (REVIEWER_TYPES as readonly string[]).includes(reviewerType)
      ? (reviewerType as ReviewerType)
      : profile?.role === 'employer'
        ? 'employer'
        : 'staff';

  const { data, isLoading, error } = useWorkLogReviews(workLogId, myReviewerType);

  if (isLoading) {
    return <Loading variant="layout" />;
  }

  if (error) {
    return <ErrorState title="리뷰를 불러올 수 없습니다" />;
  }

  const hasMyReview = !!data?.myReview;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
        {/* 내 평가 */}
        <View>
          <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            내 평가
          </Text>
          {data?.myReview ? (
            <ReviewCard review={data.myReview} showReviewer={false} />
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/reviews/write',
                  params: {
                    workLogId,
                    revieweeId,
                    revieweeName,
                    reviewerType: myReviewerType,
                    jobPostingId,
                    jobPostingTitle,
                    workDate,
                  },
                })
              }
              className="items-center rounded-xl border border-dashed border-gray-300 bg-white py-8 active:opacity-80 dark:border-gray-600 dark:bg-gray-800"
            >
              <Text className="text-sm text-primary-500 dark:text-primary-400">
                평가 작성하기
              </Text>
            </Pressable>
          )}
        </View>

        {/* 상대방 평가 */}
        <View>
          <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            상대방 평가
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
