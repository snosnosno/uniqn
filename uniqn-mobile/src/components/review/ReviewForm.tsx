/**
 * UNIQN Mobile - 리뷰 작성 폼 컴포넌트
 *
 * @description 감성 선택 + 태그 + 코멘트 통합 폼
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SentimentSelector from './SentimentSelector';
import ReviewTagSelector from './ReviewTagSelector';
import type { ReviewerType, ReviewSentiment, ReviewTag } from '@/types/review';
import { REVIEW_COMMENT_MAX_LENGTH, REVIEW_TAG_LIMITS } from '@/types/review';
import { reviewFormSchema, type ReviewFormSchema } from '@/schemas/review.schema';

interface ReviewFormProps {
  reviewerType: ReviewerType;
  revieweeName: string;
  onSubmit: (values: ReviewFormSchema) => void;
  isSubmitting?: boolean;
}

export default function ReviewForm({
  reviewerType,
  revieweeName,
  onSubmit,
  isSubmitting = false,
}: ReviewFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReviewFormSchema>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      sentiment: undefined,
      tags: [],
      comment: '',
    },
    mode: 'onChange',
  });

  const sentiment = watch('sentiment');
  const tags = watch('tags');
  const comment = watch('comment');

  const isFormReady = useMemo(
    () => !!sentiment && tags.length >= REVIEW_TAG_LIMITS.MIN,
    [sentiment, tags]
  );

  const handleSentimentChange = useCallback(
    (value: ReviewSentiment) => {
      setValue('sentiment', value, { shouldValidate: true });
      // 감성 변경 시 태그 초기화
      setValue('tags', [], { shouldValidate: true });
    },
    [setValue]
  );

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      setValue('tags', newTags as ReviewTag[], { shouldValidate: true });
    },
    [setValue]
  );

  return (
    <View className="gap-6">
      {/* 감성 선택 */}
      <View>
        <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
          {revieweeName}님과의 근무는 어떠셨나요?
        </Text>
        <Controller
          control={control}
          name="sentiment"
          render={() => (
            <SentimentSelector value={sentiment} onChange={handleSentimentChange} />
          )}
        />
        {errors.sentiment && (
          <Text className="mt-1 text-xs text-red-500">{errors.sentiment.message}</Text>
        )}
      </View>

      {/* 태그 선택 */}
      {sentiment && (
        <View>
          <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            어떤 점이 그랬나요?
          </Text>
          <Controller
            control={control}
            name="tags"
            render={() => (
              <ReviewTagSelector
                reviewerType={reviewerType}
                selectedTags={tags}
                onChange={handleTagsChange}
              />
            )}
          />
          {errors.tags && (
            <Text className="mt-1 text-xs text-red-500">{errors.tags.message}</Text>
          )}
        </View>
      )}

      {/* 코멘트 입력 */}
      {sentiment && (
        <View>
          <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            한줄 코멘트 (선택)
          </Text>
          <Controller
            control={control}
            name="comment"
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="추가로 전하고 싶은 말이 있나요?"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={REVIEW_COMMENT_MAX_LENGTH}
                  className="min-h-[80px] rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  textAlignVertical="top"
                />
                <Text className="mt-1 text-right text-xs text-gray-400">
                  {(comment ?? '').length}/{REVIEW_COMMENT_MAX_LENGTH}
                </Text>
              </View>
            )}
          />
          {errors.comment && (
            <Text className="mt-1 text-xs text-red-500">{errors.comment.message}</Text>
          )}
        </View>
      )}

      {/* 제출 안내 */}
      {sentiment && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          평가는 제출 후 수정할 수 없습니다. 상대방이 평가를 완료하면 서로의 평가를 확인할 수 있습니다.
        </Text>
      )}

      {/* 제출 버튼 */}
      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={!isFormReady || isSubmitting}
        className={`items-center rounded-xl py-4 ${
          isFormReady && !isSubmitting
            ? 'bg-primary-500 active:bg-primary-600'
            : 'bg-gray-300 dark:bg-gray-700'
        }`}
        accessibilityLabel="평가 제출"
        accessibilityRole="button"
        accessibilityState={{ disabled: !isFormReady || isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text
            className={`text-base font-semibold ${
              isFormReady ? 'text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            평가 제출하기
          </Text>
        )}
      </Pressable>
    </View>
  );
}
