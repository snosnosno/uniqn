/**
 * UNIQN Mobile - 리뷰 카드 컴포넌트
 *
 * @description 개별 리뷰를 표시하는 카드
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { Review } from '@/types/review';
import { formatDate, toDate } from '@/utils/date';
import {
  SENTIMENT_EMOJI,
  SENTIMENT_LABELS,
  SENTIMENT_COLORS,
  getTagsForReviewerType,
} from '@/types/review';
import { CardStripe, type CardStripeTone } from '@/components/ui';

interface ReviewCardProps {
  review: Review;
  showReviewer?: boolean;
  /**
   * CardStripe tone — opt-in. 지정 시 좌측 3px 엣지 스트라이프 표시.
   * - 'gold': 평가 대기/작성 필요 컨텍스트
   * - 'muted': 이미 작성/수신한 리뷰 (히스토리)
   */
  stripeTone?: CardStripeTone;
}

export default React.memo(function ReviewCard({
  review,
  showReviewer = true,
  stripeTone,
}: ReviewCardProps) {
  const colors = SENTIMENT_COLORS[review.sentiment];
  const tagMap = useMemo(() => {
    const tags = getTagsForReviewerType(review.reviewerType);
    return new Map(tags.map((t) => [t.key, t.label]));
  }, [review.reviewerType]);

  const formattedDate = useMemo(() => {
    if (!review.createdAt) return '';
    const date = toDate(review.createdAt);
    return date ? formatDate(date) : '';
  }, [review.createdAt]);

  const cardBody = (
    <View
      className={
        stripeTone
          ? 'rounded-md bg-white pl-4 p-4 dark:bg-secondary-800'
          : 'rounded-md border border-secondary-200 bg-white p-4 dark:border-secondary-700 dark:bg-secondary-800'
      }
    >
      {/* 헤더 */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className={`rounded-sm px-2.5 py-1 ${colors.bg} ${colors.darkBg}`}>
            <Text className={`text-xs font-sans-medium ${colors.text}`}>
              {SENTIMENT_EMOJI[review.sentiment]} {SENTIMENT_LABELS[review.sentiment]}
            </Text>
          </View>
          {showReviewer && (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              {review.reviewerType === 'employer' ? '구인자' : '스태프'}
            </Text>
          )}
        </View>
        <Text
          className="text-xs text-content-placeholder font-sans"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formattedDate}
        </Text>
      </View>

      {/* 공고 정보 */}
      <Text
        className="mb-2 text-sm font-sans-semibold text-content-secondary"
        style={{ letterSpacing: -0.32 }}
        numberOfLines={1}
      >
        {review.jobPostingTitle}
      </Text>

      {/* 태그 */}
      <View className="mb-2 flex-row flex-wrap gap-1.5">
        {review.tags.map((tagKey) => (
          <View
            key={tagKey}
            className="rounded-sm bg-surface-card px-2.5 py-1 dark:bg-secondary-700"
          >
            <Text className="text-xs text-content-muted dark:text-secondary-300 font-sans">
              {tagMap.get(tagKey) ?? tagKey}
            </Text>
          </View>
        ))}
      </View>

      {/* 코멘트 */}
      {review.comment && (
        <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
          {'\u201C'}
          {review.comment}
          {'\u201D'}
        </Text>
      )}

      {/* 작성자 (showReviewer가 true일 때) */}
      {showReviewer && (
        <Text className="mt-2 text-xs text-content-placeholder font-sans">
          {review.reviewerName}님의 평가
        </Text>
      )}
    </View>
  );

  if (stripeTone) {
    return <CardStripe tone={stripeTone}>{cardBody}</CardStripe>;
  }

  return cardBody;
});
