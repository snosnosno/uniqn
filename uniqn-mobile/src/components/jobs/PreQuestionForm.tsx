/**
 * UNIQN Mobile - 사전질문 폼 컴포넌트
 *
 * @description 공고 지원 시 사전질문 답변 입력 폼
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { PreQuestion, PreQuestionAnswer } from '@/types';
import { PRE_QUESTION_TYPE_LABELS, updateAnswer } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface PreQuestionFormProps {
  /** 질문 목록 */
  questions: PreQuestion[];
  /** 답변 목록 */
  answers: PreQuestionAnswer[];
  /** 답변 변경 콜백 */
  onAnswersChange: (answers: PreQuestionAnswer[]) => void;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 에러 표시할 질문 ID 목록 */
  errorQuestionIds?: string[];
}

interface QuestionItemProps {
  question: PreQuestion;
  answer: PreQuestionAnswer;
  onAnswerChange: (questionId: string, answer: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

interface SelectOptionProps {
  option: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 선택 옵션 버튼
 */
const SelectOption = memo(function SelectOption({
  option,
  isSelected,
  onSelect,
  disabled,
}: SelectOptionProps) {
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      className={`px-4 py-3 rounded-lg border mb-2 ${
        isSelected
          ? 'bg-primary-50 border-primary-500 dark:bg-primary-900/20 dark:border-primary-400'
          : 'bg-white border-gray-200 dark:bg-surface dark:border-surface-overlay'
      } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      <View className="flex-row items-center">
        <View
          className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
            isSelected
              ? 'border-primary-500 bg-primary-500'
              : 'border-gray-300 dark:border-surface-overlay'
          }`}
        >
          {isSelected && (
            <View className="w-2 h-2 rounded-full bg-white" />
          )}
        </View>
        <Text
          className={`text-sm ${
            isSelected
              ? 'text-primary-700 dark:text-primary-300 font-medium'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {option}
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * 개별 질문 항목
 */
const QuestionItem = memo(function QuestionItem({
  question,
  answer,
  onAnswerChange,
  disabled,
  hasError,
}: QuestionItemProps) {
  const handleTextChange = useCallback(
    (text: string) => {
      onAnswerChange(question.id, text);
    },
    [question.id, onAnswerChange]
  );

  const handleSelectOption = useCallback(
    (option: string) => {
      onAnswerChange(question.id, option);
    },
    [question.id, onAnswerChange]
  );

  const borderColor = hasError
    ? 'border-red-500 dark:border-red-400'
    : 'border-gray-200 dark:border-surface-overlay';

  return (
    <View className="mb-6">
      {/* 질문 헤더 */}
      <View className="flex-row items-start mb-2">
        <Text className="text-base font-medium text-gray-900 dark:text-white flex-1">
          {question.question}
          {question.required && (
            <Text className="text-red-500"> *</Text>
          )}
        </Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
          {PRE_QUESTION_TYPE_LABELS[question.type]}
        </Text>
      </View>

      {/* 입력 영역 */}
      {question.type === 'text' && (
        <TextInput
          value={answer.answer}
          onChangeText={handleTextChange}
          editable={!disabled}
          placeholder="답변을 입력해주세요"
          placeholderTextColor="#9CA3AF"
          accessibilityLabel={`${question.question} 답변 입력`}
          className={`bg-white dark:bg-surface border ${borderColor} rounded-lg px-4 py-3 text-gray-900 dark:text-white`}
        />
      )}

      {question.type === 'textarea' && (
        <TextInput
          value={answer.answer}
          onChangeText={handleTextChange}
          editable={!disabled}
          placeholder="답변을 입력해주세요"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          accessibilityLabel={`${question.question} 답변 입력`}
          className={`bg-white dark:bg-surface border ${borderColor} rounded-lg px-4 py-3 text-gray-900 dark:text-white min-h-[100px]`}
        />
      )}

      {question.type === 'select' && question.options && (
        <View className="mt-1">
          {question.options.map((option, index) => (
            <SelectOption
              key={index}
              option={option}
              isSelected={answer.answer === option}
              onSelect={() => handleSelectOption(option)}
              disabled={disabled}
            />
          ))}
        </View>
      )}

      {/* 에러 메시지 */}
      {hasError && (
        <Text className="text-sm text-red-500 dark:text-red-400 mt-1">
          필수 질문입니다. 답변을 입력해주세요.
        </Text>
      )}

      {/* 글자 수 표시 (textarea) */}
      {question.type === 'textarea' && answer.answer.length > 0 && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
          {answer.answer.length}/1000자
        </Text>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 사전질문 폼 컴포넌트
 *
 * @description 공고 지원 시 사전질문에 답변하는 폼
 * text, textarea, select 3가지 타입 지원
 *
 * @example
 * <PreQuestionForm
 *   questions={job.preQuestions}
 *   answers={answers}
 *   onAnswersChange={setAnswers}
 * />
 */
export const PreQuestionForm = memo(function PreQuestionForm({
  questions,
  answers,
  onAnswersChange,
  disabled = false,
  errorQuestionIds = [],
}: PreQuestionFormProps) {
  // 답변 변경 핸들러
  const handleAnswerChange = useCallback(
    (questionId: string, answerText: string) => {
      const updatedAnswers = updateAnswer(answers, questionId, answerText);
      onAnswersChange(updatedAnswers);
    },
    [answers, onAnswersChange]
  );

  // 질문이 없으면 null 반환
  if (!questions || questions.length === 0) {
    return null;
  }

  // 필수 질문 수
  const requiredCount = questions.filter((q) => q.required).length;
  const answeredRequiredCount = answers.filter(
    (a) => a.required && a.answer.trim().length > 0
  ).length;

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          사전질문
        </Text>
        {requiredCount > 0 && (
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            필수 {answeredRequiredCount}/{requiredCount}
          </Text>
        )}
      </View>

      {/* 안내 텍스트 */}
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        구인자가 지원자에게 미리 물어보는 질문입니다.
        <Text className="text-red-500"> *</Text> 표시는 필수 항목입니다.
      </Text>

      {/* 질문 목록 */}
      {questions.map((question) => {
        const answer = answers.find((a) => a.questionId === question.id);
        if (!answer) return null;

        return (
          <QuestionItem
            key={question.id}
            question={question}
            answer={answer}
            onAnswerChange={handleAnswerChange}
            disabled={disabled}
            hasError={errorQuestionIds.includes(question.id)}
          />
        );
      })}
    </View>
  );
});

export default PreQuestionForm;
