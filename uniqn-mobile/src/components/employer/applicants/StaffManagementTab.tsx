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
  RefreshIcon,
  UserPlusIcon,
  XCircleIcon,
} from '@/components/icons';
import { getManualStatusTransitions } from '@/domains/staff';
import { formatTimeShort } from '@/utils/formatters';
import { ActionSheet, type ActionSheetOption } from '@/components/ui/ActionSheet';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmModal } from '@/components/ui/Modal';
import { ConfirmedStaffList } from './ConfirmedStaffList';
import { StaffProfileModal } from './StaffProfileModal';
import { AddStaffModal } from './AddStaffModal';
import { WorkTimeEditor } from '../settlement/WorkTimeEditor';

export interface StaffManagementTabProps {
  jobPostingId: string;
  jobPosting?: JobPosting;
  onShowRoleChange?: (staff: ConfirmedStaff) => void;
  onShowReport?: (staff: ConfirmedStaff) => void;
}

/** 상태 전이 값 → 시트 아이콘. 전이 규칙 자체는 getManualStatusTransitions 가 소유한다. */
const STATUS_OPTION_ICON: Record<string, React.ReactElement> = {
  [STATUS.WORK_LOG.SCHEDULED]: <CalendarIcon size={20} color={SECONDARY_PALETTE[500]} />,
  [STATUS.WORK_LOG.CHECKED_IN]: <CheckCircleIcon size={20} color="#22C55E" />,
  [STATUS.WORK_LOG.CHECKED_OUT]: <ClockIcon size={20} color="#8A7228" />,
  [STATUS.WORK_LOG.COMPLETED]: <CheckCircleIcon size={20} color="#22C55E" />,
  [STATUS.WORK_LOG.NO_SHOW]: <XCircleIcon size={20} color="#EF4444" />,
};

/** 출퇴근 기록이 하나라도 있는가 — 되돌리기의 파괴성과 퇴근/완료 노출 여부를 가른다. */
function hasAttendanceRecord(staff: ConfirmedStaff): boolean {
  return Boolean(staff.checkInTime || staff.checkOutTime);
}

interface QuickActionsProps {
  onRefresh: () => void;
  onAddStaff: () => void;
  isRefreshing: boolean;
}

// QR 진입점은 헤더 QR 버튼 하나로 통일됐다 — 여기 있던 "이벤트 QR 열기" 버튼은
// 같은 화면을 여는 중복 진입점이라 제거했다 (도착지는 하나).
function QuickActions({ onRefresh, onAddStaff, isRefreshing }: QuickActionsProps) {
  // 한 행 — 주행동(추가)이 폭을 더 갖고, 새로고침은 보조로 옆에 붙는다.
  // 세로로 쌓았을 때는 목록이 두 번 접힌 만큼 아래로 밀려 첫 스태프가 화면 밖으로 나갔다.
  return (
    <View className="mb-4 flex-row gap-3 px-4 pt-4">
      <Pressable
        onPress={onAddStaff}
        accessibilityRole="button"
        accessibilityLabel="스태프 추가"
        className="flex-[2] min-h-[52px] flex-row items-center justify-center rounded-md bg-primary-600 px-4 py-3 active:opacity-80 dark:bg-primary-700"
      >
        <UserPlusIcon size={20} color="#FFFFFF" />
        <Text className="ml-2 text-base font-sans-semibold text-content-onGold">스태프 추가</Text>
      </Pressable>

      <Pressable
        onPress={onRefresh}
        disabled={isRefreshing}
        accessibilityRole="button"
        accessibilityLabel="스태프 목록 새로고침"
        className={`flex-1 min-h-[52px] flex-row items-center justify-center rounded-md bg-surface-card px-4 py-3 active:opacity-80 dark:bg-surface ${
          isRefreshing ? 'opacity-50' : ''
        }`}
      >
        <RefreshIcon size={20} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-base font-sans-semibold text-content-primary">새로고침</Text>
      </Pressable>
    </View>
  );
}

export function StaffManagementTab({
  jobPostingId,
  jobPosting: _jobPosting,
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
    setNoShow,
    cancelNoShow,
    addStaff,
    isUpdatingTime,
    isAddingStaff,
  } = useConfirmedStaff(jobPostingId, { realtime: true });

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmedStaff | null>(null);
  const [profileStaff, setProfileStaff] = useState<ConfirmedStaff | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [statusSheetTarget, setStatusSheetTarget] = useState<ConfirmedStaff | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<ConfirmedStaff | null>(null);
  /** 출퇴근 기록이 있는 행을 '출근 예정'으로 되돌리기 전 확인 대상 */
  const [revertTarget, setRevertTarget] = useState<ConfirmedStaff | null>(null);
  const [cancelNoShowTarget, setCancelNoShowTarget] = useState<ConfirmedStaff | null>(null);

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

  const handleOpenAddStaff = useCallback(() => {
    setShowAddStaff(true);
  }, []);

  const handleCloseAddStaff = useCallback(() => {
    setShowAddStaff(false);
  }, []);

  const handleStatusChange = useCallback((staff: ConfirmedStaff) => {
    setStatusSheetTarget(staff);
  }, []);

  const handleStatusSelect = useCallback(
    (status: string) => {
      if (!statusSheetTarget) {
        return;
      }

      // 노쇼는 단순 상태 변경(updateStaffStatus)이 아니라 전용 markAsNoShow 경로를 타며
      // 정산 0원 처리를 동반하는 파괴적 액션이라 확인 모달을 경유한다(신고와 분리).
      if (status === STATUS.WORK_LOG.NO_SHOW) {
        setNoShowTarget(statusSheetTarget);
        return;
      }

      // 기록이 있는 행을 '출근 예정'으로 되돌리면 QR 실측 시각이 삭제된다 — 노쇼와 같은 무게의
      // 파괴적 액션이라 무엇이 지워지는지 보여주고 확인을 받는다.
      if (status === STATUS.WORK_LOG.SCHEDULED && hasAttendanceRecord(statusSheetTarget)) {
        setRevertTarget(statusSheetTarget);
        return;
      }

      changeStatus(statusSheetTarget.id, status as WorkLogStatus);
    },
    [changeStatus, statusSheetTarget]
  );

  const handleRevertConfirm = useCallback(() => {
    if (!revertTarget) {
      return;
    }

    changeStatus(revertTarget.id, STATUS.WORK_LOG.SCHEDULED as WorkLogStatus);
    setRevertTarget(null);
  }, [changeStatus, revertTarget]);

  const handleNoShowConfirm = useCallback(() => {
    if (!noShowTarget) {
      return;
    }

    setNoShow(noShowTarget.id, '확정 스태프 관리에서 노쇼 처리');
    setNoShowTarget(null);
  }, [noShowTarget, setNoShow]);

  const handleCancelNoShow = useCallback((staff: ConfirmedStaff) => {
    setCancelNoShowTarget(staff);
  }, []);

  const handleCancelNoShowConfirm = useCallback(() => {
    if (!cancelNoShowTarget) {
      return;
    }

    cancelNoShow(cancelNoShowTarget.id);
    setCancelNoShowTarget(null);
  }, [cancelNoShowTarget, cancelNoShow]);

  const getStatusOptions = useCallback((): ActionSheetOption[] => {
    if (!statusSheetTarget) {
      return [];
    }

    // 전이 규칙(어떤 선택지를 보일지·무엇이 파괴적인지)은 순수 함수가 소유한다.
    // 여기서는 아이콘만 입힌다. 출근 기록이 없으면 퇴근/완료가 아예 빠지므로
    // '출근 처리' 바로 아래 '퇴근 처리'가 붙어 근무 0분이 박히던 오탭 경로가 사라진다.
    return getManualStatusTransitions(
      statusSheetTarget.status,
      hasAttendanceRecord(statusSheetTarget)
    ).map((transition) => ({
      label: transition.label,
      value: transition.value,
      icon: STATUS_OPTION_ICON[transition.value] ?? (
        <CalendarIcon size={20} color={SECONDARY_PALETTE[500]} />
      ),
      destructive: transition.destructive,
    }));
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

  // 직접추가분(지원서 미연동)은 '확정 해제'가 아니라 '제거' 의미라 문구를 분기한다.
  const isDeleteTargetDirect = !deleteTarget?.workLog?.applicationId;

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

  // 전면 ErrorState 는 **보여줄 데이터가 하나도 없을 때만**. 이미 받아둔 목록이 있는데
  // 일시적 구독 실패로 화면 전체를 덮으면 대회 D-day 운영 중에 운영 화면을 잃는다.
  // 데이터가 있으면 아래 목록의 error prop 으로 내려 배너 수준으로 알린다.
  if (error && grouped.length === 0) {
    return (
      <ErrorState title="확정된 스태프를 불러오지 못했습니다" error={error} onRetry={refresh} />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      <QuickActions
        onRefresh={refresh}
        onAddStaff={handleOpenAddStaff}
        isRefreshing={isRefreshing}
      />

      <View className="flex-1">
        <ConfirmedStaffList
          grouped={grouped}
          isLoading={false}
          error={error}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          onStaffPress={handleStaffPress}
          onViewProfile={handleViewProfile}
          onEditTime={handleEditTime}
          onChangeRole={handleChangeRole}
          onReport={handleReport}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onCancelNoShow={handleCancelNoShow}
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
        title={isDeleteTargetDirect ? '스태프 제거' : '확정 해제'}
        message={`${deleteTarget?.staffName ?? '선택한 스태프'}님을 ${
          isDeleteTargetDirect ? '명단에서 제거할까요?' : '확정 해제할까요?'
        } 점유된 자리가 다시 비워집니다.`}
        confirmText={isDeleteTargetDirect ? '제거' : '확정 해제'}
        cancelText="유지"
        isDestructive
      />

      <ConfirmModal
        visible={Boolean(noShowTarget)}
        onClose={() => setNoShowTarget(null)}
        onConfirm={handleNoShowConfirm}
        title="노쇼 처리"
        message={`${
          noShowTarget?.staffName ?? '선택한 스태프'
        }님을 노쇼로 처리할까요? 출근하지 않은 것으로 기록되며 정산 대상에서 제외됩니다.`}
        confirmText="노쇼 처리"
        cancelText="취소"
        isDestructive
      />

      <ConfirmModal
        visible={Boolean(revertTarget)}
        onClose={() => setRevertTarget(null)}
        onConfirm={handleRevertConfirm}
        title="출근 예정으로 되돌리기"
        message={`기록된 출근 ${formatTimeShort(revertTarget?.checkInTime)} · 퇴근 ${formatTimeShort(
          revertTarget?.checkOutTime
        )} 이 삭제됩니다. 삭제 사실은 수정 이력에 남고 스태프에게도 알림이 갑니다.`}
        confirmText="시각 삭제하고 되돌리기"
        cancelText="유지"
        isDestructive
      />

      <ConfirmModal
        visible={Boolean(cancelNoShowTarget)}
        onClose={() => setCancelNoShowTarget(null)}
        onConfirm={handleCancelNoShowConfirm}
        title="노쇼 취소"
        message="노쇼 기록을 취소하고 근무 상태를 복구합니다. 출퇴근 기록이 있으면 해당 상태(출근/퇴근)로, 없으면 출근 예정으로 되돌아갑니다."
        confirmText="노쇼 취소"
        cancelText="취소"
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
            ? `${statusSheetTarget.staffName ?? '스태프'}님의 근무 상태를 선택하세요.\n출근/퇴근/완료 처리 시 현재 시각이 근무시간으로 기록됩니다.`
            : undefined
        }
        options={getStatusOptions()}
        onSelect={handleStatusSelect}
      />

      <AddStaffModal
        visible={showAddStaff}
        onClose={handleCloseAddStaff}
        jobPostingId={jobPostingId}
        onSubmit={addStaff}
        isSubmitting={isAddingStaff}
      />
    </View>
  );
}
