/**
 * UNIQN Mobile - PendingReviewCard
 * 미작성 평가 카드 컴포넌트 (pending.tsx 에서 추출, DRY)
 */

import { View, Text, Pressable } from 'react-native';
import { CardStripe, NumericText } from '@/components/ui';
import type { PendingReviewItem } from '@/hooks/useReviews';
import { getReviewDaysRemaining } from '@/domains/review/reviewDeadline';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import { REVIEW_CONTEXT_STRIPE_TONE } from '@/components/review/helpers/reviewConfig';

/**
 * D-day 계산 — checkOutTime 우선, 없으면 workDate 기준
 * ReviewValidator.isExpired와 동일한 기준 사용
 */
function getDaysRemaining(item: PendingReviewItem): number {
  return getReviewDaysRemaining(item.checkOutTime, item.workDate);
}

export interface PendingReviewCardProps {
  item: PendingReviewItem;
  onPress: () => void;
}

export default function PendingReviewCard({ item, onPress }: PendingReviewCardProps) {
  const daysRemaining = getDaysRemaining(item);
  const isUrgent = daysRemaining <= 2;
  const workDateLabel = item.workDate || '날짜 미정';

  return (
    <CardStripe tone={REVIEW_CONTEXT_STRIPE_TONE.pending} style={{ marginBottom: 12 }}>
      <Pressable
        onPress={onPress}
        className="rounded-md bg-white pl-4 p-4 active:opacity-80 dark:bg-surface"
        accessibilityLabel={`${item.jobPostingTitle} 평가하기`}
        accessibilityRole="button"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text
              className="text-base font-sans-bold text-content-primary dark:text-off-white"
              style={{ letterSpacing: -0.32 }}
              numberOfLines={1}
            >
              {item.jobPostingTitle}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-sm text-content-secondary font-sans">
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
            <NumericText
              className={`text-xs font-sans-bold ${isUrgent ? 'text-error-700 dark:text-error-300' : 'text-warning-700 dark:text-warning-300'}`}
            >
              D-{daysRemaining}
            </NumericText>
          </View>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs text-content-placeholder font-sans">
            퇴근 후 {REVIEW_DEADLINE_DAYS}일 이내 평가 가능
          </Text>
          <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
            평가하기 →
          </Text>
        </View>
      </Pressable>
    </CardStripe>
  );
}
