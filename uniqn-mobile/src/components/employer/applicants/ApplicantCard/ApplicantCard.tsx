import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Text, View } from 'react-native';
import { buildPostingFacts } from '@/domains/job-posting';
import { STATUS } from '@/constants';
import { getRoleDisplayName } from '@/types/unified';
import { useThemeStore } from '@/stores/themeStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatRelativeTime } from '@/utils/date';
import { CardStripe } from '@/components/ui';
import { FixedScheduleDisplay } from '@/components/jobs/FixedScheduleDisplay';
import type { ApplicantCardProps, IconColors } from './types';
import { STATUS_STRIPE_TONE } from './constants';
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
      checked: isDark ? '#E8C84E' : '#B8962E',
      unchecked: isDark ? SECONDARY_PALETTE[200] : SECONDARY_PALETTE[700],
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

  const { displayName, profilePhotoURL, profilePhotoURLBlurhash, userProfile } = useUserProfile({
    userId: applicant.applicantId,
    fallbackName: applicant.applicantName,
    fallbackNickname: applicant.applicantNickname,
    fallbackPhotoURL: applicant.applicantPhotoURL,
    fallbackPhotoURLBlurhash: applicant.applicantPhotoURLBlurhash,
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
    <CardStripe tone={STATUS_STRIPE_TONE[applicant.status]}>
      <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
        <CardHeader
          displayName={displayName}
          profilePhotoURL={profilePhotoURL}
          profilePhotoURLBlurhash={profilePhotoURLBlurhash}
          isRead={applicant.isRead ?? true}
          status={applicant.status}
          isExpanded={isExpanded}
          onToggleExpand={toggleExpand}
          onViewProfile={onViewProfile ? handleViewProfile : undefined}
          bubbleScore={userProfile?.bubbleScore?.score}
          reviewCount={userProfile?.bubbleScore?.totalReviewCount}
        />

        {isExpanded && (
          <View className="mt-3 border-t border-secondary-100 pt-3 dark:border-surface-overlay">
            <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
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
                <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
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
      </View>
    </CardStripe>
  );
});

export default ApplicantCard;
