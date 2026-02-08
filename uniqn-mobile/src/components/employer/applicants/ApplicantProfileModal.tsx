/**
 * UNIQN Mobile - 지원자 프로필 상세보기 모달
 *
 * @description 지원자의 상세 프로필 정보를 표시하는 모달
 * @version 2.0.0 - 서브컴포넌트 분해 (Header, Content, Assignments)
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { SheetModal } from '../../ui/SheetModal';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatRelativeTime } from '@/utils/dateUtils';
import { ApplicantProfileHeader } from './ApplicantProfileHeader';
import { ApplicantProfileContent } from './ApplicantProfileContent';
import { ApplicantProfileAssignments } from './ApplicantProfileAssignments';
import type { ApplicantWithDetails } from '@/services';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantProfileModalProps {
  visible: boolean;
  onClose: () => void;
  applicant: ApplicantWithDetails | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function ApplicantProfileModal({ visible, onClose, applicant }: ApplicantProfileModalProps) {
  // 사용자 프로필 조회 (모달이 열려있고 applicant가 있을 때만)
  const { userProfile, isLoading: isProfileLoading, displayName, profilePhotoURL } = useUserProfile({
    userId: applicant?.applicantId,
    enabled: visible,
    fallbackName: applicant?.applicantName,
  });

  const appliedTimeAgo = useMemo(() => {
    if (!applicant?.createdAt) return '';

    const date =
      typeof applicant.createdAt === 'string'
        ? new Date(applicant.createdAt)
        : applicant.createdAt instanceof Date
          ? applicant.createdAt
          : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant?.createdAt]);

  if (!applicant) return null;

  return (
    <SheetModal visible={visible} onClose={onClose} title="지원자 프로필">
      <View>
        {/* 프로필 헤더 */}
        <ApplicantProfileHeader
          applicant={applicant}
          displayName={displayName}
          profilePhotoURL={profilePhotoURL}
          isProfileLoading={isProfileLoading}
          appliedTimeAgo={appliedTimeAgo}
        />

        {/* 프로필 정보 + 연락처 + 메시지 + 사전질문 + 상태 + 이력 */}
        <ApplicantProfileContent
          applicant={applicant}
          userProfile={userProfile}
        />

        {/* 지원 일정 (Assignments) */}
        {applicant.assignments && applicant.assignments.length > 0 && (
          <ApplicantProfileAssignments assignments={applicant.assignments} />
        )}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default ApplicantProfileModal;
