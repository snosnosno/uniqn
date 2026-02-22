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
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import type { Timestamp } from 'firebase/firestore';

/**
 * D-day 계산 — checkOutTime 우선, 없으면 workDate 기준
 * ReviewValidator.isExpired와 동일한 기준 사용
 */
function getDaysRemaining(item: PendingReviewItem): number {
  let baseTime: number;
  const cot = item.checkOutTime;

  if (cot) {
    if (cot instanceof Date) {
      baseTime = cot.getTime();
    } else if (typeof cot === 'string') {
      baseTime = new Date(cot).getTime();
    } else {
      baseTime = (cot as Timestamp).toDate().getTime();
    }
  } else {
    baseTime = new Date(item.workDate).getTime();
  }

  const diff = REVIEW_DEADLINE_DAYS - (Date.now() - baseTime) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(diff));
}

interface PendingReviewCardProps {
  item: PendingReviewItem;
  onPress: () => void;
}

function PendingReviewCard({ item, onPress }: PendingReviewCardProps) {
  const daysRemaining = getDaysRemaining(item);
  const isUrgent = daysRemaining <= 2;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-xl border border-gray-200 bg-white p-4 active:opacity-80 dark:border-surface-overlay dark:bg-surface"
      accessibilityLabel={`${item.jobPostingTitle} 평가하기`}
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
            {item.jobPostingTitle}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {item.workDate}{item.location ? ` · ${item.location}` : ''}
            </Text>
            {item.reviewerType === 'employer' && (
              <View className="rounded bg-blue-100 px-1.5 py-0.5 dark:bg-blue-900/30">
                <Text className="text-xs text-blue-700 dark:text-blue-300">구인자 평가</Text>
              </View>
            )}
          </View>
        </View>
        <View
          className={`rounded-full px-2.5 py-1 ${isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}
        >
          <Text
            className={`text-xs font-medium ${isUrgent ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}
          >
            D-{daysRemaining}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          근무 완료 후 {REVIEW_DEADLINE_DAYS}일 이내 평가 가능
        </Text>
        <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
          평가하기 →
        </Text>
      </View>
    </Pressable>
  );
}

export default function PendingReviewsScreen() {
  const { pendingReviews, pendingCount, isLoading } = usePendingReviews();

  const handlePress = useCallback(
    (item: PendingReviewItem) => {
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
    },
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {isLoading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <View key={i} className="mb-3 rounded-xl bg-white p-4 dark:bg-surface">
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
            <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
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
