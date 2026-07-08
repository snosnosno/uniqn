import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import { getRoleDisplayName } from '@/types/unified';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

export interface ApplicantProfileHeaderProps {
  applicant: ApplicantWithDetails;
  displayName: string;
  profilePhotoURL: string | null | undefined;
  profilePhotoURLBlurhash?: string | null | undefined;
  isProfileLoading: boolean;
  appliedTimeAgo: string;
}

const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  applied: 'primary',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  completed: 'success',
  cancellation_pending: 'warning',
};

export const ApplicantProfileHeader = React.memo(function ApplicantProfileHeader({
  applicant,
  displayName,
  profilePhotoURL,
  profilePhotoURLBlurhash,
  isProfileLoading,
  appliedTimeAgo,
}: ApplicantProfileHeaderProps) {
  const roleLabel = getRoleDisplayName(
    applicant.assignments[0]?.roleIds?.[0] ?? 'other',
    applicant.customRole
  );
  const metaText = [roleLabel, appliedTimeAgo].filter(Boolean).join(' · ');

  return (
    <View className="items-center bg-surface-page dark:bg-surface py-4">
      {isProfileLoading ? (
        <View className="mb-2 h-16 w-16 items-center justify-center rounded-sm bg-secondary-200 dark:bg-surface">
          <ActivityIndicator size="small" color={SECONDARY_PALETTE[500]} />
        </View>
      ) : (
        <Avatar
          source={profilePhotoURL ?? undefined}
          name={displayName}
          size="xl"
          className="mb-2"
          blurhash={profilePhotoURLBlurhash}
        />
      )}

      <View className="mb-1 flex-row items-center gap-2">
        <Text className="text-xl font-display text-content-primary dark:text-off-white">
          {displayName}
        </Text>
        <Badge variant={STATUS_BADGE_VARIANT[applicant.status]} size="sm" dot>
          {APPLICATION_STATUS_LABELS[applicant.status]}
        </Badge>
      </View>

      {metaText ? (
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          {metaText}
        </Text>
      ) : null}
    </View>
  );
});
