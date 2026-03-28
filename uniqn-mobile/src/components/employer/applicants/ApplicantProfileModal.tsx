import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatRelativeTime } from '@/utils/date';
import type { ApplicantWithDetails } from '@/services';
import { SheetModal } from '../../ui/SheetModal';
import { ApplicantProfileAssignments } from './ApplicantProfileAssignments';
import { ApplicantProfileContent } from './ApplicantProfileContent';
import { ApplicantProfileHeader } from './ApplicantProfileHeader';

export interface ApplicantProfileModalProps {
  visible: boolean;
  onClose: () => void;
  applicant: ApplicantWithDetails | null;
}

export function ApplicantProfileModal({ visible, onClose, applicant }: ApplicantProfileModalProps) {
  const {
    userProfile,
    isLoading: isProfileLoading,
    displayName,
    profilePhotoURL,
  } = useUserProfile({
    userId: applicant?.applicantId,
    enabled: visible,
    fallbackName: applicant?.applicantName,
  });

  const appliedTimeAgo = useMemo(
    () => formatRelativeTime(applicant?.createdAt),
    [applicant?.createdAt]
  );

  if (!applicant) {
    return null;
  }

  return (
    <SheetModal visible={visible} onClose={onClose} title="지원자 프로필">
      <View>
        <ApplicantProfileHeader
          applicant={applicant}
          displayName={displayName}
          profilePhotoURL={profilePhotoURL}
          isProfileLoading={isProfileLoading}
          appliedTimeAgo={appliedTimeAgo}
        />

        <ApplicantProfileContent applicant={applicant} userProfile={userProfile} />

        {applicant.assignments && applicant.assignments.length > 0 ? (
          <ApplicantProfileAssignments assignments={applicant.assignments} />
        ) : null}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default ApplicantProfileModal;
