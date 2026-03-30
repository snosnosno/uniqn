import React, { useCallback, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { buildPostingFacts } from '@/domains/job-posting';
import { findUnansweredRequired, initializePreQuestionAnswers } from '@/domains/application';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { useModalStore } from '@/stores/modalStore';
import type { Assignment, JobPosting, PostingType, PreQuestionAnswer } from '@/types';
import { AssignmentSelector } from './AssignmentSelector';
import { PostingTypeBadge } from './PostingTypeBadge';
import { PreQuestionForm } from './PreQuestionForm';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';

interface ApplicationFormProps {
  job: JobPosting;
  visible: boolean;
  isSubmitting: boolean;
  onSubmit: (
    assignments: Assignment[],
    message?: string,
    preQuestionAnswers?: PreQuestionAnswer[]
  ) => void;
  onClose: () => void;
}

export function ApplicationForm({
  job,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: ApplicationFormProps) {
  const postingFacts = useMemo(() => buildPostingFacts(job), [job]);
  const showConfirm = useModalStore((state) => state.showConfirm);
  const [message, setMessage] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [errorQuestionIds, setErrorQuestionIds] = useState<string[]>([]);
  const questions = postingFacts.questions.items;
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>(() =>
    initializePreQuestionAnswers(questions)
  );

  const isFixedMode = postingFacts.workflow.isFixed;
  const hasPreQuestions = questions.length > 0;
  const locationName = typeof job.location === 'string' ? job.location : job.location?.name;

  const hasUnsavedChanges = useMemo(
    () =>
      message.trim().length > 0 ||
      selectedAssignments.length > 0 ||
      preQuestionAnswers.some((answer) => answer.answer.trim().length > 0),
    [message, preQuestionAnswers, selectedAssignments.length]
  );

  const canSubmit = useMemo(() => {
    if (isSubmitting || isFixedMode) {
      return false;
    }

    if (selectedAssignments.length === 0) {
      return false;
    }

    if (hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0) {
      return false;
    }

    return true;
  }, [hasPreQuestions, isFixedMode, isSubmitting, preQuestionAnswers, selectedAssignments.length]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || isFixedMode) {
      return;
    }

    if (hasPreQuestions) {
      const unanswered = findUnansweredRequired(preQuestionAnswers);
      if (unanswered.length > 0) {
        setErrorQuestionIds(unanswered);
        return;
      }
    }

    onSubmit(
      selectedAssignments,
      message.trim() || undefined,
      hasPreQuestions ? preQuestionAnswers : undefined
    );
  }, [
    canSubmit,
    hasPreQuestions,
    isFixedMode,
    message,
    onSubmit,
    preQuestionAnswers,
    selectedAssignments,
  ]);

  const resetForm = useCallback(() => {
    setMessage('');
    setSelectedAssignments([]);
    setErrorQuestionIds([]);
    setPreQuestionAnswers(initializePreQuestionAnswers(questions));
  }, [questions]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleRequestClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!hasUnsavedChanges) {
      handleClose();
      return;
    }

    showConfirm(
      '작성을 그만둘까요?',
      '입력한 지원 내용은 저장되지 않고 바로 삭제됩니다.',
      handleClose
    );
  }, [handleClose, hasUnsavedChanges, isSubmitting, showConfirm]);

  const footer = (
    <Button onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} fullWidth>
      지원하기
    </Button>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      onRequestClose={handleRequestClose}
      title="지원하기"
      footer={footer}
      isLoading={isSubmitting}
      fullHeight
    >
      <View className="px-4">
        <View className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-surface">
          {job.postingType && job.postingType !== 'regular' && (
            <View className="mb-2">
              <PostingTypeBadge type={job.postingType as PostingType} size="sm" />
            </View>
          )}

          <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {job.title}
          </Text>
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">위치 {locationName}</Text>

          <View className="mb-2">
            <RoleSalaryDisplay
              roles={postingFacts.posting.roles}
              useSameSalary={postingFacts.compensation.display.useSameSalary}
              defaultSalary={postingFacts.compensation.defaultSalary}
              compact={false}
            />
          </View>

          {postingFacts.compensation.allowanceLabels.length > 0 && (
            <View className="mt-1 flex-row flex-wrap">
              {postingFacts.compensation.allowanceLabels.map((item, index) => (
                <Badge key={`${item}-${index}`} variant="default" size="sm" className="mr-1 mb-1">
                  {item}
                </Badge>
              ))}
            </View>
          )}
        </View>

        {isFixedMode ? (
          <View className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30">
            <Text className="text-base font-semibold text-amber-800 dark:text-amber-200">
              고정 공고 지원은 현재 비활성화되어 있습니다.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-amber-700 dark:text-amber-300">
              V3 canonical 통합 동안 날짜 기반 공고만 지원합니다. 다른 공고를 선택해 주세요.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            <AssignmentSelector
              jobPosting={job}
              selectedAssignments={selectedAssignments}
              onSelectionChange={setSelectedAssignments}
              disabled={isSubmitting}
            />
          </View>
        )}

        {hasPreQuestions && (
          <View className="mb-6">
            <PreQuestionForm
              questions={questions}
              answers={preQuestionAnswers}
              onAnswersChange={setPreQuestionAnswers}
              disabled={isSubmitting}
              errorQuestionIds={errorQuestionIds}
            />
          </View>
        )}

        <View className="mb-6">
          <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            자기소개 <Text className="text-gray-400">(선택)</Text>
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="간단한 자기소개나 경력을 입력해 주세요."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            maxLength={200}
            editable={!isSubmitting && !isFixedMode}
            className="min-h-[120px] rounded-lg bg-gray-50 p-4 text-base text-gray-900 dark:bg-surface dark:text-white"
            textAlignVertical="top"
          />
          <Text className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {message.length}/200
          </Text>
        </View>

        <View className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-surface">
          <Text className="text-xs leading-5 text-gray-500 dark:text-gray-400">
            지원 후에는 구인자가 지원서를 확인합니다.
            {'\n'}
            채용 결과는 알림으로 안내됩니다.
            {'\n'}
            지원 취소는 마이페이지에서 가능합니다.
          </Text>
        </View>
      </View>
    </SheetModal>
  );
}

export default ApplicationForm;
