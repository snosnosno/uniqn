/**
 * UNIQN Mobile - Staff Management Tab
 */

import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { logger } from '@/utils/logger';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import type { ConfirmedStaff, JobPosting, WorkLog } from '@/types';
import { QRCodeIcon, RefreshIcon } from '../../icons';
import { ErrorState } from '../../ui/ErrorState';
import { Loading } from '../../ui/Loading';
import { ConfirmModal } from '../../ui/Modal';
import { StaffProfileModal } from './StaffProfileModal';
import { ConfirmedStaffList } from './ConfirmedStaffList';
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
          className="flex-1 flex-row items-center justify-center rounded-xl bg-primary-600 p-4 active:opacity-80 dark:bg-primary-700"
        >
          <QRCodeIcon size={24} color="#FFFFFF" />
          <Text className="ml-2 text-base font-semibold text-white">Open event QR</Text>
        </Pressable>

        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          className={`rounded-xl bg-gray-100 p-4 active:opacity-80 dark:bg-surface ${
            isRefreshing ? 'opacity-50' : ''
          }`}
        >
          <RefreshIcon size={24} color="#6B7280" />
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
    isUpdatingTime,
  } = useConfirmedStaff(jobPostingId);

  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmedStaff | null>(null);
  const [profileStaff, setProfileStaff] = useState<ConfirmedStaff | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

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
        reason: 'Removed from confirmed staff management',
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

  const selectedWorkLog: WorkLog | null = selectedStaff?.workLog
    ? {
        ...selectedStaff.workLog,
        staffName: selectedStaff.staffName,
        staffNickname: selectedStaff.staffNickname,
        staffPhotoURL: selectedStaff.staffPhotoURL,
      }
    : null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading confirmed staff...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load confirmed staff"
        message={error.message}
        onRetry={refresh}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
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
        title="Remove confirmed staff"
        message={`Remove ${deleteTarget?.staffName ?? 'this staff member'} from the confirmed staff list? This cancels the confirmation and releases the occupied slot.`}
        confirmText="Remove"
        cancelText="Keep"
        isDestructive
      />

      <StaffProfileModal
        visible={isProfileModalVisible}
        onClose={handleCloseProfileModal}
        staff={profileStaff}
      />
    </View>
  );
}

export default StaffManagementTab;
