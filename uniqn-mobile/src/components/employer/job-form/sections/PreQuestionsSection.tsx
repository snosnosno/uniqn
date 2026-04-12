/**
 * UNIQN Mobile - 공고 작성 사전질문 섹션
 *
 * @description 선택적 사전질문 설정 (지원자에게 추가로 물어볼 질문)
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, memo } from 'react';
import { View, Text, Pressable, TextInput, Switch } from 'react-native';
import { Card, ActionSheet } from '@/components';
import {
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@/components/icons';
import type { JobPostingFormData, PreQuestion } from '@/types';
import { PRE_QUESTION_TYPE_LABELS } from '@/domains/application';
import { generateId } from '@/utils/generateId';

// ============================================================================
// Types
// ============================================================================

interface PreQuestionsSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

type QuestionType = 'text' | 'textarea' | 'select';

// ============================================================================
// Constants
// ============================================================================

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'text', label: '단답형', description: '한 줄 답변' },
  { value: 'textarea', label: '장문형', description: '여러 줄 답변' },
  { value: 'select', label: '선택형', description: '보기 중 선택' },
];

// ============================================================================
// Sub Components
// ============================================================================

interface QuestionCardProps {
  question: PreQuestion;
  index: number;
  onUpdate: (question: PreQuestion) => void;
  onDelete: () => void;
}

const QuestionCard = memo(function QuestionCard({
  question,
  index,
  onUpdate,
  onDelete,
}: QuestionCardProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleQuestionTextChange = useCallback(
    (text: string) => {
      onUpdate({ ...question, question: text });
    },
    [question, onUpdate]
  );

  const handleTypeChange = useCallback(
    (type: QuestionType) => {
      onUpdate({
        ...question,
        type,
        options: type === 'select' ? [''] : undefined,
      });
      setShowTypeSelector(false);
    },
    [question, onUpdate]
  );

  const handleRequiredChange = useCallback(
    (required: boolean) => {
      onUpdate({ ...question, required });
    },
    [question, onUpdate]
  );

  const handleAddOption = useCallback(() => {
    const options = [...(question.options || []), ''];
    onUpdate({ ...question, options });
  }, [question, onUpdate]);

  const handleDeleteOption = useCallback(
    (optionIndex: number) => {
      const options = question.options?.filter((_, i) => i !== optionIndex) || [];
      onUpdate({ ...question, options: options.length > 0 ? options : [''] });
    },
    [question, onUpdate]
  );

  const handleOptionChange = useCallback(
    (optionIndex: number, value: string) => {
      const options = question.options?.map((opt, i) => (i === optionIndex ? value : opt)) || [];
      onUpdate({ ...question, options });
    },
    [question, onUpdate]
  );

  return (
    <Card variant="outlined" padding="md" className="mb-3">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-sm bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
            <Text className="text-primary-700 dark:text-primary-300 font-sans-bold text-sm">
              {index + 1}
            </Text>
          </View>
          <Text className="ml-2 font-sans-medium text-secondary-900 dark:text-off-white">
            질문 {index + 1}
          </Text>
        </View>
        <Pressable
          onPress={onDelete}
          className="p-2 rounded-lg bg-error-50 dark:bg-error-900/20"
          accessibilityRole="button"
          accessibilityLabel="질문 삭제"
        >
          <TrashIcon size={18} color="#DC2626" />
        </Pressable>
      </View>

      {/* 질문 내용 */}
      <TextInput
        value={question.question}
        onChangeText={handleQuestionTextChange}
        placeholder="질문 내용을 입력하세요"
        placeholderTextColor={SECONDARY_PALETTE[400]}
        multiline
        className="px-3 py-2 bg-secondary-50 dark:bg-surface rounded-lg text-secondary-900 dark:text-off-white min-h-[48px]"
      />

      {/* 질문 타입 & 필수 여부 */}
      <View className="flex-row items-center justify-between mt-3">
        {/* 타입 선택 */}
        <View className="flex-1 mr-4">
          <Pressable
            onPress={() => setShowTypeSelector(true)}
            className="flex-row items-center justify-between px-3 py-2 bg-secondary-50 dark:bg-surface rounded-lg"
          >
            <Text className="text-secondary-900 dark:text-off-white font-sans">
              {PRE_QUESTION_TYPE_LABELS[question.type]}
            </Text>
            <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
          </Pressable>

          {/* ActionSheet로 타입 선택 */}
          <ActionSheet
            visible={showTypeSelector}
            onClose={() => setShowTypeSelector(false)}
            title="답변 유형 선택"
            options={QUESTION_TYPES.map((type) => ({
              value: type.value,
              label: `${type.label} - ${type.description}`,
            }))}
            onSelect={(value) => handleTypeChange(value as QuestionType)}
          />
        </View>

        {/* 필수 여부 */}
        <View className="flex-row items-center">
          <Text className="text-sm text-secondary-600 dark:text-secondary-400 mr-2 font-sans">
            필수
          </Text>
          <Switch
            value={question.required}
            onValueChange={handleRequiredChange}
            trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
            thumbColor={question.required ? '#FFFFFF' : SECONDARY_PALETTE[50]}
          />
        </View>
      </View>

      {/* 선택형 옵션 */}
      {question.type === 'select' && (
        <View className="mt-3">
          <Text className="text-sm text-secondary-600 dark:text-secondary-400 mb-2 font-sans">
            선택지
          </Text>
          {question.options?.map((option, optionIndex) => (
            <View key={optionIndex} className="flex-row items-center mb-2">
              <View className="w-6 h-6 rounded-sm border-2 border-secondary-300 dark:border-surface-overlay mr-2" />
              <TextInput
                value={option}
                onChangeText={(v) => handleOptionChange(optionIndex, v)}
                placeholder={`선택지 ${optionIndex + 1}`}
                placeholderTextColor={SECONDARY_PALETTE[400]}
                className="flex-1 px-3 py-2 bg-secondary-50 dark:bg-surface rounded-lg text-secondary-900 dark:text-off-white"
              />
              {(question.options?.length || 0) > 1 && (
                <Pressable
                  onPress={() => handleDeleteOption(optionIndex)}
                  className="ml-2 p-2"
                  accessibilityRole="button"
                  accessibilityLabel="선택지 삭제"
                >
                  <XMarkIcon size={18} color={SECONDARY_PALETTE[400]} />
                </Pressable>
              )}
            </View>
          ))}
          <Pressable
            onPress={handleAddOption}
            className="flex-row items-center justify-center py-2 border border-dashed border-secondary-300 dark:border-surface-overlay rounded-lg"
          >
            <PlusIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-sm text-secondary-600 dark:text-secondary-400 font-sans">
              선택지 추가
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const PreQuestionsSection = memo(function PreQuestionsSection({
  data,
  onUpdate,
  errors = {},
}: PreQuestionsSectionProps) {
  const hasPreQuestions = data.usesPreQuestions;
  // 사전질문 사용 토글
  const handleUsesPreQuestionsToggle = useCallback(
    (value: boolean) => {
      if (value && data.preQuestions.length === 0) {
        const newQuestion: PreQuestion = {
          id: generateId('q'),
          question: '',
          required: false,
          type: 'text',
        };
        onUpdate({ usesPreQuestions: true, preQuestions: [newQuestion] });
        return;
      }

      onUpdate({ usesPreQuestions: value });
    },
    [data.preQuestions.length, onUpdate]
  );

  // 질문 추가
  const handleAddQuestion = useCallback(() => {
    if (data.preQuestions.length >= 10) {
      return;
    }
    const newQuestion: PreQuestion = {
      id: generateId('q'),
      question: '',
      required: false,
      type: 'text',
    };
    onUpdate({
      usesPreQuestions: true,
      preQuestions: [...data.preQuestions, newQuestion],
    });
  }, [data.preQuestions, onUpdate]);

  // 질문 업데이트
  const handleUpdateQuestion = useCallback(
    (index: number, question: PreQuestion) => {
      const newQuestions = [...data.preQuestions];
      newQuestions[index] = question;
      onUpdate({
        usesPreQuestions: newQuestions.length > 0,
        preQuestions: newQuestions,
      });
    },
    [data.preQuestions, onUpdate]
  );

  // 질문 삭제
  const handleDeleteQuestion = useCallback(
    (index: number) => {
      const newQuestions = data.preQuestions.filter((_, i) => i !== index);
      onUpdate({
        usesPreQuestions: newQuestions.length > 0,
        preQuestions: newQuestions,
      });
    },
    [data.preQuestions, onUpdate]
  );

  return (
    <View>
      {/* 안내 문구 */}
      <View className="flex-row items-start mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
        <InformationCircleIcon size={20} color="#B8962E" />
        <View className="ml-2 flex-1">
          <Text className="text-sm font-sans-medium text-primary-800 dark:text-primary-200">
            사전질문 안내
          </Text>
          <Text className="text-xs text-primary-700 dark:text-primary-300 mt-1 font-sans">
            지원자에게 추가로 질문하고 싶은 내용을 설정할 수 있습니다.
          </Text>
        </View>
      </View>

      {/* 사전질문 사용 토글 */}
      <View className="flex-row items-center justify-between p-4 bg-white dark:bg-surface rounded-lg border border-secondary-200 dark:border-surface-overlay mb-4">
        <View>
          <Text className="text-secondary-900 dark:text-off-white font-sans-medium">
            사전질문 사용
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 font-sans">
            지원자에게 추가 질문을 할 수 있습니다
          </Text>
        </View>
        <Switch
          value={hasPreQuestions}
          onValueChange={handleUsesPreQuestionsToggle}
          trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
          thumbColor={hasPreQuestions ? '#FFFFFF' : SECONDARY_PALETTE[50]}
        />
      </View>

      {/* 사전질문 목록 */}
      {hasPreQuestions && (
        <>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-sans-semibold text-secondary-900 dark:text-off-white">
              질문 목록 ({data.preQuestions.length}/10)
            </Text>
          </View>

          {data.preQuestions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              onUpdate={(q) => handleUpdateQuestion(index, q)}
              onDelete={() => handleDeleteQuestion(index)}
            />
          ))}

          {/* 질문 추가 버튼 */}
          {data.preQuestions.length < 10 && (
            <Pressable
              onPress={handleAddQuestion}
              className="flex-row items-center justify-center p-4 border-2 border-dashed border-secondary-300 dark:border-surface-overlay rounded-md"
              accessibilityRole="button"
              accessibilityLabel="질문 추가"
            >
              <PlusIcon size={20} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-2 text-secondary-600 dark:text-secondary-400 font-sans-medium">
                질문 추가
              </Text>
            </Pressable>
          )}
        </>
      )}

      {/* 에러 메시지 */}
      {errors.preQuestions && (
        <Text className="mt-3 text-sm text-error-500 font-sans">{errors.preQuestions}</Text>
      )}
    </View>
  );
});

export default PreQuestionsSection;
