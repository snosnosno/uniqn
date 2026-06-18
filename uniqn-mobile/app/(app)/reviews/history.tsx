/**
 * UNIQN Mobile - Review History Screen
 * 평가 히스토리 화면 (받은 평가 + 작성한 평가 탭)
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { StackHeader } from '@/components/headers';
import { EmptyState, NumericText } from '@/components/ui';
import ReviewCard from '@/components/review/ReviewCard';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { REVIEW_CONTEXT_STRIPE_TONE } from '@/components/review/helpers/reviewConfig';
import { useReceivedReviews, useGivenReviews, useBubbleScore } from '@/hooks/useReviews';
import { useAuthStore } from '@/stores/authStore';
import type { Review } from '@/types/review';

type TabType = 'received' | 'given';

export default function ReviewHistoryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const bubbleScore = useBubbleScore();
  const [activeTab, setActiveTab] = useState<TabType>('received');

  const received = useReceivedReviews(profile?.uid);
  const given = useGivenReviews(profile?.uid);

  const activeData = activeTab === 'received' ? received : given;
  const reviews = useMemo(
    () => activeData.data?.pages.flatMap((p) => p.items) ?? [],
    [activeData.data]
  );

  const handleEndReached = useCallback(() => {
    if (activeData.hasNextPage && !activeData.isFetchingNextPage) {
      activeData.fetchNextPage();
    }
  }, [activeData]);

  const renderItem = useCallback(
    ({ item }: { item: Review }) => (
      <View className="px-4 py-1.5">
        <ReviewCard review={item} stripeTone={REVIEW_CONTEXT_STRIPE_TONE.history} />
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: Review) => `${item.workLogId}_${item.reviewerType}`, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="평가 히스토리" fallbackHref="/(app)/(tabs)/profile" />
      {/* 버블 점수 요약 카드 */}
      {bubbleScore && <ScoreSummary bubbleScore={bubbleScore} />}

      {/* 탭 바 */}
      <View className="flex-row border-b border-secondary-200 dark:border-secondary-700">
        <TabButton
          label="받은 평가"
          isActive={activeTab === 'received'}
          onPress={() => setActiveTab('received')}
        />
        <TabButton
          label="작성한 평가"
          isActive={activeTab === 'given'}
          onPress={() => setActiveTab('given')}
        />
      </View>

      {/* 리뷰 리스트 */}
      {activeData.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <AppFlashList
          data={reviews}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={140}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'received' ? '받은 평가가 없습니다' : '작성한 평가가 없습니다'}
              description="근무 완료 후 평가가 생성됩니다"
            />
          }
          ListFooterComponent={
            activeData.isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ScoreSummaryData {
  score: number;
  totalReviewCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

function ScoreSummary({ bubbleScore }: { bubbleScore: ScoreSummaryData }) {
  return (
    <View className="mx-4 mt-3 mb-2 rounded-md bg-white p-4 dark:bg-secondary-800">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <NumericText
            className="text-2xl font-sans-bold text-content-primary dark:text-secondary-100"
            style={{ letterSpacing: -0.32 }}
          >
            {bubbleScore.score.toFixed(1)}
          </NumericText>
          <BubbleScoreBadge score={bubbleScore.score} size="md" />
        </View>
        <NumericText className="text-xs text-content-secondary font-sans">
          총 {bubbleScore.totalReviewCount}건
        </NumericText>
      </View>
      <View className="mt-3 flex-row gap-4">
        <StatItem dotColor="bg-success-500" count={bubbleScore.positiveCount} label="긍정" />
        <StatItem
          dotColor="bg-secondary-400 dark:bg-secondary-500"
          count={bubbleScore.neutralCount}
          label="보통"
        />
        <StatItem dotColor="bg-error-500" count={bubbleScore.negativeCount} label="부정" />
      </View>
    </View>
  );
}

function StatItem({ dotColor, count, label }: { dotColor: string; count: number; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-2 w-2 rounded-full ${dotColor}`} />
      <NumericText className="text-sm font-sans-bold text-content-secondary">{count}</NumericText>
      <Text className="text-xs text-content-secondary font-sans">{label}</Text>
    </View>
  );
}

function TabButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center py-3 ${isActive ? 'border-b-2 border-primary-500' : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className={`text-sm font-sans-medium ${
          isActive ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
