/**
 * UNIQN Mobile - 지원자 관리 화면
 * 특정 공고의 지원자 목록 및 관리
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ApplicantList,
  ApplicantConfirmModal,
  ApplicantProfileModal,
  toApplicantFilter,
  type ConfirmModalAction,
} from '@/components/employer';
import { ErrorState } from '@/components';
import { PostingSurfaceState, SeatFillSummary } from '@/components/jobs';
import { StackHeader } from '@/components/headers';
import { useApplicantManagement } from '@/hooks/applicant';
import { useShare } from '@/hooks/useShare';
import { useSubmitGate } from '@/hooks/useSubmitGate';
import { UNDO_TOAST_DURATION_MS, UNDO_TOAST_LABEL } from '@/constants/undoToast';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import type { ApplicantWithDetails } from '@/services';
import type { Assignment, PostingManagementViewModel } from '@/types';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import { useManualRefresh } from '@/hooks/useManualRefresh';

// ============================================================================
// Main Component
// ============================================================================

export default function ApplicantsScreen() {
  // filter — 허브의 통계 숫자에서 넘어온 초기 필터. 값이 이상하면 조용히 'all' 로 떨어진다
  // (딥링크·수기 URL 로 아무 문자열이나 올 수 있다).
  const { id: jobPostingId, filter } = useLocalSearchParams<{ id: string; filter?: string }>();
  const initialFilter = useMemo(() => toApplicantFilter(filter), [filter]);
  const { job, isFixed, handleShowQR } = useJobDetailContext();
  const addToast = useToastStore((s) => s.addToast);
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

  // 확정 취소(확정된 스태프 un-confirm) — 점유 자리 반납.
  //
  // 확인 다이얼로그로 앞을 막던 것을 **실행하고 되돌리기**로 바꿨다. 확정/해제는 사장이
  // 지원자 목록을 훑으며 반복하는 조작인데, 매번 네이티브 Alert 가 뜨면 흐름이 끊긴다.
  // 되돌리기가 성립하는 이유는 재확정 인자(배정)를 해제 **전에** 캡처하기 때문이다.
  //
  // ⚠️ 되돌리기가 항상 성공하지는 않는다 — 그 사이 협업자가 같은 자리를 채웠거나 서버
  //   정원 가드에 걸리면 재확정이 실패한다. 그때는 뮤테이션 훅의 에러 토스트가 사실대로
  //   알린다(조용히 성공한 척하지 않는다).
  // ⚠️ action 토스트는 dedupe 면제라 지원자별 per-id 가드가 필수다(undoToast.ts 주석).
  const revertingIdsRef = useRef<Set<string>>(new Set());
  const handleCancelConfirmation = useCallback(
    (applicant: ApplicantWithDetails) => {
      if (revertingIdsRef.current.has(applicant.id)) {
        return;
      }
      revertingIdsRef.current.add(applicant.id);
      // 해제 후에는 서버가 배정을 비울 수 있으므로 지금 값을 붙잡아 둔다.
      const previousAssignments = applicant.assignments;

      void (async () => {
        try {
          await cancelConfirmationAsync({ applicationId: applicant.id });
          addToast({
            type: 'success',
            message: '확정을 해제했어요. 점유된 자리가 다시 비었습니다.',
            duration: UNDO_TOAST_DURATION_MS,
            action: {
              label: UNDO_TOAST_LABEL,
              onPress: () => {
                void confirmWithHistoryAsync({
                  applicationId: applicant.id,
                  selectedAssignments: previousAssignments,
                }).catch((error) => {
                  // 실패 토스트는 뮤테이션 훅이 담당한다. 여기서는 rejection 만 삼킨다.
                  logger.error('확정 해제 되돌리기 실패', toError(error), {
                    applicationId: applicant.id,
                  });
                });
              },
            },
          });
        } catch (error) {
          // 해제 실패 토스트도 뮤테이션 훅이 담당 — 화면이 중복 발행하지 않는다.
          logger.error('확정 해제 실패', toError(error), { applicationId: applicant.id });
        } finally {
          revertingIdsRef.current.delete(applicant.id);
        }
      })();
    },
    [addToast, cancelConfirmationAsync, confirmWithHistoryAsync]
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
        {/* 스켈레톤 통일(S2-9) — 허브는 스켈레톤인데 자식 화면만 스피너라, 탭을 옮길 때마다
            로딩 표현이 바뀌어 같은 앱이 아닌 것처럼 보였다. */}
        <PostingSurfaceState mode="loading" scope="manage" />
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
      {/* 좌석 현황 스트립 — 이 숫자는 work_logs 축(filledPositions)이다.
          종전에는 "확정 N / 정원 M 명"이라 불렀는데, 같은 화면의 필터 탭 "확정 (N)" 은
          applications 축이라 **같은 이름의 두 숫자가 서로 달랐다**. 좌석 표기는 허브와
          같은 컴포넌트로 통일한다("확정"은 applications 축 전용 라벨). */}
      {managementView ? (
        <View className="border-b border-secondary-100 bg-white px-4 py-2 dark:border-surface-overlay dark:bg-surface">
          <SeatFillSummary
            filled={managementView.filledPositions}
            total={managementView.totalPositions}
          />
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
        initialFilter={initialFilter}
        jobPostingId={jobPostingId}
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
