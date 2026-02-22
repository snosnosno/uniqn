/**
 * UNIQN Mobile - 감성 선택 컴포넌트
 *
 * @description 긍정/보통/부정 3버튼 선택기
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ReviewSentiment } from '@/types/review';
import { SENTIMENT_LABELS, SENTIMENT_EMOJI, SENTIMENT_COLORS } from '@/types/review';

interface SentimentSelectorProps {
  value?: ReviewSentiment;
  onChange: (sentiment: ReviewSentiment) => void;
}

const SENTIMENTS: ReviewSentiment[] = ['positive', 'neutral', 'negative'];

export default function SentimentSelector({ value, onChange }: SentimentSelectorProps) {
  return (
    <View className="flex-row gap-3">
      {SENTIMENTS.map((sentiment) => (
        <SentimentButton
          key={sentiment}
          sentiment={sentiment}
          isSelected={value === sentiment}
          onPress={onChange}
        />
      ))}
    </View>
  );
}

interface SentimentButtonProps {
  sentiment: ReviewSentiment;
  isSelected: boolean;
  onPress: (sentiment: ReviewSentiment) => void;
}

const SentimentButton = React.memo(function SentimentButton({
  sentiment,
  isSelected,
  onPress,
}: SentimentButtonProps) {
  const colors = SENTIMENT_COLORS[sentiment];
  const handlePress = useCallback(() => onPress(sentiment), [sentiment, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-1 items-center rounded-xl border-2 px-3 py-4 ${
        isSelected
          ? `${colors.bg} ${colors.border} ${colors.darkBg}`
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
      accessibilityLabel={SENTIMENT_LABELS[sentiment]}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <Text className="mb-1 text-2xl">{SENTIMENT_EMOJI[sentiment]}</Text>
      <Text
        className={`text-sm font-medium ${
          isSelected ? colors.text : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {SENTIMENT_LABELS[sentiment]}
      </Text>
    </Pressable>
  );
});
