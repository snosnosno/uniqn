/**
 * UNIQN Mobile - 지원서 컴포넌트
 *
 * @description 구인공고 지원 폼. canonical JobPosting 을 직접 소비한다.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AssignmentSelector } from './AssignmentSelector';
import { PreQuestionForm } from './PreQuestionForm';
import { PostingTypeBadge } from './PostingTypeBadge';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import type { JobPosting, Assignment, PreQuestionAnswer, PostingType } from '@/types';
import { getPostingDefaultSalary, getPostingRoleStats } from '@/domains/job-posting';
import {
  initializePreQuestionAnswers,
  findUnansweredRequired,
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { getAllowanceItems } from '@/utils/allowanceUtils';

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

interface RoleDisplayItem {
  key: string;
  displayName: string;
  count: number;
  filled: number;
}

export function ApplicationForm({
  job,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: ApplicationFormProps) {
  const roleStats = useMemo(() => getPostingRoleStats(job), [job]);
  const defaultSalary = useMemo(
    () => getPostingDefaultSalary(job.roleCatalog, job.compensation),
    [job.roleCatalog, job.compensation]
  );
  const questions = useMemo(() => job.questions.items ?? [], [job.questions.items]);
  const isFixedMode = job.postingType === 'fixed';

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>(() =>
    initializePreQuestionAnswers(questions)
  );
  const [errorQuestionIds, setErrorQuestionIds] = useState<string[]>([]);

  const hasPreQuestions = questions.length > 0;

  const availableRoles: RoleDisplayItem[] = useMemo(() => {
    const candidates = isFixedMode
      ? roleStats
      : roleStats.filter((role) => (role.filled ?? 0) < role.count);

    return candidates.map((role, idx) => ({
      key: role.role === 'other' && role.customRole ? role.customRole : role.role || `role-${idx}`,
      displayName: getRoleDisplayName(role.role || '', role.customRole),
      count: role.count,
      filled: role.filled ?? 0,
    }));
  }, [isFixedMode, roleStats]);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;

    if (isFixedMode) {
      if (selectedRole === null || availableRoles.length === 0) return false;
      if (hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0) return false;
      return true;
    }

    if (selectedAssignments.length === 0) return false;
    if (hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0) return false;
    return true;
  }, [
    isSubmitting,
    isFixedMode,
    selectedRole,
    availableRoles.length,
    hasPreQuestions,
    preQuestionAnswers,
    selectedAssignments.length,
  ]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    if (hasPreQuestions) {
      const unanswered = findUnansweredRequired(preQuestionAnswers);
      if (unanswered.length > 0) {
        setErrorQuestionIds(unanswered);
        return;
      }
    }

    if (isFixedMode && selectedRole) {
      const fixedAssignment: Assignment = {
        dates: [FIXED_DATE_MARKER],
        timeSlot:
          (job.schedule.kind === 'fixed' ? job.schedule.startTime : undefined) || FIXED_TIME_MARKER,
        roleIds: [selectedRole],
        isGrouped: false,
      };

      onSubmit(
        [fixedAssignment],
        message.trim() || undefined,
        hasPreQuestions ? preQuestionAnswers : undefined
      );
      return;
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
    job.schedule,
    message,
    onSubmit,
    preQuestionAnswers,
    selectedAssignments,
    selectedRole,
  ]);

  const handleClose = useCallback(() => {
    setSelectedRole(null);
    setMessage('');
    setSelectedAssignments([]);
    setPreQuestionAnswers(initializePreQuestionAnswers(questions));
    setErrorQuestionIds([]);
    onClose();
  }, [onClose, questions]);

  const footerContent = (
    <Button onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} fullWidth>
      지원하기
    </Button>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title="지원하기"
      footer={footerContent}
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
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            📍 {job.location.name}
          </Text>

          <View className="mb-2">
            <RoleSalaryDisplay
              roles={roleStats}
              useSameSalary={job.compensation.mode === 'shared'}
              defaultSalary={defaultSalary}
              compact={false}
            />
          </View>

          {(() => {
            const allowanceItems = getAllowanceItems(job.compensation.allowances);
            if (allowanceItems.length === 0) return null;
            return (
              <View className="mt-1 flex-row flex-wrap">
                {allowanceItems.map((item, idx) => (
                  <Badge key={idx} variant="default" size="sm" className="mr-1 mb-1">
                    {item}
                  </Badge>
                ))}
              </View>
            );
          })()}

          {isFixedMode && (
            <View className="mt-3 border-t border-gray-200 pt-3 dark:border-surface-overlay">
              <Text className="mb-2 text-xs text-gray-500 dark:text-gray-400">근무 조건</Text>
              <FixedScheduleDisplay
                daysPerWeek={job.schedule.kind === 'fixed' ? job.schedule.daysPerWeek : undefined}
                startTime={job.schedule.kind === 'fixed' ? job.schedule.startTime : undefined}
                isStartTimeNegotiable={
                  job.schedule.kind === 'fixed' ? job.schedule.isStartTimeNegotiable : undefined
                }
                compact={true}
              />
            </View>
          )}
        </View>

        {isFixedMode ? (
          <View className="mb-6">
            <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
              지원할 역할 선택 <Text className="text-error-500">*</Text>
            </Text>

            {availableRoles.length === 0 ? (
              <View className="rounded-lg border border-error-200 bg-error-50 p-4 dark:border-error-800 dark:bg-error-900/30">
                <Text className="text-center font-medium text-error-600 dark:text-error-400">
                  현재 모집 중인 역할이 없습니다
                </Text>
                <Text className="mt-1 text-center text-xs text-error-500 dark:text-error-500">
                  다른 공고를 확인해주세요
                </Text>
              </View>
            ) : (
              <View className="flex-col gap-2">
                {availableRoles.map((roleItem, index) => {
                  const isSelected = selectedRole === roleItem.key;

                  return (
                    <Pressable
                      key={`${roleItem.key}-${index}`}
                      onPress={() => setSelectedRole(roleItem.key)}
                      disabled={isSubmitting}
                      className={`flex-row items-center justify-between rounded-lg border-2 p-4 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
                      } ${isSubmitting ? 'opacity-50' : ''}`}
                    >
                      <View className="flex-row items-center">
                        <View
                          className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300 dark:border-surface-overlay'
                          }`}
                        >
                          {isSelected && <View className="h-2 w-2 rounded-full bg-white" />}
                        </View>
                        <Text
                          className={`text-base font-medium ${
                            isSelected
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {roleItem.displayName}
                        </Text>
                      </View>
                      <Badge variant="primary" size="sm">
                        {roleItem.count}명 모집
                      </Badge>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
            placeholder="간단한 자기소개나 경력을 입력하세요"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            maxLength={200}
            editable={!isSubmitting}
            className="min-h-[120px] rounded-lg bg-gray-50 p-4 text-base text-gray-900 dark:bg-surface dark:text-white"
            textAlignVertical="top"
          />
          <Text className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {message.length}/200
          </Text>
        </View>

        <View className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-surface">
          <Text className="text-xs leading-5 text-gray-500 dark:text-gray-400">
            지원 후에는 구인자가 지원서를 확인합니다.{'\n'}채용 여부는 알림으로 안내드립니다.
            {'\n'}지원 취소는 마이페이지에서 가능합니다.
          </Text>
        </View>
      </View>
    </SheetModal>
  );
}

export default ApplicationForm;
