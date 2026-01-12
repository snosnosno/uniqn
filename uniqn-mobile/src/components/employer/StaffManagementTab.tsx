/**
 * UNIQN Mobile - 스태프 관리 탭 컴포넌트
 *
 * @description 확정 스태프 목록 및 관리 기능 통합
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ConfirmedStaffList } from './ConfirmedStaffList';
import { WorkTimeEditor } from './WorkTimeEditor';
import { Loading } from '../ui/Loading';
import { ErrorState } from '../ui/ErrorState';
import { ConfirmModal } from '../ui/Modal';
import { QRCodeIcon, RefreshIcon } from '../icons';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { ConfirmedStaff, JobPosting, WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface StaffManagementTabProps {
  jobPostingId: string;
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
  jobPosting: _jobPosting,
  onShowEventQR,
  onShowRoleChange,
  onShowReport,
}: StaffManagementTabProps) {
  const { addToast } = useToastStore();

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
  } = useConfirmedStaff(jobPostingId);

  // 모달 상태
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmedStaff | null>(null);

  // ============================================================================
  // Handlers
  // ============================================================================

  // 스태프 카드 클릭
  const handleStaffPress = useCallback((staff: ConfirmedStaff) => {
    // 상세 정보 표시 또는 액션 시트 표시 (추후 구현)
    logger.debug('Staff pressed', { staffId: staff.id });
  }, []);

  // 시간 수정
  const handleEditTime = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowTimeEditor(true);
  }, []);

  // 시간 저장
  const handleSaveTime = useCallback(
    async (data: { startTime: Date | null; endTime: Date | null; reason: string }) => {
      if (!selectedStaff) return;

      setIsSaving(true);
      try {
        updateWorkTime({
          workLogId: selectedStaff.id,
          checkInTime: data.startTime,
          checkOutTime: data.endTime,
          reason: data.reason,
        });

        addToast({
          type: 'success',
          message: '근무 시간이 수정되었습니다.',
        });

        setShowTimeEditor(false);
        setSelectedStaff(null);
      } catch (err) {
        addToast({
          type: 'error',
          message: '시간 수정에 실패했습니다. 다시 시도해주세요.',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [selectedStaff, updateWorkTime, addToast]
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
  const executeDelete = useCallback(
    async (staff: ConfirmedStaff) => {
      try {
        removeStaff({
          workLogId: staff.id,
          jobPostingId,
          staffId: staff.staffId,
          date: staff.date,
          reason: '구인자에 의한 삭제',
        });

        addToast({
          type: 'success',
          message: `${staff.staffName}님이 삭제되었습니다.`,
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: '삭제에 실패했습니다.',
        });
      }
    },
    [removeStaff, jobPostingId, addToast]
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

  // WorkLog로 변환 (WorkTimeEditor용)
  const selectedWorkLog: WorkLog | null = selectedStaff?.workLog ?? null;

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
          onEditTime={handleEditTime}
          onChangeRole={handleChangeRole}
          onReport={handleReport}
          onDelete={handleDelete}
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
    </View>
  );
}

export default StaffManagementTab;
