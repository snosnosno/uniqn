/**
 * UNIQN Mobile - 확정 스태프 카드 컴포넌트
 *
 * @description 구인자가 확정된 스태프 정보를 확인하고 관리하는 카드
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  ClockIcon,
  EditIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ChevronRightIcon,
  BriefcaseIcon,
  CheckCircleIcon,
} from '../icons';
import {
  CONFIRMED_STAFF_STATUS_LABELS,
  type ConfirmedStaff,
  type ConfirmedStaffStatus,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { formatTime, parseTimeSlotToDate } from '@/utils/dateUtils';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmedStaffCardProps {
  staff: ConfirmedStaff;
  onPress?: (staff: ConfirmedStaff) => void;
  /** 시간 수정 */
  onEditTime?: (staff: ConfirmedStaff) => void;
  /** 역할 변경 */
  onChangeRole?: (staff: ConfirmedStaff) => void;
  /** 신고 (노쇼 포함) */
  onReport?: (staff: ConfirmedStaff) => void;
  /** 삭제 */
  onDelete?: (staff: ConfirmedStaff) => void;
  /** 액션 버튼 표시 여부 */
  showActions?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<ConfirmedStaffStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  scheduled: 'default',
  checked_in: 'success',
  checked_out: 'primary',
  completed: 'success',
  cancelled: 'error',
  no_show: 'warning',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Timestamp를 Date로 변환
 */
const parseTimestamp = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

/**
 * 근무 시간 계산 (시:분 형식)
 */
const calculateWorkDuration = (startTime: unknown, endTime: unknown): string | null => {
  const start = parseTimestamp(startTime);
  const end = parseTimestamp(endTime);

  if (!start || !end) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '0시간';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
};

// ============================================================================
// Component
// ============================================================================

export const ConfirmedStaffCard = React.memo(function ConfirmedStaffCard({
  staff,
  onPress,
  onEditTime,
  onChangeRole,
  onReport,
  onDelete,
  showActions = true,
  compact = false,
}: ConfirmedStaffCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 출석 체크 여부 (QR 출근 찍었는지)
  const isCheckedIn = staff.status === 'checked_in' ||
                      staff.status === 'checked_out' ||
                      staff.status === 'completed';

  // 출근 시간: checkInTime 우선, 없으면 timeSlot에서 파싱
  const startTimeStr = useMemo(() => {
    // 1. checkInTime이 있으면 사용 (QR 출근 또는 관리자 수정)
    if (staff.checkInTime) {
      const date = parseTimestamp(staff.checkInTime);
      return date ? formatTime(date) : '미정';
    }
    // 2. 레거시: actualStartTime이 있으면 사용
    if (staff.actualStartTime) {
      const date = parseTimestamp(staff.actualStartTime);
      return date ? formatTime(date) : '미정';
    }
    // 3. 없으면 timeSlot에서 시작시간 파싱
    if (staff.timeSlot && staff.date) {
      const { startTime } = parseTimeSlotToDate(staff.timeSlot, staff.date);
      return startTime ? formatTime(startTime) : '미정';
    }
    return '미정';
  }, [staff.checkInTime, staff.actualStartTime, staff.timeSlot, staff.date]);

  // 퇴근 시간: checkOutTime만 표시 (없으면 '미정')
  const endTimeStr = useMemo(() => {
    // 1. checkOutTime이 있으면 사용
    if (staff.checkOutTime) {
      const date = parseTimestamp(staff.checkOutTime);
      return date ? formatTime(date) : '미정';
    }
    // 2. 레거시: actualEndTime이 있으면 사용
    if (staff.actualEndTime) {
      const date = parseTimestamp(staff.actualEndTime);
      return date ? formatTime(date) : '미정';
    }
    return '미정';  // 퇴근 전까지는 미정
  }, [staff.checkOutTime, staff.actualEndTime]);

  // 근무 시간 계산 (둘 다 있을 때만)
  const workDuration = useMemo(() => {
    const startSource = staff.checkInTime || staff.actualStartTime;
    const endSource = staff.checkOutTime || staff.actualEndTime;
    return calculateWorkDuration(startSource, endSource);
  }, [staff.checkInTime, staff.actualStartTime, staff.checkOutTime, staff.actualEndTime]);

  // 액션 버튼 표시 조건
  const canEditTime = staff.status !== 'cancelled' && staff.status !== 'no_show';
  const canDelete = staff.status === 'scheduled' || staff.status === 'cancelled';

  // 핸들러
  const handlePress = useCallback(() => {
    onPress?.(staff);
  }, [staff, onPress]);

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

  return (
    <Card variant="elevated" padding={compact ? 'sm' : 'md'}>
      <Pressable onPress={handlePress} disabled={!onPress}>
        {/* 헤더 */}
        <View className="flex-row items-center">
          <Avatar
            name={staff.staffName}
            size={compact ? 'sm' : 'md'}
            className="mr-3"
          />
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {staff.staffName}{staff.staffNickname ? ` (${staff.staffNickname})` : ''}
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
          <Badge
            variant={STATUS_BADGE_VARIANT[staff.status]}
            size="sm"
          >
            {CONFIRMED_STAFF_STATUS_LABELS[staff.status]}
          </Badge>
          {onPress && (
            <ChevronRightIcon size={20} color="#9CA3AF" />
          )}
        </View>

        {/* 시간 정보 (컴팩트 아닐 때) */}
        {!compact && (
          <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <ClockIcon size={16} color="#6B7280" />
            <View className="flex-row flex-1 ml-2">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">출근</Text>
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
                <Text className="text-xs text-gray-500 dark:text-gray-400">퇴근</Text>
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
          <View className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
              {staff.notes}
            </Text>
          </View>
        )}
      </Pressable>

      {/* 액션 버튼 */}
      {showActions && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 gap-2">
          {/* 시간 수정 */}
          {onEditTime && canEditTime && (
            <Pressable
              onPress={handleEditTime}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
            >
              <EditIcon size={14} color={isDark ? '#93C5FD' : '#2563EB'} />
              <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                시간 수정
              </Text>
            </Pressable>
          )}

          {/* 역할 변경 */}
          {onChangeRole && canEditTime && (
            <Pressable
              onPress={handleChangeRole}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
            >
              <BriefcaseIcon size={14} color={isDark ? '#93C5FD' : '#2563EB'} />
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
              <Text className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">
                신고
              </Text>
            </Pressable>
          )}

          {/* 삭제 */}
          {onDelete && canDelete && (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
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
