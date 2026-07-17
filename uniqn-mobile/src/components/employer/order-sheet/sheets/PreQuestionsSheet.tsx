/**
 * PreQuestionsSheet — 사전질문 시트 (주문서 사전질문·선택)
 *
 * @description PreQuestionsSection의 QuestionCard 패턴을 동형 구현하되, 답변유형 선택은 ActionSheet
 * (ui/Modal 기반 — SheetModal 안에 임베드하면 중첩 Modal iOS 터치먹통 재발) 대신 인라인 라디오
 * 3버튼(단답/장문/선택형)으로 구현한다. 최대 10개(zod preQuestionsArraySchema.max(10)가 게이트).
 * 확정 시 빈 질문·빈 선택지를 정리해 부모로 흘려보내고 부모가 form.setValue(shouldValidate)로 zod
 * 경계(question XSS·options XSS superRefine·max10)를 태운다. 단일 SheetModal(fullHeight) — 중첩 Modal 없음.
 */
import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PlusIcon, TrashIcon, XMarkIcon } from '@/components/icons';
import { generateId } from '@/utils/generateId';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type PreQ = OrderSheetValues['preQuestions'][number];
type QuestionType = PreQ['type'];

const MAX_QUESTIONS = 10;

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'text', label: '단답형', description: '한 줄' },
  { value: 'textarea', label: '장문형', description: '여러 줄' },
  { value: 'select', label: '선택형', description: '보기 중 선택' },
];

const newQuestion = (): PreQ => ({
  id: generateId('q'),
  question: '',
  required: false,
  type: 'text',
});

export interface PreQuestionsSheetProps {
  visible: boolean;
  value: OrderSheetValues['preQuestions'];
  onConfirm: (next: { usesPreQuestions: boolean; preQuestions: PreQ[] }) => void;
  onClose: () => void;
}

interface QuestionCardProps {
  question: PreQ;
  index: number;
  onUpdate: (q: PreQ) => void;
  onDelete: () => void;
  placeholderColor: string;
}

function QuestionCard({
  question,
  index,
  onUpdate,
  onDelete,
  placeholderColor,
}: QuestionCardProps) {
  const options = question.options ?? [];

  const changeType = (type: QuestionType) =>
    onUpdate({
      ...question,
      type,
      options: type === 'select' ? (options.length > 0 ? options : ['']) : undefined,
    });

  const addOption = () => onUpdate({ ...question, options: [...options, ''] });
  const changeOption = (i: number, v: string) =>
    onUpdate({ ...question, options: options.map((o, idx) => (idx === i ? v : o)) });
  const deleteOption = (i: number) => {
    const next = options.filter((_, idx) => idx !== i);
    onUpdate({ ...question, options: next.length > 0 ? next : [''] });
  };

  return (
    <View
      testID={`order-sheet-prequestion-${index}`}
      className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-3 gap-3"
    >
      {/* 헤더 — 번호 + 삭제 */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sans-bold text-content-primary">질문 {index + 1}</Text>
        <Pressable
          onPress={onDelete}
          className="w-11 h-11 items-center justify-center active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`질문 ${index + 1} 삭제`}
          testID={`order-sheet-prequestion-${index}-delete`}
        >
          <TrashIcon size={18} />
        </Pressable>
      </View>

      {/* 질문 내용 */}
      <TextInput
        value={question.question}
        onChangeText={(t) => onUpdate({ ...question, question: t })}
        placeholder="질문 내용을 입력하세요"
        placeholderTextColor={placeholderColor}
        maxLength={200}
        multiline
        testID={`order-sheet-prequestion-${index}-text`}
        className="rounded-lg border border-secondary-200 dark:border-surface-overlay bg-surface-page dark:bg-surface px-3 py-2 min-h-[48px] text-content-primary font-sans"
      />

      {/* 답변 유형 — 인라인 라디오 3버튼 (ActionSheet 대체, 중첩 Modal 회피) */}
      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {QUESTION_TYPES.map(({ value, label }) => {
          const selected = question.type === value;
          return (
            <Pressable
              key={value}
              onPress={() => changeType(value)}
              testID={`order-sheet-prequestion-${index}-type-${value}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg border ${
                selected
                  ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay active:opacity-80'
              }`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  selected
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-secondary-700 dark:text-secondary-300'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 필수 여부 */}
      <View className="flex-row items-center justify-between min-h-[44px]">
        <Text className="text-sm text-content-secondary font-sans">필수 응답</Text>
        <Switch
          value={question.required}
          onValueChange={(required) => onUpdate({ ...question, required })}
          trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
          thumbColor={question.required ? '#FFFFFF' : SECONDARY_PALETTE[50]}
          accessibilityLabel="필수 응답"
        />
      </View>

      {/* 선택형 옵션 */}
      {question.type === 'select' && (
        <View className="gap-2">
          <Text className="text-xs text-content-secondary font-sans">선택지</Text>
          {options.map((option, optionIndex) => (
            <View key={optionIndex} className="flex-row items-center gap-2">
              <TextInput
                value={option}
                onChangeText={(v) => changeOption(optionIndex, v)}
                placeholder={`선택지 ${optionIndex + 1}`}
                placeholderTextColor={placeholderColor}
                maxLength={50}
                testID={`order-sheet-prequestion-${index}-option-${optionIndex}`}
                className="flex-1 rounded-lg border border-secondary-200 dark:border-surface-overlay bg-surface-page dark:bg-surface px-3 py-2 text-content-primary font-sans"
              />
              {options.length > 1 && (
                <Pressable
                  onPress={() => deleteOption(optionIndex)}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`선택지 ${optionIndex + 1} 삭제`}
                >
                  <XMarkIcon size={18} />
                </Pressable>
              )}
            </View>
          ))}
          <Pressable
            onPress={addOption}
            className="flex-row items-center justify-center gap-1 py-2 min-h-[44px] border border-dashed border-secondary-300 dark:border-surface-overlay rounded-lg active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="선택지 추가"
          >
            <PlusIcon size={16} />
            <Text className="text-sm text-content-secondary font-sans">선택지 추가</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function PreQuestionsSheet({ visible, value, onConfirm, onClose }: PreQuestionsSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const [questions, setQuestions] = useState<PreQ[]>(value);

  const addQuestion = () =>
    setQuestions((prev) => (prev.length >= MAX_QUESTIONS ? prev : [...prev, newQuestion()]));
  const updateQuestion = (index: number, q: PreQ) =>
    setQuestions((prev) => prev.map((x, i) => (i === index ? q : x)));
  const deleteQuestion = (index: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  const handleConfirm = () => {
    // 빈 질문·빈 선택지 정리 — 실수로 추가한 빈 카드가 제출 게이트를 막지 않도록.
    const cleaned = questions
      .filter((q) => q.question.trim().length > 0)
      .map((q) =>
        q.type === 'select'
          ? { ...q, options: (q.options ?? []).map((o) => o.trim()).filter((o) => o.length > 0) }
          : q
      );
    onConfirm({ usesPreQuestions: cleaned.length > 0, preQuestions: cleaned });
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="사전질문 (선택)"
      fullHeight
      footer={<Button onPress={handleConfirm}>확인</Button>}
    >
      <View className="px-4 pt-3 pb-2">
        <Text className="text-xs text-content-secondary font-sans mb-3">
          지원자에게 추가로 물어볼 질문을 최대 {MAX_QUESTIONS}개까지 만들 수 있어요. (
          {questions.length}/{MAX_QUESTIONS})
        </Text>

        {questions.length === 0 ? (
          <View className="rounded-xl border border-dashed border-secondary-200 dark:border-surface-overlay px-4 py-6 items-center mb-3">
            <Text className="text-sm text-content-secondary font-sans text-center">
              아직 질문이 없어요.{'\n'}아래 버튼으로 첫 질문을 추가해보세요.
            </Text>
          </View>
        ) : (
          questions.map((q, index) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={index}
              onUpdate={(next) => updateQuestion(index, next)}
              onDelete={() => deleteQuestion(index)}
              placeholderColor={placeholderColor}
            />
          ))
        )}

        {questions.length < MAX_QUESTIONS && (
          <Pressable
            onPress={addQuestion}
            testID="order-sheet-prequestion-add"
            className="flex-row items-center justify-center gap-1 p-4 min-h-[44px] border-2 border-dashed border-secondary-300 dark:border-surface-overlay rounded-xl active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="질문 추가"
          >
            <PlusIcon size={20} />
            <Text className="text-content-secondary font-sans-medium">질문 추가</Text>
          </Pressable>
        )}
      </View>
    </SheetModal>
  );
}
