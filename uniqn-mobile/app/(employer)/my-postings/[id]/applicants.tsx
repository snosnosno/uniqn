/**
 * UNIQN Mobile - 지원자 관리 화면
 * 특정 공고의 지원자 목록 및 관리
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ApplicantList,
  ApplicantConfirmModal,
  ApplicantProfileModal,
  type ConfirmModalAction,
} from '@/components/employer';
import { Loading, ErrorState } from '@/components';
import { useApplicantManagement } from '@/hooks/useApplicantManagement';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStats } from '@/types';

// ============================================================================
// Main Component
// ============================================================================

export default function ApplicantsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();

  const {
    applicants,
    stats: rawStats,
    isLoading,
    error,
    refresh,
    confirmApplication,
    rejectApplication,
    bulkConfirm,
    addToWaitlist,
    isConfirming,
    isRejecting,
    isBulkConfirming,
    isAddingToWaitlist,
    markAsRead,
  } = useApplicantManagement(jobPostingId || '');

  // stats 타입 변환 (ApplicationStats | Record<StaffRole, ApplicationStats> → ApplicationStats)
  const stats = useMemo((): ApplicationStats | undefined => {
    if (!rawStats) return undefined;

    // ApplicationStats인 경우 (total 필드가 있으면 ApplicationStats)
    if ('total' in rawStats && typeof rawStats.total === 'number') {
      return rawStats as ApplicationStats;
    }

    // Record<StaffRole, ApplicationStats>인 경우 - 집계
    const aggregated: ApplicationStats = {
      total: 0,
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      waitlisted: 0,
      completed: 0,
    };

    Object.values(rawStats).forEach((roleStats) => {
      if (roleStats && typeof roleStats === 'object' && 'total' in roleStats) {
        const rs = roleStats as ApplicationStats;
        aggregated.total += rs.total;
        aggregated.applied += rs.applied;
        aggregated.pending += rs.pending;
        aggregated.confirmed += rs.confirmed;
        aggregated.rejected += rs.rejected;
        aggregated.waitlisted += rs.waitlisted;
        aggregated.completed += rs.completed;
      }
    });

    return aggregated;
  }, [rawStats]);

  // 모달 상태
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantWithDetails | null>(null);
  const [modalAction, setModalAction] = useState<ConfirmModalAction>('confirm');
  const [isModalVisible, setIsModalVisible] = useState(false);

  // 프로필 모달 상태
  const [profileApplicant, setProfileApplicant] = useState<ApplicantWithDetails | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  // 지원자 클릭 - 상세 보기 (읽음 처리)
  const handleApplicantPress = useCallback((applicant: ApplicantWithDetails) => {
    if (!applicant.isRead) {
      markAsRead(applicant.id);
    }
  }, [markAsRead]);

  // 프로필 상세보기
  const handleViewProfile = useCallback((applicant: ApplicantWithDetails) => {
    if (!applicant.isRead) {
      markAsRead(applicant.id);
    }
    setProfileApplicant(applicant);
    setIsProfileModalVisible(true);
  }, [markAsRead]);

  // 프로필 모달 닫기
  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalVisible(false);
    setProfileApplicant(null);
  }, []);

  // 확정 버튼 클릭
  const handleConfirm = useCallback((applicant: ApplicantWithDetails) => {
    setSelectedApplicant(applicant);
    setModalAction('confirm');
    setIsModalVisible(true);
  }, []);

  // 거절 버튼 클릭
  const handleReject = useCallback((applicant: ApplicantWithDetails) => {
    setSelectedApplicant(applicant);
    setModalAction('reject');
    setIsModalVisible(true);
  }, []);

  // 대기열 버튼 클릭
  const handleWaitlist = useCallback((applicant: ApplicantWithDetails) => {
    setSelectedApplicant(applicant);
    setModalAction('waitlist');
    setIsModalVisible(true);
  }, []);

  // 모달에서 확정 처리
  const handleModalConfirm = useCallback((notes?: string) => {
    if (!selectedApplicant) return;

    confirmApplication({
      applicationId: selectedApplicant.id,
      notes,
    });
    setIsModalVisible(false);
    setSelectedApplicant(null);
  }, [selectedApplicant, confirmApplication]);

  // 모달에서 거절 처리
  const handleModalReject = useCallback((reason?: string) => {
    if (!selectedApplicant) return;

    rejectApplication({
      applicationId: selectedApplicant.id,
      reason,
    });
    setIsModalVisible(false);
    setSelectedApplicant(null);
  }, [selectedApplicant, rejectApplication]);

  // 모달에서 대기열 처리
  const handleModalWaitlist = useCallback(() => {
    if (!selectedApplicant) return;

    addToWaitlist(selectedApplicant.id);
    setIsModalVisible(false);
    setSelectedApplicant(null);
  }, [selectedApplicant, addToWaitlist]);

  // 일괄 확정
  const handleBulkConfirm = useCallback((selectedApplicants: ApplicantWithDetails[]) => {
    if (selectedApplicants.length === 0) return;

    Alert.alert(
      '일괄 확정',
      `${selectedApplicants.length}명의 지원자를 확정하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확정',
          onPress: () => {
            const ids = selectedApplicants.map((a) => a.id);
            bulkConfirm(ids);
          },
        },
      ]
    );
  }, [bulkConfirm]);

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedApplicant(null);
  }, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            지원자 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ErrorState
          title="지원자 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={() => refresh()}
        />
      </SafeAreaView>
    );
  }

  const isProcessing = isConfirming || isRejecting || isBulkConfirming || isAddingToWaitlist;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 지원자 목록 */}
      <ApplicantList
        applicants={applicants}
        stats={stats}
        isLoading={isLoading}
        error={error}
        onRefresh={() => refresh()}
        isRefreshing={false}
        onApplicantPress={handleApplicantPress}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onWaitlist={handleWaitlist}
        onBulkConfirm={handleBulkConfirm}
        onViewProfile={handleViewProfile}
        showBulkActions={true}
      />

      {/* 확정/거절 모달 */}
      <ApplicantConfirmModal
        visible={isModalVisible}
        onClose={handleCloseModal}
        applicant={selectedApplicant}
        action={modalAction}
        onConfirm={handleModalConfirm}
        onReject={handleModalReject}
        onWaitlist={handleModalWaitlist}
        isLoading={isProcessing}
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
