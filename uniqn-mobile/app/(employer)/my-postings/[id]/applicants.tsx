/**
 * UNIQN Mobile - 지원자 관리 화면
 * 특정 공고의 지원자 목록 및 관리
 */

import React, { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ApplicantList,
  ApplicantConfirmModal,
  ApplicantProfileModal,
  type ConfirmModalAction,
} from '@/components/employer';
import { Loading, ErrorState } from '@/components';
import { StackHeader } from '@/components/headers';
import { useApplicantManagement } from '@/hooks/applicant';
import { confirmAction } from '@/utils/confirmAction';
import type { ApplicantWithDetails } from '@/services';
import type { Assignment } from '@/types';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';

// ============================================================================
// Main Component
// ============================================================================

export default function ApplicantsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { job, isFixed, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;
  const headerRightAction = !isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={job?.title ?? null} />;

  const {
    applicants,
    isLoading,
    isRefreshing,
    error,
    refresh,
    confirmWithHistory,
    rejectApplication,
    cancelConfirmationAsync,
    isConfirmingWithHistory,
    isRejecting,
    markAsRead,
  } = useApplicantManagement(jobPostingId || '', { realtime: true });

  // 모달 상태
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantWithDetails | null>(null);
  const [modalAction, setModalAction] = useState<ConfirmModalAction>('confirm');
  const [isModalVisible, setIsModalVisible] = useState(false);
  // 선택된 일정 (확정 시 전달)
  const [selectedAssignmentsForConfirm, setSelectedAssignmentsForConfirm] = useState<
    Assignment[] | undefined
  >(undefined);

  // 프로필 모달 상태
  const [profileApplicant, setProfileApplicant] = useState<ApplicantWithDetails | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  // 프로필 상세보기
  const handleViewProfile = useCallback(
    (applicant: ApplicantWithDetails) => {
      if (!applicant.isRead) {
        markAsRead(applicant.id);
      }
      setProfileApplicant(applicant);
      setIsProfileModalVisible(true);
    },
    [markAsRead]
  );

  // 프로필 모달 닫기
  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalVisible(false);
    setProfileApplicant(null);
  }, []);

  // 확정 버튼 클릭
  const handleConfirm = useCallback(
    (applicant: ApplicantWithDetails, selectedAssignments?: Assignment[]) => {
      setSelectedApplicant(applicant);
      setSelectedAssignmentsForConfirm(selectedAssignments);
      setModalAction('confirm');
      setIsModalVisible(true);
    },
    []
  );

  // 거절 버튼 클릭
  const handleReject = useCallback((applicant: ApplicantWithDetails) => {
    setSelectedApplicant(applicant);
    setModalAction('reject');
    setIsModalVisible(true);
  }, []);

  // 확정 취소 (확정된 스태프 un-confirm) — 점유 자리 반납. 파괴적 액션이라 확인 다이얼로그.
  const handleCancelConfirmation = useCallback(
    (applicant: ApplicantWithDetails) => {
      confirmAction({
        title: '확정 취소',
        message: '이 지원자의 확정을 취소할까요?\n점유된 자리가 다시 비워집니다.',
        confirmText: '확정 취소',
        destructive: true,
        onConfirm: async () => {
          await cancelConfirmationAsync({ applicationId: applicant.id });
        },
      });
    },
    [cancelConfirmationAsync]
  );

  // 모달에서 확정 처리
  const handleModalConfirm = useCallback(
    (notes?: string) => {
      if (!selectedApplicant) return;

      confirmWithHistory({
        applicationId: selectedApplicant.id,
        selectedAssignments: selectedAssignmentsForConfirm,
        notes,
      });
      setIsModalVisible(false);
      setSelectedApplicant(null);
      setSelectedAssignmentsForConfirm(undefined);
    },
    [selectedApplicant, selectedAssignmentsForConfirm, confirmWithHistory]
  );

  // 모달에서 거절 처리
  const handleModalReject = useCallback(
    (reason?: string) => {
      if (!selectedApplicant) return;

      rejectApplication({
        applicationId: selectedApplicant.id,
        reason,
      });
      setIsModalVisible(false);
      setSelectedApplicant(null);
    },
    [selectedApplicant, rejectApplication]
  );

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedApplicant(null);
    setSelectedAssignmentsForConfirm(undefined);
  }, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="지원자 관리"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
            지원자 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="지원자 관리"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <ErrorState
          title="지원자 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={() => refresh()}
        />
      </SafeAreaView>
    );
  }

  const isProcessing = isConfirmingWithHistory || isRejecting;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="지원자 관리"
        titleSuffix={headerTitleSuffix}
        fallbackHref={headerBackHref}
        rightAction={headerRightAction}
      />
      {/* 지원자 목록 */}
      <ApplicantList
        applicants={applicants}
        isLoading={isLoading}
        error={error}
        onRefresh={() => refresh()}
        isRefreshing={isRefreshing}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onCancelConfirmation={handleCancelConfirmation}
        onViewProfile={handleViewProfile}
      />

      {/* 확정/거절 모달 */}
      <ApplicantConfirmModal
        visible={isModalVisible}
        onClose={handleCloseModal}
        applicant={selectedApplicant}
        action={modalAction}
        onConfirm={handleModalConfirm}
        onReject={handleModalReject}
        isLoading={isProcessing}
        selectedAssignments={selectedAssignmentsForConfirm}
      />

      {/* 프로필 상세보기 모달 */}
      <ApplicantProfileModal
        visible={isProfileModalVisible}
        onClose={handleCloseProfileModal}
        applicant={profileApplicant}
      />
    </SafeAreaView>
  );
}
