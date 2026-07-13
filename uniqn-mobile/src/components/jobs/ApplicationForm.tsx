import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { buildPostingFacts } from '@/domains/job-posting';
import { findUnansweredRequired, initializePreQuestionAnswers } from '@/domains/application';
import { THIRD_PARTY_CONSENT_VERSION_TAG } from '@/constants/legal';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER, type Assignment } from '@/types/assignment';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { CheckIcon } from '@/components/icons';
import type { JobPosting, PostingType, PreQuestionAnswer } from '@/types';
import { AssignmentSelector } from './AssignmentSelector';
import { PostingTypeBadge } from './PostingTypeBadge';
import { PreQuestionForm } from './PreQuestionForm';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';

interface ProvisionConsent {
  at: string; // ISO 8601
  version: string;
}

interface ApplicationFormProps {
  job: JobPosting;
  visible: boolean;
  isSubmitting: boolean;
  onSubmit: (
    assignments: Assignment[],
    message: string | undefined,
    preQuestionAnswers: PreQuestionAnswer[] | undefined,
    provisionConsent: ProvisionConsent
  ) => void;
  onClose: () => void;
}

function FixedRoleSelector({
  selectedRoleId,
  onSelect,
  disabled,
  options,
}: {
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
  disabled: boolean;
  options: ReturnType<typeof buildPostingFacts>['application']['availableRoleOptions'];
}) {
  return (
    <View className="gap-3">
      <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
        지원 역할
      </Text>
      {options.map((option) => {
        const isSelected = selectedRoleId === option.key;
        const isDisabled = disabled || !option.isAvailable;

        return (
          <Pressable
            key={option.key}
            onPress={() => !isDisabled && onSelect(option.key)}
            disabled={isDisabled}
            className={`rounded-md border p-4 ${
              isSelected
                ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
            } ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className={`text-base font-sans-semibold ${
                    isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
                  }`}
                >
                  {option.roleLabel}
                </Text>
                <Text className="mt-1 text-sm text-content-secondary font-sans">
                  모집 {option.count}명 · 남은 자리 {option.remaining}명
                </Text>
              </View>
              {isSelected ? (
                <Badge variant="primary" size="sm">
                  선택됨
                </Badge>
              ) : !option.isAvailable ? (
                <Badge variant="error" size="sm">
                  마감
                </Badge>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ApplicationForm({
  job,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: ApplicationFormProps) {
  const postingFacts = useMemo(() => buildPostingFacts(job), [job]);
  const [message, setMessage] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [selectedFixedRoleId, setSelectedFixedRoleId] = useState<string | null>(null);
  const [errorQuestionIds, setErrorQuestionIds] = useState<string[]>([]);
  const questions = postingFacts.questions.items;
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>(() =>
    initializePreQuestionAnswers(questions)
  );
  // 개보법 §17 — 지원 시점 1-tap 제공 동의 (form state 아님, submit 1회용)
  const [provisionConsentAgreed, setProvisionConsentAgreed] = useState(false);

  // F3 회귀 방지 — 모달 재오픈 시 stale check 방지 (eng review)
  useEffect(() => {
    if (visible) {
      setProvisionConsentAgreed(false);
    }
  }, [visible]);

  const isFixedMode = postingFacts.workflow.isFixed;
  const hasPreQuestions = questions.length > 0;
  const locationName = typeof job.location === 'string' ? job.location : job.location?.name;

  const fixedAssignment = useMemo<Assignment[]>(
    () =>
      selectedFixedRoleId
        ? [
            {
              roleIds: [selectedFixedRoleId],
              timeSlot: postingFacts.application.fixedAssignmentTimeSlot || FIXED_TIME_MARKER,
              dates: [FIXED_DATE_MARKER],
              isGrouped: false,
              checkMethod: 'individual',
            },
          ]
        : [],
    [postingFacts.application.fixedAssignmentTimeSlot, selectedFixedRoleId]
  );

  const assignmentsForSubmit = isFixedMode ? fixedAssignment : selectedAssignments;

  const hasUnsavedChanges = useMemo(
    () =>
      message.trim().length > 0 ||
      assignmentsForSubmit.length > 0 ||
      preQuestionAnswers.some((answer) => answer.answer.trim().length > 0),
    [assignmentsForSubmit.length, message, preQuestionAnswers]
  );

  const canSubmit = useMemo(() => {
    if (isSubmitting) {
      return false;
    }

    if (assignmentsForSubmit.length === 0) {
      return false;
    }

    if (hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0) {
      return false;
    }

    if (!provisionConsentAgreed) {
      return false;
    }

    return true;
  }, [
    assignmentsForSubmit.length,
    hasPreQuestions,
    isSubmitting,
    preQuestionAnswers,
    provisionConsentAgreed,
  ]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
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
      assignmentsForSubmit,
      message.trim() || undefined,
      hasPreQuestions ? preQuestionAnswers : undefined,
      {
        at: new Date().toISOString(),
        version: THIRD_PARTY_CONSENT_VERSION_TAG,
      }
    );
  }, [assignmentsForSubmit, canSubmit, hasPreQuestions, message, onSubmit, preQuestionAnswers]);

  const resetForm = useCallback(() => {
    setMessage('');
    setSelectedAssignments([]);
    setSelectedFixedRoleId(null);
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

    // 네이티브 Alert 사용 — modalStore 의 ConfirmModal 은 SheetModal(네이티브 RNModal) 뒤에
    // 가려 안 보여서 사용자가 닫기 확인을 못 한다(= 화면에서 못 나가는 버그).
    Alert.alert('작성을 그만할까요?', '입력한 지원 내용은 저장되지 않고 바로 닫힙니다.', [
      { text: '계속 편집', style: 'cancel' },
      { text: '닫기', style: 'destructive', onPress: handleClose },
    ]);
  }, [handleClose, hasUnsavedChanges, isSubmitting]);

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
        <View className="mb-6 rounded-lg bg-surface-page dark:bg-surface p-4">
          {job.postingType && job.postingType !== 'regular' && (
            <View className="mb-2">
              <PostingTypeBadge type={job.postingType as PostingType} size="sm" />
            </View>
          )}

          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            {job.title}
          </Text>
          <Text className="mb-3 text-sm text-content-secondary font-sans">위치 {locationName}</Text>

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
                <Badge key={`${item}-${index}`} variant="default" size="sm" className="mb-1 mr-1">
                  {item}
                </Badge>
              ))}
            </View>
          )}
        </View>

        <View className="mb-6">
          {isFixedMode ? (
            <FixedRoleSelector
              selectedRoleId={selectedFixedRoleId}
              onSelect={setSelectedFixedRoleId}
              disabled={isSubmitting}
              options={postingFacts.application.availableRoleOptions}
            />
          ) : (
            <AssignmentSelector
              jobPosting={job}
              selectedAssignments={selectedAssignments}
              onSelectionChange={setSelectedAssignments}
              disabled={isSubmitting}
            />
          )}
        </View>

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
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            자기소개 <Text className="text-content-placeholder font-sans">(선택)</Text>
          </Text>
          {/*
            키보드 UX 주석 (Impeccable §20):
            - 키보드 회피 / keyboardShouldPersistTaps / keyboardDismissMode 는 부모 SheetModal 이
              KeyboardAvoidingView + ScrollView 로 이미 처리한다 (중복 래핑 금지).
            - 단일 선택(자기소개) multiline 필드이므로 returnKeyType 체인 불필요.
            - autoFocus 미사용 (스크롤 점프 / 키보드 경합 방지).
          */}
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="간단한 자기소개나 경력을 입력해 주세요"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            multiline
            numberOfLines={4}
            maxLength={200}
            editable={!isSubmitting}
            returnKeyType="default"
            blurOnSubmit={false}
            className="min-h-[120px] rounded-lg bg-surface-page dark:bg-surface p-4 text-base font-sans text-content-primary dark:text-off-white"
            textAlignVertical="top"
          />
          <Text className="mt-1 text-right text-xs text-content-placeholder font-sans">
            {message.length}/200
          </Text>
        </View>

        <View className="mb-4 rounded-lg bg-surface-page dark:bg-surface p-4">
          <Pressable
            onPress={() => !isSubmitting && setProvisionConsentAgreed((prev) => !prev)}
            disabled={isSubmitting}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: provisionConsentAgreed, disabled: isSubmitting }}
            accessibilityLabel="필수 이 공고 구인자에게 내 이름·연락처가 전달되는 것에 동의"
            testID="provision-consent-checkbox"
            className="flex-row items-start"
          >
            <View
              className={`mr-3 mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
                provisionConsentAgreed
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-secondary-300 bg-white dark:border-surface-overlay dark:bg-surface'
              } ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {provisionConsentAgreed && <CheckIcon size={14} color="#09090B" />}
            </View>
            <View className="flex-1">
              <Text className="text-sm leading-5 text-content-primary dark:text-off-white font-sans">
                <Text className="text-error-500 font-sans">[필수]</Text> 이 공고 구인자에게 내
                이름·연락처가 전달되는 것에 동의합니다.
              </Text>
              <Text className="mt-1 text-xs text-content-secondary font-sans">
                보유 기간: 채용 종료 후 3개월
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="mb-6 rounded-lg bg-surface-page dark:bg-surface p-4">
          <Text className="text-xs leading-5 text-content-secondary font-sans">
            지원 후에는 구인자가 지원서를 확인합니다.
            {'\n'}
            채용 결과는 알림으로 안내됩니다.
            {'\n'}
            지원 취소는 &apos;내 스케줄&apos; 탭에서 할 수 있어요.
          </Text>
        </View>
      </View>
    </SheetModal>
  );
}
