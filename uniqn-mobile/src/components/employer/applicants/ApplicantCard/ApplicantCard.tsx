import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Text, View } from 'react-native';
import { buildPostingFacts } from '@/domains/job-posting';
import { STATUS } from '@/constants';
import { getRoleDisplayName } from '@/types/unified';
import { useThemeStore } from '@/stores/themeStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatRelativeTime } from '@/utils/date';
import { Card } from '../../../ui/Card';
import { FixedScheduleDisplay } from '../../../jobs/FixedScheduleDisplay';
import type { ApplicantCardProps, IconColors } from './types';
import { useAssignmentSelection } from './useAssignmentSelection';
import {
  AppliedActions,
  AssignmentReadOnly,
  CardHeader,
  ConfirmedActions,
  ContactInfo,
  GroupedAssignmentSelector,
  StatusInfo,
} from './components';

export const ApplicantCard = React.memo(function ApplicantCard({
  applicant,
  onConfirm,
  onReject,
  onCancelConfirmation,
  onViewProfile,
  showActions = true,
  showConfirmationHistory = true,
  initialExpanded = true,
  postingType,
  daysPerWeek,
  startTime,
}: ApplicantCardProps) {
  const postingFacts = useMemo(
    () => (applicant.jobPosting ? buildPostingFacts(applicant.jobPosting) : null),
    [applicant.jobPosting]
  );
  const isFixedMode = postingFacts?.workflow.isFixed ?? postingType === 'fixed';
  const effectiveDaysPerWeek = daysPerWeek ?? postingFacts?.schedule.display.fixed?.daysPerWeek;
  const effectiveStartTime =
    startTime ??
    postingFacts?.schedule.display.fixed?.startTime ??
    postingFacts?.schedule.timeSlot?.split(/[-~]/)[0]?.trim();
  const { isDarkMode: isDark } = useThemeStore();

  const iconColors = useMemo<IconColors>(
    () => ({
      checked: isDark ? '#93C5FD' : '#1D4ED8',
      unchecked: isDark ? '#D1D5DB' : '#374151',
    }),
    [isDark]
  );

  const [isExpanded, setIsExpanded] = useState(initialExpanded);

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

  const { displayName, profilePhotoURL, userProfile } = useUserProfile({
    userId: applicant.applicantId,
    fallbackName: applicant.applicantName,
    fallbackNickname: applicant.applicantNickname,
    fallbackPhotoURL: applicant.applicantPhotoURL,
  });

  const appliedTimeAgo = useMemo(
    () => formatRelativeTime(applicant.createdAt),
    [applicant.createdAt]
  );

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  const handleViewProfile = useCallback(() => {
    onViewProfile?.(applicant);
  }, [applicant, onViewProfile]);

  const handleConfirm = useCallback(() => {
    const selectedAssignments = getSelectedAssignments();
    if (selectedAssignments.length > 0) {
      onConfirm?.(applicant, selectedAssignments);
      return;
    }

    onConfirm?.(applicant);
  }, [applicant, getSelectedAssignments, onConfirm]);

  const handleReject = useCallback(() => {
    onReject?.(applicant);
  }, [applicant, onReject]);

  const handleCancelConfirmation = useCallback(() => {
    onCancelConfirmation?.(applicant);
  }, [applicant, onCancelConfirmation]);

  const canShowConfirmedActions =
    showActions &&
    !isFixedMode &&
    applicant.status === STATUS.APPLICATION.CONFIRMED &&
    Boolean(onCancelConfirmation);
  const canShowActions = showActions && applicant.status === STATUS.APPLICATION.APPLIED;

  return (
    <Card variant="elevated" padding="md">
      <CardHeader
        displayName={displayName}
        profilePhotoURL={profilePhotoURL}
        isRead={applicant.isRead ?? true}
        status={applicant.status}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
        onViewProfile={onViewProfile ? handleViewProfile : undefined}
      />

      {isExpanded && (
        <View className="mt-3 border-t border-secondary-100 pt-3 dark:border-surface-overlay">
          <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400">
            {getRoleDisplayName(
              applicant.assignments[0]?.roleIds?.[0] || 'other',
              applicant.customRole
            )}{' '}
            지원 · {appliedTimeAgo}
          </Text>

          {isFixedMode && (
            <View
              className={`mb-3 rounded-lg border p-3 ${
                isDark
                  ? 'border-secondary-600 bg-secondary-700'
                  : 'border-secondary-200 bg-secondary-50'
              }`}
            >
              <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400">
                근무 조건
              </Text>
              <FixedScheduleDisplay
                daysPerWeek={effectiveDaysPerWeek}
                startTime={effectiveStartTime}
                compact={true}
              />
            </View>
          )}

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

          {!isFixedMode && !canShowActions && (
            <AssignmentReadOnly
              assignmentDisplays={assignmentDisplays}
              isDark={isDark}
              iconColors={iconColors}
            />
          )}

          <ContactInfo
            phone={userProfile?.phone || applicant.applicantPhone}
            message={applicant.message}
            preQuestionAnswers={applicant.preQuestionAnswers}
          />

          <StatusInfo
            status={applicant.status}
            rejectionReason={applicant.rejectionReason}
            confirmationHistory={applicant.confirmationHistory}
            showConfirmationHistory={showConfirmationHistory}
          />
        </View>
      )}

      {canShowConfirmedActions && (
        <ConfirmedActions
          onCancelConfirmation={onCancelConfirmation ? handleCancelConfirmation : undefined}
        />
      )}

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
