/**
 * UNIQN Mobile - 지원자 카드 컴포넌트
 *
 * @description 구인자가 지원자 정보를 확인하는 카드 (v2.4 - 리팩토링)
 * @version 2.4.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, LayoutAnimation } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Card } from '../../../ui/Card';
import { FixedScheduleDisplay } from '../../../jobs/FixedScheduleDisplay';
import { formatRelativeTime } from '@/utils/date';
import { useUserProfile } from '@/hooks/useUserProfile';

// 분리된 모듈 import
import type { ApplicantCardProps, IconColors } from './types';
import { getRoleDisplayName } from '@/types/unified';
import { STATUS } from '@/constants';
import { useAssignmentSelection } from './useAssignmentSelection';
import {
  CardHeader,
  AppliedActions,
  ConfirmedActions,
  GroupedAssignmentSelector,
  AssignmentReadOnly,
  ContactInfo,
  StatusInfo,
} from './components';

// ============================================================================
// Component
// ============================================================================

export const ApplicantCard = React.memo(function ApplicantCard({
  applicant,
  onConfirm,
  onReject,
  onCancelConfirmation,
  onConvertToStaff,
  onViewProfile,
  showActions = true,
  showConfirmationHistory = true,
  initialExpanded = true,
  postingType,
  daysPerWeek,
  startTime,
}: ApplicantCardProps) {
  // 고정공고 모드 판단 (props 우선, 없으면 applicant.jobPosting에서 추출)
  const effectivePostingType = postingType ?? applicant.jobPosting?.postingType;
  const isFixedMode = effectivePostingType === 'fixed';
  // 고정공고용 근무 정보 (props 우선, 없으면 jobPosting에서 추출)
  const effectiveDaysPerWeek = daysPerWeek ?? applicant.jobPosting?.daysPerWeek;
  const effectiveStartTime = startTime ?? applicant.jobPosting?.timeSlot?.split(/[-~]/)[0]?.trim();
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode: isDark } = useThemeStore();

  // 아이콘 색상 (다크모드 대응)
  const iconColors = useMemo<IconColors>(
    () => ({
      checked: isDark ? '#93C5FD' : '#1D4ED8',
      unchecked: isDark ? '#D1D5DB' : '#374151',
    }),
    [isDark]
  );

  // 펼침/접힘 상태
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // 일정 선택 훅 사용
  const {
    selectedKeys,
    assignmentDisplays,
    groupedAssignments,
    selectedCount,
    totalCount,
    toggleAssignment,
    toggleGroup,
    getGroupSelectionState,
    getSelectedAssignments,
  } = useAssignmentSelection({
    assignments: applicant.assignments,
    isFixedMode,
  });

  // 사용자 프로필 조회
  const { displayName, profilePhotoURL, userProfile } = useUserProfile({
    userId: applicant.applicantId,
    fallbackName: applicant.applicantName,
  });

  // 지원일 계산
  const appliedTimeAgo = useMemo(() => {
    if (!applicant.createdAt) return '';

    const date =
      typeof applicant.createdAt === 'string'
        ? new Date(applicant.createdAt)
        : applicant.createdAt instanceof Date
          ? applicant.createdAt
          : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant.createdAt]);

  // 펼침/접힘 토글
  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  // 프로필 보기 핸들러
  const handleViewProfile = useCallback(() => {
    onViewProfile?.(applicant);
  }, [applicant, onViewProfile]);

  // 확정 핸들러
  const handleConfirm = useCallback(() => {
    if (isFixedMode) {
      onConfirm?.(applicant);
      return;
    }

    const selectedAssignments = getSelectedAssignments();
    if (selectedAssignments.length > 0) {
      onConfirm?.(applicant, selectedAssignments);
    } else {
      onConfirm?.(applicant);
    }
  }, [applicant, onConfirm, getSelectedAssignments, isFixedMode]);

  // 거절 핸들러
  const handleReject = useCallback(() => {
    onReject?.(applicant);
  }, [applicant, onReject]);

  // 확정 취소 핸들러
  const handleCancelConfirmation = useCallback(() => {
    onCancelConfirmation?.(applicant);
  }, [applicant, onCancelConfirmation]);

  // 스태프 변환 핸들러
  const handleConvertToStaff = useCallback(() => {
    onConvertToStaff?.(applicant);
  }, [applicant, onConvertToStaff]);

  // 확정 상태 액션 표시 여부
  const canShowConfirmedActions =
    showActions &&
    applicant.status === STATUS.APPLICATION.CONFIRMED &&
    (onCancelConfirmation || onConvertToStaff);

  // 액션 버튼 표시 여부
  const canShowActions = showActions && applicant.status === STATUS.APPLICATION.APPLIED;

  return (
    <Card variant="elevated" padding="md">
      {/* 헤더 */}
      <CardHeader
        displayName={displayName}
        profilePhotoURL={profilePhotoURL}
        isRead={applicant.isRead ?? true}
        status={applicant.status}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
        onViewProfile={onViewProfile ? handleViewProfile : undefined}
      />

      {/* === 펼침 영역 === */}
      {isExpanded && (
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
          {/* 지원 역할 & 시간 요약 */}
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {getRoleDisplayName(
              applicant.assignments[0]?.roleIds?.[0] || 'other',
              applicant.customRole
            )}{' '}
            지원 · {appliedTimeAgo}
          </Text>

          {/* 고정공고: 근무 조건 표시 (날짜 선택 없음) */}
          {isFixedMode && (
            <View
              className={`mb-3 p-3 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">근무 조건</Text>
              <FixedScheduleDisplay
                daysPerWeek={effectiveDaysPerWeek}
                startTime={effectiveStartTime}
                compact={true}
              />
            </View>
          )}

          {/* 일정 선택 - 그룹화된 뷰 (고정공고 제외, applied 상태) */}
          {!isFixedMode && canShowActions && (
            <GroupedAssignmentSelector
              groupedAssignments={groupedAssignments}
              selectedKeys={selectedKeys}
              selectedCount={selectedCount}
              totalCount={totalCount}
              isDark={isDark}
              iconColors={iconColors}
              onToggle={toggleAssignment}
              onToggleGroup={toggleGroup}
              getGroupSelectionState={getGroupSelectionState}
            />
          )}

          {/* 일정 읽기 전용 (고정공고 제외, confirmed/rejected 상태) */}
          {!isFixedMode && !canShowActions && (
            <AssignmentReadOnly
              assignmentDisplays={assignmentDisplays}
              isDark={isDark}
              iconColors={iconColors}
            />
          )}

          {/* 연락처 정보 */}
          <ContactInfo
            phone={userProfile?.phone || applicant.applicantPhone}
            message={applicant.message}
            preQuestionAnswers={applicant.preQuestionAnswers}
          />

          {/* 상태 정보 */}
          <StatusInfo
            status={applicant.status}
            rejectionReason={applicant.rejectionReason}
            confirmationHistory={applicant.confirmationHistory}
            showConfirmationHistory={showConfirmationHistory}
          />
        </View>
      )}

      {/* 확정 상태 액션 버튼 */}
      {canShowConfirmedActions && (
        <ConfirmedActions
          onCancelConfirmation={onCancelConfirmation ? handleCancelConfirmation : undefined}
          onConvertToStaff={onConvertToStaff ? handleConvertToStaff : undefined}
        />
      )}

      {/* 액션 버튼 */}
      {canShowActions && (
        <AppliedActions
          isFixedMode={isFixedMode}
          totalCount={totalCount}
          selectedCount={selectedCount}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}
    </Card>
  );
});

export default ApplicantCard;
