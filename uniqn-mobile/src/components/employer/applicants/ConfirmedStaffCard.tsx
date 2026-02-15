/**
 * UNIQN Mobile - 확정 스태프 카드 컴포넌트
 *
 * @description 구인자가 확정된 스태프 정보를 확인하고 관리하는 카드
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Avatar } from '../../ui/Avatar';
import {
  ClockIcon,
  EditIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ChevronRightIcon,
  BriefcaseIcon,
  CheckCircleIcon,
} from '../../icons';
import {
  CONFIRMED_STAFF_STATUS_LABELS,
  type ConfirmedStaff,
  type ConfirmedStaffStatus,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WorkTimeDisplay } from '@/shared/time';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmedStaffCardProps {
  staff: ConfirmedStaff;
  onPress?: (staff: ConfirmedStaff) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (staff: ConfirmedStaff) => void;
  /** 시간 수정 */
  onEditTime?: (staff: ConfirmedStaff) => void;
  /** 역할 변경 */
  onChangeRole?: (staff: ConfirmedStaff) => void;
  /** 신고 (노쇼 포함) */
  onReport?: (staff: ConfirmedStaff) => void;
  /** 삭제 */
  onDelete?: (staff: ConfirmedStaff) => void;
  /** 상태 변경 (뱃지 클릭) */
  onStatusChange?: (staff: ConfirmedStaff) => void;
  /** 액션 버튼 표시 여부 */
  showActions?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<
  ConfirmedStaffStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  scheduled: 'default',
  checked_in: 'success',
  checked_out: 'primary',
  completed: 'success',
  cancelled: 'error',
  no_show: 'warning',
};

// ============================================================================
// Component
// ============================================================================

export const ConfirmedStaffCard = React.memo(function ConfirmedStaffCard({
  staff,
  onPress,
  onViewProfile,
  onEditTime,
  onChangeRole,
  onReport,
  onDelete,
  onStatusChange,
  showActions = true,
  compact = false,
}: ConfirmedStaffCardProps) {
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode: isDark } = useThemeStore();

  // 사용자 프로필 조회 (프로필 사진, 닉네임)
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: staff.staffId,
    fallbackName: staff.staffName,
  });

  // 출석 체크 여부 (QR 출근 찍었는지)
  const isCheckedIn =
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;

  // 시간 표시 정보 (WorkTimeDisplay 사용 - 직원 화면과 일관성 확보)
  const timeInfo = useMemo(() => {
    return WorkTimeDisplay.getDisplayInfo({
      checkInTime: staff.checkInTime,
      checkOutTime: staff.checkOutTime,
      scheduledStartTime: staff.scheduledStartTime,
      scheduledEndTime: staff.scheduledEndTime,
      timeSlot: staff.timeSlot,
      date: staff.date,
    });
  }, [
    staff.checkInTime,
    staff.checkOutTime,
    staff.scheduledStartTime,
    staff.scheduledEndTime,
    staff.timeSlot,
    staff.date,
  ]);

  // 출퇴근 시간: 실제 checkIn/checkOut 상태 표시 (미정 시 '미정')
  const startTimeStr = timeInfo.checkIn;
  const endTimeStr = timeInfo.checkOut;

  // 근무 시간 계산 (실제 시간 기반, 없으면 '-')
  const workDuration = timeInfo.hasActualTime ? timeInfo.duration : null;

  // 액션 버튼 표시 조건
  const canEditTime =
    staff.status !== STATUS.WORK_LOG.CANCELLED && staff.status !== STATUS.CONFIRMED_STAFF.NO_SHOW;
  const canDelete =
    staff.status === STATUS.WORK_LOG.SCHEDULED || staff.status === STATUS.WORK_LOG.CANCELLED;

  // 핸들러
  const handlePress = useCallback(() => {
    onPress?.(staff);
  }, [staff, onPress]);

  const handleViewProfile = useCallback(() => {
    onViewProfile?.(staff);
  }, [staff, onViewProfile]);

  const handleEditTime = useCallback(() => {
    onEditTime?.(staff);
  }, [staff, onEditTime]);

  const handleChangeRole = useCallback(() => {
    onChangeRole?.(staff);
  }, [staff, onChangeRole]);

  const handleReport = useCallback(() => {
    onReport?.(staff);
  }, [staff, onReport]);

  const handleDelete = useCallback(() => {
    onDelete?.(staff);
  }, [staff, onDelete]);

  const handleStatusChange = useCallback(() => {
    onStatusChange?.(staff);
  }, [staff, onStatusChange]);

  // 상태 변경 가능 여부 (scheduled, checked_in, checked_out 간 자유 전환)
  const canChangeStatus =
    staff.status === STATUS.WORK_LOG.SCHEDULED ||
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT;

  return (
    <Card variant="elevated" padding={compact ? 'sm' : 'md'}>
      <Pressable onPress={handlePress} disabled={!onPress}>
        {/* 헤더 */}
        <View className="flex-row items-center">
          {/* 프로필 영역 (이름/사진 클릭 시 프로필 모달) */}
          <Pressable
            onPress={handleViewProfile}
            disabled={!onViewProfile}
            className="flex-row items-center flex-1 active:opacity-80"
          >
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size={compact ? 'sm' : 'md'}
              className="mr-3"
            />
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </Text>
                {staff.isRead === false && (
                  <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" />
                )}
              </View>
              <View className="flex-row items-center mt-0.5">
                <BriefcaseIcon size={12} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                  {getRoleDisplayName(staff.role, staff.customRole)}
                </Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={handleStatusChange}
            disabled={!canChangeStatus || !onStatusChange}
            className={canChangeStatus && onStatusChange ? 'active:opacity-70' : ''}
          >
            <Badge variant={STATUS_BADGE_VARIANT[staff.status]} size="sm">
              {CONFIRMED_STAFF_STATUS_LABELS[staff.status]}
            </Badge>
          </Pressable>
          {onPress && <ChevronRightIcon size={20} color="#9CA3AF" />}
        </View>

        {/* 시간 정보 (컴팩트 아닐 때) */}
        {!compact && (
          <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
            <ClockIcon size={16} color="#6B7280" />
            <View className="flex-row flex-1 ml-2">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {timeInfo.isActualTime ? '출근' : '예정'}
                  </Text>
                  {isCheckedIn && (
                    <View className="ml-1">
                      <CheckCircleIcon size={12} color="#22C55E" />
                    </View>
                  )}
                </View>
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {startTimeStr}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {timeInfo.isActualTime ? '퇴근' : '예정'}
                </Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {endTimeStr}
                </Text>
              </View>
              {workDuration && (
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">근무시간</Text>
                  <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {workDuration}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 비고 */}
        {staff.notes && !compact && (
          <View className="mt-2 p-2 bg-gray-50 dark:bg-surface rounded-lg">
            <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
              {staff.notes}
            </Text>
          </View>
        )}
      </Pressable>

      {/* 액션 버튼 */}
      {showActions && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay gap-2">
          {/* 시간 수정 */}
          {onEditTime && canEditTime && (
            <Pressable
              onPress={handleEditTime}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
            >
              <EditIcon size={14} color={isDark ? '#93C5FD' : '#9333EA'} />
              <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                시간 수정
              </Text>
            </Pressable>
          )}

          {/* 역할 변경 */}
          {onChangeRole && canEditTime && (
            <Pressable
              onPress={handleChangeRole}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
            >
              <BriefcaseIcon size={14} color={isDark ? '#93C5FD' : '#9333EA'} />
              <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                역할 변경
              </Text>
            </Pressable>
          )}

          {/* 신고 (노쇼 포함) */}
          {onReport && (
            <Pressable
              onPress={handleReport}
              className="flex-row items-center justify-center py-2 px-3 rounded-lg bg-red-50 dark:bg-red-900/20 active:opacity-70"
            >
              <ExclamationTriangleIcon size={14} color="#EF4444" />
              <Text className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">신고</Text>
            </Pressable>
          )}

          {/* 삭제 */}
          {onDelete && canDelete && (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center py-2 px-3 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
            >
              <TrashIcon size={14} color="#6B7280" />
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
});

export default ConfirmedStaffCard;
