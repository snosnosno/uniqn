import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SentimentSelector from './SentimentSelector';
import ReviewTagSelector from './ReviewTagSelector';
import { ConfirmModal } from '@/components/ui/Modal';
import { getIconColor } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import type { ReviewerType, ReviewSentiment, ReviewTag } from '@/types/review';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_TAG_LIMITS,
  filterTagsForSentiment,
} from '@/types/review';
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
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const placeholderColor = getIconColor(isDarkMode, 'primary');
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValues, setPendingValues] = useState<ReviewFormSchema | null>(null);
  const [tagPolicyNotice, setTagPolicyNotice] = useState<string | null>(null);

  const isFormReady = useMemo(
    () => Boolean(sentiment) && tags.length >= REVIEW_TAG_LIMITS.MIN,
    [sentiment, tags]
  );

  const handleSentimentChange = useCallback(
    (value: ReviewSentiment) => {
      const filteredTags = filterTagsForSentiment(value, tags as ReviewTag[]);

      setValue('sentiment', value, { shouldDirty: true, shouldValidate: true });
      setValue('tags', filteredTags, { shouldDirty: true, shouldValidate: true });

      if (filteredTags.length !== tags.length) {
        setTagPolicyNotice('감정 변경에 맞지 않는 태그는 자동으로 해제되었어요.');
      } else {
        setTagPolicyNotice(null);
      }
    },
    [setValue, tags]
  );

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      setValue('tags', newTags as ReviewTag[], { shouldDirty: true, shouldValidate: true });
      setTagPolicyNotice(null);
    },
    [setValue]
  );

  const handleFormSubmit = useCallback((values: ReviewFormSchema) => {
    setPendingValues(values);
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingValues) {
      return;
    }

    setShowConfirm(false);
    onSubmit(pendingValues);
    setPendingValues(null);
  }, [pendingValues, onSubmit]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
    setPendingValues(null);
  }, []);

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-3 text-base font-sans-semibold text-secondary-900 dark:text-secondary-100">
          {revieweeName}와의 근무는 어땠나요?
        </Text>
        <Controller
          control={control}
          name="sentiment"
          render={() => <SentimentSelector value={sentiment} onChange={handleSentimentChange} />}
        />
        {errors.sentiment ? (
          <Text className="mt-1 text-xs text-error-500 font-sans">{errors.sentiment.message}</Text>
        ) : null}
      </View>

      {sentiment ? (
        <View>
          <Text className="mb-2 text-base font-sans-semibold text-secondary-900 dark:text-secondary-100">
            어떤 점이 그랬나요?
          </Text>
          <Controller
            control={control}
            name="tags"
            render={() => (
              <ReviewTagSelector
                reviewerType={reviewerType}
                sentiment={sentiment}
                selectedTags={tags}
                onChange={handleTagsChange}
              />
            )}
          />
          {tagPolicyNotice ? (
            <Text className="mt-2 text-xs text-warning-600 dark:text-warning-400 font-sans">
              {tagPolicyNotice}
            </Text>
          ) : null}
          {errors.tags ? (
            <Text className="mt-1 text-xs text-error-500 font-sans">{errors.tags.message}</Text>
          ) : null}
        </View>
      ) : null}

      {sentiment ? (
        <View>
          <Text className="mb-2 text-base font-sans-semibold text-secondary-900 dark:text-secondary-100">
            추가 코멘트 (선택)
          </Text>
          <Controller
            control={control}
            name="comment"
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="추가로 남기고 싶은 말이 있나요?"
                  placeholderTextColor={placeholderColor}
                  multiline
                  maxLength={REVIEW_COMMENT_MAX_LENGTH}
                  className="min-h-[80px] rounded-lg border border-secondary-200 bg-white p-3 text-sm font-sans text-secondary-900 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-100"
                  textAlignVertical="top"
                />
                <Text className="mt-1 text-right text-xs text-secondary-400 font-sans">
                  {(comment ?? '').length}/{REVIEW_COMMENT_MAX_LENGTH}
                </Text>
              </View>
            )}
          />
          {errors.comment ? (
            <Text className="mt-1 text-xs text-error-500 font-sans">{errors.comment.message}</Text>
          ) : null}
        </View>
      ) : null}

      {sentiment ? (
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          리뷰는 제출 후 수정할 수 없어요. 상대방도 리뷰를 완료하면 서로의 리뷰를 확인할 수 있어요.
        </Text>
      ) : null}

      <Pressable
        onPress={handleSubmit(handleFormSubmit)}
        disabled={!isFormReady || isSubmitting}
        className={`items-center rounded-md py-4 ${
          isFormReady && !isSubmitting
            ? 'bg-primary-500 active:bg-primary-600'
            : 'bg-secondary-300 dark:bg-secondary-700'
        }`}
        accessibilityLabel="리뷰 제출"
        accessibilityRole="button"
        accessibilityState={{ disabled: !isFormReady || isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text
            className={`text-base font-sans-semibold ${
              isFormReady ? 'text-surface-dark' : 'text-secondary-500 dark:text-secondary-400'
            }`}
          >
            리뷰 제출하기
          </Text>
        )}
      </Pressable>

      <ConfirmModal
        visible={showConfirm}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="리뷰 제출"
        message="리뷰는 제출 후 수정할 수 없습니다. 제출하시겠어요?"
        confirmText="제출하기"
        cancelText="취소"
      />
    </View>
  );
}
