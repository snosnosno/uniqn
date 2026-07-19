/**
 * UNIQN Mobile - 지원자 관리 화면
 * 특정 공고의 지원자 목록 및 관리
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import { useShare } from '@/hooks/useShare';
import { confirmAction } from '@/utils/confirmAction';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import type { ApplicantWithDetails } from '@/services';
import type { Assignment, PostingManagementViewModel } from '@/types';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';

// ============================================================================
// Main Component
// ============================================================================

export default function ApplicantsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { job, isFixed, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;
  // 고정 공고는 QR 진입점을 노출하지 않는다 (work_log 행 수명 미해결 — _layout.tsx 주석 참고).
  const headerRightAction = !isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={job?.title ?? null} />;

  // 정원 현황 스트립 — 관리 허브(index.tsx)의 "배정 현황" 계산과 동일 소스(job) 재사용, 추가 fetch 없음
  const postingFacts = useMemo(() => (job ? buildPostingFacts(job) : null), [job]);
  const managementView = useMemo(
    () =>
      postingFacts
        ? (projectPostingSurface(postingFacts, {
            audience: 'employer',
            surface: 'manage',
          }) as PostingManagementViewModel)
        : null,
    [postingFacts]
  );

  const { shareJobById } = useShare();
  const handleSharePosting = useCallback(() => {
    void shareJobById(jobPostingId || '');
  }, [jobPostingId, shareJobById]);

  const {
    applicants,
    isLoading,
    isRefreshing,
    error,
    refresh,
    confirmWithHistory,
    rejectApplication,
    cancelConfirmationAsync,
    bulkConfirm,
    isConfirmingWithHistory,
    isRejecting,
    isBulkConfirming,
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
        title: '확정 해제',
        message: '이 지원자의 확정을 해제할까요?\n점유된 자리가 다시 비워집니다.',
        confirmText: '확정 해제',
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
          <Text className="mt-4 text-content-secondary font-sans">
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
          error={error}
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
      {/* 정원 현황 스트립 */}
      {managementView ? (
        <View className="flex-row items-center justify-center border-b border-secondary-100 bg-white px-4 py-2 dark:border-surface-overlay dark:bg-surface">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            확정{' '}
            <Text className="font-sans-bold text-content-primary dark:text-off-white">
              {managementView.filledPositions}
            </Text>
            {' / 정원 '}
            <Text className="font-sans-bold text-content-primary dark:text-off-white">
              {managementView.totalPositions}
            </Text>
            명
          </Text>
        </View>
      ) : null}
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
        onBulkConfirm={bulkConfirm}
        isBulkConfirming={isBulkConfirming}
        onSharePosting={handleSharePosting}
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
