/**
 * UNIQN Mobile - 스태프 관리 탭 컴포넌트
 *
 * @description 확정 스태프 목록 및 관리 기능 통합
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ConfirmedStaffList } from './ConfirmedStaffList';
import { StaffProfileModal } from './StaffProfileModal';
import { WorkTimeEditor } from './WorkTimeEditor';
import { Loading } from '../ui/Loading';
import { ErrorState } from '../ui/ErrorState';
import { ConfirmModal } from '../ui/Modal';
import { ActionSheet, type ActionSheetOption } from '../ui/ActionSheet';
import { QRCodeIcon, RefreshIcon, CheckCircleIcon, ClockIcon, CalendarIcon } from '../icons';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { logger } from '@/utils/logger';
import type { ConfirmedStaff, JobPosting, WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface StaffManagementTabProps {
  jobPostingId: string;
  /** @todo 향후 공고 상세 정보 표시에 사용 예정 (급여, 근무시간 등) */
  jobPosting?: JobPosting;
  onShowEventQR?: () => void;
  onShowRoleChange?: (staff: ConfirmedStaff) => void;
  onShowReport?: (staff: ConfirmedStaff) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

interface QuickActionsProps {
  onShowQR: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function QuickActions({
  onShowQR,
  onRefresh,
  isRefreshing,
}: QuickActionsProps) {
  return (
    <View className="px-4 pt-4 mb-4">
      {/* 빠른 액션 버튼 */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onShowQR}
          className="flex-1 flex-row items-center justify-center p-4 bg-primary-600 dark:bg-primary-700 rounded-xl active:opacity-80"
        >
          <QRCodeIcon size={24} color="#FFFFFF" />
          <Text className="ml-2 text-base font-semibold text-white">
            현장 QR 표시
          </Text>
        </Pressable>

        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          className={`p-4 bg-gray-100 dark:bg-gray-800 rounded-xl active:opacity-80 ${isRefreshing ? 'opacity-50' : ''}`}
        >
          <RefreshIcon size={24} color="#6B7280" />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StaffManagementTab({
  jobPostingId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO: 향후 공고 상세 정보 표시에 사용 예정
  jobPosting: _jobPosting,
  onShowEventQR,
  onShowRoleChange,
  onShowReport,
}: StaffManagementTabProps) {

  // 스태프 데이터
  const {
    grouped,
    stats,
    isLoading,
    isRefreshing: isRefetching,
    error,
    refresh: refetch,
    updateWorkTime,
    removeStaff,
    changeStatus,
  } = useConfirmedStaff(jobPostingId);

  // 모달 상태
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmedStaff | null>(null);
  // 프로필 모달 상태
  const [profileStaff, setProfileStaff] = useState<ConfirmedStaff | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  // 상태 변경 ActionSheet 상태
  const [statusSheetTarget, setStatusSheetTarget] = useState<ConfirmedStaff | null>(null);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  // ============================================================================
  // Handlers
  // ============================================================================

  // 스태프 카드 클릭
  const handleStaffPress = useCallback((staff: ConfirmedStaff) => {
    // 상세 정보 표시 또는 액션 시트 표시 (추후 구현)
    logger.debug('Staff pressed', { staffId: staff.id });
  }, []);

  // 프로필 보기
  const handleViewProfile = useCallback((staff: ConfirmedStaff) => {
    setProfileStaff(staff);
    setIsProfileModalVisible(true);
  }, []);

  // 프로필 모달 닫기
  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalVisible(false);
    setProfileStaff(null);
  }, []);

  // 시간 수정
  const handleEditTime = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowTimeEditor(true);
  }, []);

  // 시간 저장
  const handleSaveTime = useCallback(
    (data: { startTime: Date | null; endTime: Date | null; reason: string }) => {
      if (!selectedStaff) return;

      setIsSaving(true);
      // mutation 호출 (토스트는 useConfirmedStaff.onSuccess/onError에서 표시)
      updateWorkTime({
        workLogId: selectedStaff.id,
        checkInTime: data.startTime,
        checkOutTime: data.endTime,
        reason: data.reason,
      });

      setShowTimeEditor(false);
      setSelectedStaff(null);
      setIsSaving(false);
    },
    [selectedStaff, updateWorkTime]
  );

  // 역할 변경
  const handleChangeRole = useCallback(
    (staff: ConfirmedStaff) => {
      onShowRoleChange?.(staff);
    },
    [onShowRoleChange]
  );

  // 신고 (노쇼 포함)
  const handleReport = useCallback(
    (staff: ConfirmedStaff) => {
      onShowReport?.(staff);
    },
    [onShowReport]
  );

  // 스태프 삭제 실행
  // 토스트는 useConfirmedStaff 훅의 onSuccess/onError에서 처리
  const executeDelete = useCallback(
    (staff: ConfirmedStaff) => {
      removeStaff({
        workLogId: staff.id,
        jobPostingId,
        staffId: staff.staffId,
        date: staff.date,
        reason: '구인자에 의한 삭제',
      });
    },
    [removeStaff, jobPostingId]
  );

  // 스태프 삭제 확인 모달 표시
  const handleDelete = useCallback((staff: ConfirmedStaff) => {
    setDeleteTarget(staff);
  }, []);

  // 삭제 확인
  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      executeDelete(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, executeDelete]);

  // QR 표시
  const handleShowQR = useCallback(() => {
    onShowEventQR?.();
  }, [onShowEventQR]);

  // 새로고침
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // 상태 변경 ActionSheet 열기
  const handleStatusChange = useCallback((staff: ConfirmedStaff) => {
    setStatusSheetTarget(staff);
    setShowStatusSheet(true);
  }, []);

  // 상태 변경 ActionSheet에서 옵션 선택
  // 토스트는 useConfirmedStaff 훅의 onSuccess/onError에서 처리
  const handleStatusSelect = useCallback(
    async (value: string) => {
      if (!statusSheetTarget) return;

      try {
        await changeStatus(statusSheetTarget.id, value as 'scheduled' | 'checked_in' | 'checked_out');
      } catch {
        // 에러는 훅의 onError에서 처리됨
      }
    },
    [statusSheetTarget, changeStatus]
  );

  // 상태 변경 옵션 생성 (현재 상태 제외한 3가지 옵션)
  const getStatusOptions = useCallback((): ActionSheetOption[] => {
    if (!statusSheetTarget) return [];

    const currentStatus = statusSheetTarget.status;
    const options: ActionSheetOption[] = [];

    // 출근 예정 옵션 (현재 상태가 아닐 때만)
    if (currentStatus !== 'scheduled') {
      options.push({
        label: '출근 예정으로 변경',
        value: 'scheduled',
        icon: <CalendarIcon size={20} color="#6B7280" />,
      });
    }

    // 출근 처리 옵션 (현재 상태가 아닐 때만)
    if (currentStatus !== 'checked_in') {
      options.push({
        label: '출근 처리',
        value: 'checked_in',
        icon: <CheckCircleIcon size={20} color="#22C55E" />,
      });
    }

    // 퇴근 처리 옵션 (현재 상태가 아닐 때만)
    if (currentStatus !== 'checked_out') {
      options.push({
        label: '퇴근 처리',
        value: 'checked_out',
        icon: <ClockIcon size={20} color="#3B82F6" />,
      });
    }

    return options;
  }, [statusSheetTarget]);

  // ============================================================================
  // Render
  // ============================================================================

  // 로딩 상태
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">
          스태프 목록을 불러오는 중...
        </Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState
        title="스태프 목록을 불러올 수 없습니다"
        message={error.message}
        onRetry={handleRefresh}
      />
    );
  }

  // WorkLog로 변환 (WorkTimeEditor용) - ConfirmedStaff의 프로필 정보 병합
  const selectedWorkLog: WorkLog | null = selectedStaff?.workLog
    ? {
        ...selectedStaff.workLog,
        staffName: selectedStaff.staffName,
        staffNickname: selectedStaff.staffNickname,
        staffPhotoURL: selectedStaff.staffPhotoURL,
      }
    : null;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 빠른 액션 */}
      <QuickActions
        onShowQR={handleShowQR}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
      />

      {/* 스태프 목록 */}
      <View className="flex-1">
        <ConfirmedStaffList
          grouped={grouped}
          stats={stats}
          isLoading={false}
          error={null}
          onRefresh={handleRefresh}
          isRefreshing={isRefetching}
          onStaffPress={handleStaffPress}
          onViewProfile={handleViewProfile}
          onEditTime={handleEditTime}
          onChangeRole={handleChangeRole}
          onReport={handleReport}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          showActions={true}
        />
      </View>

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        workLog={selectedWorkLog}
        visible={showTimeEditor}
        onClose={() => {
          setShowTimeEditor(false);
          setSelectedStaff(null);
        }}
        onSave={handleSaveTime}
        isLoading={isSaving}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="스태프 삭제"
        message={`${deleteTarget?.staffName ?? ''}님을 확정 목록에서 삭제하시겠습니까?\n\n삭제 시 해당 스태프의 근무 기록이 제거됩니다.`}
        confirmText="삭제"
        cancelText="취소"
        isDestructive
      />

      {/* 프로필 모달 */}
      <StaffProfileModal
        visible={isProfileModalVisible}
        onClose={handleCloseProfileModal}
        staff={profileStaff}
      />

      {/* 상태 변경 ActionSheet */}
      <ActionSheet
        visible={showStatusSheet}
        onClose={() => {
          setShowStatusSheet(false);
          setStatusSheetTarget(null);
        }}
        title="상태 변경"
        description={statusSheetTarget ? `${statusSheetTarget.staffName}님의 근무 상태를 변경합니다.` : undefined}
        options={getStatusOptions()}
        onSelect={handleStatusSelect}
      />
    </View>
  );
}

export default StaffManagementTab;
