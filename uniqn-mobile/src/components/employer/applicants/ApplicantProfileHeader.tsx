/**
 * UNIQN Mobile - 지원자 프로필 헤더
 *
 * @description 지원자 아바타, 이름, 상태 뱃지, 지원 역할/시간 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { APPLICATION_STATUS_LABELS } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantProfileHeaderProps {
  applicant: ApplicantWithDetails;
  displayName: string;
  profilePhotoURL: string | null | undefined;
  isProfileLoading: boolean;
  appliedTimeAgo: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  applied: 'primary',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  completed: 'success',
  cancellation_pending: 'warning',
};

// ============================================================================
// Component
// ============================================================================

export const ApplicantProfileHeader = React.memo(function ApplicantProfileHeader({
  applicant,
  displayName,
  profilePhotoURL,
  isProfileLoading,
  appliedTimeAgo,
}: ApplicantProfileHeaderProps) {
  return (
    <View className="items-center py-4 bg-gray-50 dark:bg-surface">
      {isProfileLoading ? (
        <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mb-2">
          <ActivityIndicator size="small" color="#6B7280" />
        </View>
      ) : (
        <Avatar source={profilePhotoURL ?? undefined} name={displayName} size="xl" className="mb-2" />
      )}
      {/* 이름 + 상태 뱃지 (같은 행) */}
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
        <Badge variant={STATUS_BADGE_VARIANT[applicant.status]} size="sm" dot>
          {APPLICATION_STATUS_LABELS[applicant.status]}
        </Badge>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {getRoleDisplayName(
          applicant.assignments[0]?.roleIds?.[0] || 'other',
          applicant.customRole
        )}{' '}
        지원 · {appliedTimeAgo}
      </Text>
    </View>
  );
});

export default ApplicantProfileHeader;
