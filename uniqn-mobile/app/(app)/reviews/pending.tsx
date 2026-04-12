/**
 * UNIQN Mobile - Pending Reviews Screen
 * 미작성 평가 목록 화면
 *
 * @description 완료된 근무 중 아직 평가하지 않은 항목 표시 (기한 7일)
 */

import { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EmptyState, Skeleton } from '@/components/ui';
import { usePendingReviews } from '@/hooks/useReviews';
import type { PendingReviewItem } from '@/hooks/useReviews';
import { getReviewDaysRemaining } from '@/domains/review/reviewDeadline';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';

/**
 * D-day 계산 — checkOutTime 우선, 없으면 workDate 기준
 * ReviewValidator.isExpired와 동일한 기준 사용
 */
function getDaysRemaining(item: PendingReviewItem): number {
  return getReviewDaysRemaining(item.checkOutTime, item.workDate);
}

interface PendingReviewCardProps {
  item: PendingReviewItem;
  onPress: () => void;
}

function PendingReviewCard({ item, onPress }: PendingReviewCardProps) {
  const daysRemaining = getDaysRemaining(item);
  const isUrgent = daysRemaining <= 2;
  const workDateLabel = item.workDate || '날짜 미정';

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-md border border-secondary-200 bg-white p-4 active:opacity-80 dark:border-surface-overlay dark:bg-surface"
      accessibilityLabel={`${item.jobPostingTitle} 평가하기`}
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text
            className="text-base font-sans-semibold text-secondary-900 dark:text-off-white"
            numberOfLines={1}
          >
            {item.jobPostingTitle}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              {workDateLabel}
              {item.location ? ` · ${item.location}` : ''}
            </Text>
            {item.reviewerType === 'employer' && (
              <View className="rounded bg-info-100 px-1.5 py-0.5 dark:bg-info-900/30">
                <Text className="text-xs text-info-700 dark:text-info-300 font-sans">
                  구인자 평가
                </Text>
              </View>
            )}
          </View>
        </View>
        <View
          className={`rounded-sm px-2.5 py-1 ${isUrgent ? 'bg-error-50 dark:bg-error-900/30' : 'bg-warning-100 dark:bg-warning-900/30'}`}
        >
          <Text
            className={`text-xs font-sans-medium ${isUrgent ? 'text-error-700 dark:text-error-300' : 'text-warning-700 dark:text-warning-300'}`}
          >
            D-{daysRemaining}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs text-secondary-400 dark:text-secondary-500 font-sans">
          근무 완료 후 {REVIEW_DEADLINE_DAYS}일 이내 평가 가능
        </Text>
        <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
          평가하기 →
        </Text>
      </View>
    </Pressable>
  );
}

export default function PendingReviewsScreen() {
  const { pendingReviews, pendingCount, isLoading } = usePendingReviews();

  const handlePress = useCallback((item: PendingReviewItem) => {
    router.push({
      pathname: '/(app)/reviews/write',
      params: {
        workLogId: item.workLogId,
        revieweeId: item.revieweeId,
        revieweeName: item.revieweeName,
        reviewerType: item.reviewerType,
        jobPostingId: item.jobPostingId,
        jobPostingTitle: item.jobPostingTitle,
        workDate: item.workDate,
      },
    });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {isLoading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <View key={i} className="mb-3 rounded-md bg-white p-4 dark:bg-surface">
                <Skeleton width="60%" height={20} />
                <Skeleton width="80%" height={16} className="mt-2" />
                <Skeleton width="40%" height={14} className="mt-3" />
              </View>
            ))}
          </View>
        ) : pendingCount === 0 ? (
          <EmptyState
            title="미작성 평가 없음"
            description="모든 평가를 완료했습니다"
            variant="content"
          />
        ) : (
          <View>
            <Text className="mb-3 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              작성 대기 {pendingCount}건
            </Text>
            {pendingReviews.map((item) => (
              <PendingReviewCard
                key={`${item.workLogId}_${item.reviewerType}`}
                item={item}
                onPress={() => handlePress(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
