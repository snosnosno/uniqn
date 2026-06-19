import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import type { WorkLogStatus } from '@/shared/status';
import type { ConfirmedStaff, JobPosting, WorkLog } from '@/types';
import { logger } from '@/utils/logger';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  QRCodeIcon,
  RefreshIcon,
} from '@/components/icons';
import { ActionSheet, type ActionSheetOption } from '@/components/ui/ActionSheet';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmModal } from '@/components/ui/Modal';
import { ConfirmedStaffList } from './ConfirmedStaffList';
import { StaffProfileModal } from './StaffProfileModal';
import { WorkTimeEditor } from '../settlement/WorkTimeEditor';

export interface StaffManagementTabProps {
  jobPostingId: string;
  jobPosting?: JobPosting;
  onShowEventQR?: () => void;
  onShowRoleChange?: (staff: ConfirmedStaff) => void;
  onShowReport?: (staff: ConfirmedStaff) => void;
}

interface QuickActionsProps {
  onShowQR: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function QuickActions({ onShowQR, onRefresh, isRefreshing }: QuickActionsProps) {
  return (
    <View className="mb-4 px-4 pt-4">
      <View className="flex-row gap-3">
        <Pressable
          onPress={onShowQR}
          className="flex-1 flex-row items-center justify-center rounded-md bg-primary-600 p-4 active:opacity-80 dark:bg-primary-700"
        >
          <QRCodeIcon size={24} color="#FFFFFF" />
          <Text className="ml-2 text-base font-sans-semibold text-content-onGold">
            이벤트 QR 열기
          </Text>
        </Pressable>

        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          className={`rounded-md bg-surface-card p-4 active:opacity-80 dark:bg-surface ${
            isRefreshing ? 'opacity-50' : ''
          }`}
        >
          <RefreshIcon size={24} color={SECONDARY_PALETTE[500]} />
        </Pressable>
      </View>
    </View>
  );
}

export function StaffManagementTab({
  jobPostingId,
  jobPosting: _jobPosting,
  onShowEventQR,
  onShowRoleChange,
  onShowReport,
}: StaffManagementTabProps) {
  const {
    grouped,
    isLoading,
    isRefreshing,
    error,
    refresh,
    updateWorkTime,
    removeStaff,
    changeStatus,
    isUpdatingTime,
  } = useConfirmedStaff(jobPostingId);

  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmedStaff | null>(null);
  const [profileStaff, setProfileStaff] = useState<ConfirmedStaff | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [statusSheetTarget, setStatusSheetTarget] = useState<ConfirmedStaff | null>(null);

  const handleStaffPress = useCallback((staff: ConfirmedStaff) => {
    logger.debug('Confirmed staff pressed', { workLogId: staff.id });
  }, []);

  const handleViewProfile = useCallback((staff: ConfirmedStaff) => {
    setProfileStaff(staff);
    setIsProfileModalVisible(true);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalVisible(false);
    setProfileStaff(null);
  }, []);

  const handleEditTime = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowTimeEditor(true);
  }, []);

  const handleSaveTime = useCallback(
    (data: { startTime: Date | null; endTime: Date | null; reason: string }) => {
      if (!selectedStaff) {
        return;
      }

      updateWorkTime({
        workLogId: selectedStaff.id,
        checkInTime: data.startTime,
        checkOutTime: data.endTime,
        reason: data.reason,
      });

      setShowTimeEditor(false);
      setSelectedStaff(null);
    },
    [selectedStaff, updateWorkTime]
  );

  const handleChangeRole = useCallback(
    (staff: ConfirmedStaff) => {
      onShowRoleChange?.(staff);
    },
    [onShowRoleChange]
  );

  const handleReport = useCallback(
    (staff: ConfirmedStaff) => {
      onShowReport?.(staff);
    },
    [onShowReport]
  );

  const executeDelete = useCallback(
    (staff: ConfirmedStaff) => {
      removeStaff({
        workLogId: staff.id,
        jobPostingId,
        staffId: staff.staffId,
        date: staff.date,
        reason: '확정 스태프 관리에서 제거',
      });
    },
    [jobPostingId, removeStaff]
  );

  const handleDelete = useCallback((staff: ConfirmedStaff) => {
    setDeleteTarget(staff);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    executeDelete(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, executeDelete]);

  const handleShowQR = useCallback(() => {
    onShowEventQR?.();
  }, [onShowEventQR]);

  const handleStatusChange = useCallback((staff: ConfirmedStaff) => {
    setStatusSheetTarget(staff);
  }, []);

  const handleStatusSelect = useCallback(
    (status: string) => {
      if (!statusSheetTarget) {
        return;
      }

      changeStatus(statusSheetTarget.id, status as WorkLogStatus);
    },
    [changeStatus, statusSheetTarget]
  );

  const getStatusOptions = useCallback((): ActionSheetOption[] => {
    if (!statusSheetTarget) {
      return [];
    }

    const currentStatus = statusSheetTarget.status;
    const options: ActionSheetOption[] = [];

    if (currentStatus !== STATUS.WORK_LOG.SCHEDULED) {
      options.push({
        label: '출근 예정으로 변경',
        value: STATUS.WORK_LOG.SCHEDULED,
        icon: <CalendarIcon size={20} color={SECONDARY_PALETTE[500]} />,
      });
    }

    if (currentStatus !== STATUS.WORK_LOG.CHECKED_IN) {
      options.push({
        label: '출근 처리',
        value: STATUS.WORK_LOG.CHECKED_IN,
        icon: <CheckCircleIcon size={20} color="#22C55E" />,
      });
    }

    if (currentStatus !== STATUS.WORK_LOG.CHECKED_OUT) {
      options.push({
        label: '퇴근 처리',
        value: STATUS.WORK_LOG.CHECKED_OUT,
        icon: <ClockIcon size={20} color="#8A7228" />,
      });
    }

    if (currentStatus !== STATUS.WORK_LOG.COMPLETED) {
      options.push({
        label: '근무 완료 처리',
        value: STATUS.WORK_LOG.COMPLETED,
        icon: <CheckCircleIcon size={20} color="#22C55E" />,
      });
    }

    return options;
  }, [statusSheetTarget]);

  const selectedWorkLog: WorkLog | null = selectedStaff?.workLog
    ? {
        ...selectedStaff.workLog,
        staffName: selectedStaff.staffName,
        staffNickname: selectedStaff.staffNickname,
        staffPhotoURL: selectedStaff.staffPhotoURL,
        staffPhotoURLBlurhash: selectedStaff.staffPhotoURLBlurhash,
      }
    : null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
          확정된 스태프를 불러오는 중입니다...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState title="확정된 스태프를 불러오지 못했습니다" error={error} onRetry={refresh} />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      <QuickActions onShowQR={handleShowQR} onRefresh={refresh} isRefreshing={isRefreshing} />

      <View className="flex-1">
        <ConfirmedStaffList
          grouped={grouped}
          isLoading={false}
          error={null}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          onStaffPress={handleStaffPress}
          onViewProfile={handleViewProfile}
          onEditTime={handleEditTime}
          onChangeRole={handleChangeRole}
          onReport={handleReport}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          showActions
        />
      </View>

      <WorkTimeEditor
        workLog={selectedWorkLog}
        visible={showTimeEditor}
        onClose={() => {
          setShowTimeEditor(false);
          setSelectedStaff(null);
        }}
        onSave={handleSaveTime}
        isLoading={isUpdatingTime}
      />

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="확정 스태프 제거"
        message={`${
          deleteTarget?.staffName ?? '선택한 스태프'
        }를 확정 목록에서 제거할까요? 이 작업은 확정을 취소하고 점유된 자리를 다시 비웁니다.`}
        confirmText="제거"
        cancelText="유지"
        isDestructive
      />

      <StaffProfileModal
        visible={isProfileModalVisible}
        onClose={handleCloseProfileModal}
        staff={profileStaff}
      />

      <ActionSheet
        visible={Boolean(statusSheetTarget)}
        onClose={() => setStatusSheetTarget(null)}
        title="상태 변경"
        description={
          statusSheetTarget
            ? `${statusSheetTarget.staffName ?? '스태프'}님의 근무 상태를 선택하세요.`
            : undefined
        }
        options={getStatusOptions()}
        onSelect={handleStatusSelect}
      />
    </View>
  );
}

export default StaffManagementTab;
