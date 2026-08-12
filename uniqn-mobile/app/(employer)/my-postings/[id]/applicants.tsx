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
import { useSubmitGate } from '@/hooks/useSubmitGate';
import { confirmAction } from '@/utils/confirmAction';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import type { ApplicantWithDetails } from '@/services';
import type { Assignment, PostingManagementViewModel } from '@/types';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import { useManualRefresh } from '@/hooks/useManualRefresh';

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
    error,
    refresh,
    confirmWithHistoryAsync,
    rejectApplicationAsync,
    cancelConfirmationAsync,
    bulkConfirm,
    isBulkConfirming,
    markAsRead,
  } = useApplicantManagement(jobPostingId || '', { realtime: true });

  // PTR 스피너는 사용자가 당겼을 때만 — 조회 상태를 그대로 물리면 화면에 들어올 때마다
  // 배경 재조회로 스피너가 뜬다(useManualRefresh 주석 참고).
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = useManualRefresh(() =>
    refresh()
  );

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

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedApplicant(null);
    setSelectedAssignmentsForConfirm(undefined);
  }, []);

  // 확정/거절 (APPL-7) — 결과를 보고 성공에서만 닫는다.
  // 옛 코드는 mutate 를 쏘고 **동기적으로** 모달을 닫아, 실패하면 사용자가 입력한 메모·사유가
  // 통째로 사라지고 에러 토스트만 남았다. 그래서 모달의 isLoading prop 도 렌더될 일이 없는
  // 죽은 코드였다. 성공/실패 토스트는 mutation 훅이 담당한다.
  const confirmGate = useSubmitGate<[string | undefined]>({
    action: (notes) =>
      confirmWithHistoryAsync({
        applicationId: selectedApplicant?.id ?? '',
        selectedAssignments: selectedAssignmentsForConfirm,
        notes,
      }),
    onSuccess: handleCloseModal,
    errorMessage: '지원자 확정 실패',
  });

  const rejectGate = useSubmitGate<[string | undefined]>({
    action: (reason) =>
      rejectApplicationAsync({ applicationId: selectedApplicant?.id ?? '', reason }),
    onSuccess: handleCloseModal,
    errorMessage: '지원자 거절 실패',
  });

  const handleModalConfirm = useCallback(
    (notes?: string) => {
      if (!selectedApplicant) return;
      void confirmGate.submit(notes);
    },
    [selectedApplicant, confirmGate]
  );

  const handleModalReject = useCallback(
    (reason?: string) => {
      if (!selectedApplicant) return;
      void rejectGate.submit(reason);
    },
    [selectedApplicant, rejectGate]
  );

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

  // 에러 상태 — 보여줄 목록이 하나도 없을 때만 화면을 통째로 뺏는다.
  // 이미 받아둔 지원자가 있는데 갱신만 실패한 경우까지 전체 교체하면, 사장은 승인해야 할
  // 지원자를 눈앞에서 잃는다(공고 상세 index.tsx 와 같은 축).
  if (error && applicants.length === 0) {
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

  const isProcessing = confirmGate.isSubmitting || rejectGate.isSubmitting;

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
      {/* 목록은 살아 있는데 갱신만 실패한 상태 — 목록을 유지한 채 얇게만 알린다. */}
      {error && applicants.length > 0 ? (
        <View className="px-4 pt-2">
          <ErrorState compact error={error} onRetry={() => refresh()} />
        </View>
      ) : null}

      {/* 지원자 목록 */}
      <ApplicantList
        applicants={applicants}
        isLoading={isLoading}
        // 목록이 있으면 error 를 넘기지 않는다 — 넘기면 ApplicantList 가 자체 ErrorState 로
        // 리스트를 통째로 덮어(ApplicantList.tsx:246) 위의 좁힌 가드가 무의미해진다.
        error={applicants.length === 0 ? error : null}
        onRefresh={onPullRefresh}
        isRefreshing={pullRefreshing}
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
        totalAssignmentCount={selectedApplicant?.assignments?.length}
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
