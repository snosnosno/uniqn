import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ReviewerType, ReviewSentiment, ReviewTagInfo } from '@/types/review';
import { REVIEW_TAG_LIMITS, SENTIMENT_COLORS, getVisibleTagsForSentiment } from '@/types/review';

interface ReviewTagSelectorProps {
  reviewerType: ReviewerType;
  sentiment: ReviewSentiment;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export default function ReviewTagSelector({
  reviewerType,
  sentiment,
  selectedTags,
  onChange,
}: ReviewTagSelectorProps) {
  const visibleTags = useMemo(
    () => getVisibleTagsForSentiment(reviewerType, sentiment),
    [reviewerType, sentiment]
  );
  const positiveTags = useMemo(
    () => visibleTags.filter((tag) => tag.sentiment === 'positive'),
    [visibleTags]
  );
  const negativeTags = useMemo(
    () => visibleTags.filter((tag) => tag.sentiment === 'negative'),
    [visibleTags]
  );

  const handleToggle = useCallback(
    (tagKey: string) => {
      if (selectedTags.includes(tagKey)) {
        onChange(selectedTags.filter((tag) => tag !== tagKey));
        return;
      }

      if (selectedTags.length < REVIEW_TAG_LIMITS.MAX) {
        onChange([...selectedTags, tagKey]);
      }
    },
    [selectedTags, onChange]
  );

  return (
    <View className="gap-4">
      {positiveTags.length > 0 ? (
        <TagGroup
          label="긍정 태그"
          tags={positiveTags}
          selectedTags={selectedTags}
          onToggle={handleToggle}
          sentiment="positive"
        />
      ) : null}

      {negativeTags.length > 0 ? (
        <TagGroup
          label="부정 태그"
          tags={negativeTags}
          selectedTags={selectedTags}
          onToggle={handleToggle}
          sentiment="negative"
        />
      ) : null}

      <Text className="text-xs text-gray-500 dark:text-gray-400">
        {selectedTags.length}/{REVIEW_TAG_LIMITS.MAX}개 선택됨 (최소 {REVIEW_TAG_LIMITS.MIN}개)
      </Text>
    </View>
  );
}

interface TagGroupProps {
  label: string;
  tags: ReviewTagInfo[];
  selectedTags: string[];
  onToggle: (tagKey: string) => void;
  sentiment: 'positive' | 'negative';
}

const TagGroup = React.memo(function TagGroup({
  label,
  tags,
  selectedTags,
  onToggle,
  sentiment,
}: TagGroupProps) {
  const colors = SENTIMENT_COLORS[sentiment];

  return (
    <View>
      <Text className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.key);
          return (
            <Pressable
              key={tag.key}
              onPress={() => onToggle(tag.key)}
              className={`rounded-sm border px-3 py-1.5 ${
                isSelected
                  ? `${colors.bg} ${colors.border} ${colors.darkBg}`
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
              accessibilityLabel={tag.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <Text
                className={`text-sm ${
                  isSelected ? colors.text : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {tag.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
