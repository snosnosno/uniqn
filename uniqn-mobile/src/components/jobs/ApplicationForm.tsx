/**
 * UNIQN Mobile - 지원서 폼 컴포넌트
 *
 * @description 구인공고 지원 폼 (v2.0: Assignment, PreQuestion 지원, 고정공고 지원)
 * @version 2.1.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AssignmentSelector } from './AssignmentSelector';
import { PreQuestionForm } from './PreQuestionForm';
import { PostingTypeBadge } from './PostingTypeBadge';
import { RoleSalaryDisplay } from './RoleSalaryDisplay';
import { FixedScheduleDisplay } from './FixedScheduleDisplay';
import type {
  JobPosting,
  Assignment,
  PreQuestionAnswer,
  PostingType,
} from '@/types';
import {
  initializePreQuestionAnswers,
  findUnansweredRequired,
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { getAllowanceItems } from '@/utils/allowanceUtils';

// ============================================================================
// Types
// ============================================================================

interface ApplicationFormProps {
  job: JobPosting;
  visible: boolean;
  isSubmitting: boolean;
  /** v2.0: Assignment 배열 + 사전질문 답변 */
  onSubmit: (
    assignments: Assignment[],
    message?: string,
    preQuestionAnswers?: PreQuestionAnswer[]
  ) => void;
  onClose: () => void;
}

/**
 * 역할 표시용 통합 인터페이스
 */
interface RoleDisplayItem {
  /** 역할 키 (선택 값으로 사용) */
  key: string;
  /** 표시 이름 */
  displayName: string;
  /** 필요 인원 */
  count: number;
  /** 충원된 인원 */
  filled: number;
}

// ============================================================================
// Component
// ============================================================================

export function ApplicationForm({
  job,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: ApplicationFormProps) {
  // 고정공고 모드 판단: postingType === 'fixed'이면 고정공고
  const isFixedMode = job.postingType === 'fixed';

  // 고정공고용 상태
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // 다중 날짜 모드 상태
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>(
    () => initializePreQuestionAnswers(job.preQuestions ?? [])
  );
  const [errorQuestionIds, setErrorQuestionIds] = useState<string[]>([]);

  // 사전질문 여부
  const hasPreQuestions = Boolean(
    job.usesPreQuestions && job.preQuestions && job.preQuestions.length > 0
  );

  // 사용 가능한 역할 (레거시 및 고정공고) - 통합 타입으로 변환
  const availableRoles: RoleDisplayItem[] = useMemo(() => {
    if (isFixedMode) {
      // 고정공고: requiredRolesWithCount 우선, 없으면 roles fallback
      // 고정공고는 장기 채용이므로 마감 필터링 없이 모든 역할 표시
      const fixedRoles = job.requiredRolesWithCount || [];

      if (fixedRoles.length > 0) {
        return fixedRoles.map((r, idx): RoleDisplayItem => ({
          key: r.name || r.role || `role-${idx}`,
          displayName: r.name || getRoleDisplayName(r.role || ''),
          count: r.count,
          filled: r.filled ?? 0,
        }));
      }

      // fallback: roles 필드 사용
      const legacyRoles = job.roles || [];
      return legacyRoles.map((r, idx): RoleDisplayItem => {
        const roleWithCustom = r as typeof r & { customRole?: string };
        const effectiveKey = (r.role as string) === 'other' && roleWithCustom.customRole
          ? roleWithCustom.customRole
          : r.role || `role-${idx}`;
        return {
          key: effectiveKey,
          displayName: getRoleDisplayName(r.role || '', roleWithCustom.customRole),
          count: r.count ?? 0,
          filled: r.filled ?? 0,
        };
      });
    }
    // 일반공고: roles 사용
    const roles = job.roles || [];
    return roles
      .filter((r) => (r.filled ?? 0) < r.count)
      .map((r, idx): RoleDisplayItem => {
        // 커스텀 역할이면 customRole을 키로 사용
        const roleWithCustom = r as typeof r & { customRole?: string };
        const effectiveKey = (r.role as string) === 'other' && roleWithCustom.customRole
          ? roleWithCustom.customRole
          : r.role || `role-${idx}`;
        return {
          key: effectiveKey,
          displayName: getRoleDisplayName(r.role || '', roleWithCustom.customRole),
          count: r.count ?? 0,
          filled: r.filled ?? 0,
        };
      });
  }, [isFixedMode, job.requiredRolesWithCount, job.roles]);

  // 제출 가능 여부 판단
  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;

    // 고정공고: 역할만 선택
    if (isFixedMode) {
      if (selectedRole === null || availableRoles.length === 0) return false;

      // 사전질문이 있으면 필수 답변 확인
      if (hasPreQuestions) {
        const unanswered = findUnansweredRequired(preQuestionAnswers);
        if (unanswered.length > 0) return false;
      }

      return true;
    }

    // 다중 날짜 모드: Assignment가 1개 이상 선택되어야 함
    if (selectedAssignments.length === 0) return false;

    // 사전질문이 있으면 필수 답변 확인
    if (hasPreQuestions) {
      const unanswered = findUnansweredRequired(preQuestionAnswers);
      if (unanswered.length > 0) return false;
    }

    return true;
  }, [
    isSubmitting,
    isFixedMode,
    selectedAssignments,
    hasPreQuestions,
    preQuestionAnswers,
    selectedRole,
    availableRoles,
  ]);

  // 제출 핸들러
  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    // 사전질문 필수 답변 검증
    if (hasPreQuestions) {
      const unanswered = findUnansweredRequired(preQuestionAnswers);
      if (unanswered.length > 0) {
        setErrorQuestionIds(unanswered);
        return;
      }
    }

    // 고정공고: 역할 선택을 Assignment로 변환
    if (isFixedMode && selectedRole) {
      const fixedAssignment: Assignment = {
        dates: [FIXED_DATE_MARKER],
        timeSlot: job.timeSlot?.split(/[-~]/)[0]?.trim() || FIXED_TIME_MARKER,
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

    // 다중 날짜 모드: Assignment 배열 제출
    onSubmit(
      selectedAssignments,
      message.trim() || undefined,
      hasPreQuestions ? preQuestionAnswers : undefined
    );
  }, [
    canSubmit,
    isFixedMode,
    selectedAssignments,
    message,
    hasPreQuestions,
    preQuestionAnswers,
    selectedRole,
    onSubmit,
    job.timeSlot,
  ]);

  // 닫기 핸들러 (상태 초기화)
  const handleClose = useCallback(() => {
    setSelectedRole(null);
    setMessage('');
    setSelectedAssignments([]);
    setPreQuestionAnswers(initializePreQuestionAnswers(job.preQuestions ?? []));
    setErrorQuestionIds([]);
    onClose();
  }, [job.preQuestions, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* 헤더 */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Pressable onPress={handleClose} className="p-2 -ml-2" accessibilityLabel="닫기">
            <Text className="text-gray-600 dark:text-gray-400 text-lg">✕</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            지원하기
          </Text>
          <View className="w-8" />
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* 공고 정보 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            {/* 공고 타입 뱃지 (v2.0) - regular가 아닌 경우만 표시 */}
            {job.postingType && job.postingType !== 'regular' && (
              <View className="mb-2">
                <PostingTypeBadge
                  type={job.postingType as PostingType}
                  size="sm"
                />
              </View>
            )}

            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {job.title}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              📍 {job.location.name}
            </Text>

            {/* 급여 표시 (v2.0: 역할별 급여) - 크게 표시 */}
            <View className="mb-2">
              <RoleSalaryDisplay
                roles={job.roles}
                useSameSalary={job.useSameSalary}
                defaultSalary={job.defaultSalary}
                compact={false}
              />
            </View>

            {/* 수당 표시 (v2.0) */}
            {(() => {
              const allowanceItems = getAllowanceItems(job.allowances);
              if (allowanceItems.length === 0) return null;
              return (
                <View className="flex-row flex-wrap mt-1">
                  {allowanceItems.map((item, idx) => (
                    <Badge key={idx} variant="default" size="sm" className="mr-1 mb-1">
                      {item}
                    </Badge>
                  ))}
                </View>
              );
            })()}

            {/* 고정공고: 근무 일정 표시 (읽기 전용) */}
            {isFixedMode && (
              <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  근무 조건
                </Text>
                <FixedScheduleDisplay
                  daysPerWeek={job.daysPerWeek}
                  startTime={job.timeSlot?.split(/[-~]/)[0]?.trim()}
                  isStartTimeNegotiable={job.isStartTimeNegotiable}
                  compact={true}
                />
              </View>
            )}
          </View>

          {/* 고정공고: 역할만 선택 */}
          {isFixedMode ? (
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                지원할 역할 선택 <Text className="text-error-500">*</Text>
              </Text>

              {availableRoles.length === 0 ? (
                <View className="bg-error-50 dark:bg-error-900/30 rounded-lg p-4 border border-error-200 dark:border-error-800">
                  <Text className="text-error-600 dark:text-error-400 text-center font-medium">
                    현재 모집 중인 역할이 없습니다
                  </Text>
                  <Text className="text-error-500 dark:text-error-500 text-center text-xs mt-1">
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
                        className={`
                          flex-row items-center justify-between p-4 rounded-lg border-2
                          ${isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }
                          ${isSubmitting ? 'opacity-50' : ''}
                        `}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`
                              w-5 h-5 rounded-full border-2 mr-3 items-center justify-center
                              ${isSelected
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-gray-300 dark:border-gray-600'
                              }
                            `}
                          >
                            {isSelected && (
                              <View className="w-2 h-2 rounded-full bg-white" />
                            )}
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
            /* 다중 날짜 모드: AssignmentSelector */
            <View className="mb-6">
              <AssignmentSelector
                jobPosting={job}
                selectedAssignments={selectedAssignments}
                onSelectionChange={setSelectedAssignments}
                disabled={isSubmitting}
              />
            </View>
          )}

          {/* 사전질문 폼 (v2.0) */}
          {hasPreQuestions && (
            <View className="mb-6">
              <PreQuestionForm
                questions={job.preQuestions ?? []}
                answers={preQuestionAnswers}
                onAnswersChange={setPreQuestionAnswers}
                disabled={isSubmitting}
                errorQuestionIds={errorQuestionIds}
              />
            </View>
          )}

          {/* 메시지 입력 (선택) */}
          <View className="mb-6">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              자기소개 <Text className="text-gray-400">(선택)</Text>
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="간단한 자기소개나 경력을 입력하세요"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!isSubmitting}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-gray-900 dark:text-white text-base min-h-[120px]"
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
              {message.length}/500
            </Text>
          </View>

          {/* 안내 문구 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5">
              • 지원 후에는 구인자가 지원서를 확인합니다.{'\n'}
              • 수락 시 알림으로 안내해드립니다.{'\n'}
              • 지원 후 취소는 마이페이지에서 가능합니다.
            </Text>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            fullWidth
          >
            지원하기
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default ApplicationForm;
