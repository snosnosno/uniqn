import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WorkTimeDisplay } from '@/shared/time';
import { useThemeStore } from '@/stores/themeStore';
import { getRoleDisplayName } from '@/types/unified';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EditIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '../../icons';

export interface ConfirmedStaffCardProps {
  staff: ConfirmedStaff;
  onPress?: (staff: ConfirmedStaff) => void;
  onViewProfile?: (staff: ConfirmedStaff) => void;
  onEditTime?: (staff: ConfirmedStaff) => void;
  onChangeRole?: (staff: ConfirmedStaff) => void;
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  onStatusChange?: (staff: ConfirmedStaff) => void;
  showActions?: boolean;
  compact?: boolean;
}

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
  const { isDarkMode } = useThemeStore();
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: staff.staffId,
    fallbackName: staff.staffName,
    fallbackNickname: staff.staffNickname,
    fallbackPhotoURL: staff.staffPhotoURL,
  });

  const isCheckedIn =
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;

  const timeInfo = useMemo(
    () =>
      WorkTimeDisplay.getDisplayInfo({
        checkInTime: staff.checkInTime,
        checkOutTime: staff.checkOutTime,
        timeSlot: staff.timeSlot,
        date: staff.date,
      }),
    [staff.checkInTime, staff.checkOutTime, staff.date, staff.timeSlot]
  );

  const workDuration = timeInfo.duration !== '-' ? timeInfo.duration : null;
  const canEditTime =
    staff.status !== STATUS.WORK_LOG.CANCELLED && staff.status !== STATUS.CONFIRMED_STAFF.NO_SHOW;
  const canDelete =
    staff.status === STATUS.WORK_LOG.SCHEDULED || staff.status === STATUS.WORK_LOG.CANCELLED;
  const canChangeStatus =
    staff.status === STATUS.WORK_LOG.SCHEDULED ||
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;

  const handlePress = useCallback(() => {
    onPress?.(staff);
  }, [onPress, staff]);

  const handleViewProfile = useCallback(() => {
    onViewProfile?.(staff);
  }, [onViewProfile, staff]);

  const handleEditTime = useCallback(() => {
    onEditTime?.(staff);
  }, [onEditTime, staff]);

  const handleChangeRole = useCallback(() => {
    onChangeRole?.(staff);
  }, [onChangeRole, staff]);

  const handleReport = useCallback(() => {
    onReport?.(staff);
  }, [onReport, staff]);

  const handleDelete = useCallback(() => {
    onDelete?.(staff);
  }, [onDelete, staff]);

  const handleStatusChange = useCallback(() => {
    onStatusChange?.(staff);
  }, [onStatusChange, staff]);

  return (
    <Card variant="elevated" padding={compact ? 'sm' : 'md'}>
      <Pressable onPress={handlePress} disabled={!onPress}>
        <View className="flex-row items-center">
          <Pressable
            onPress={handleViewProfile}
            disabled={!onViewProfile}
            className="flex-1 flex-row items-center active:opacity-80"
          >
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size={compact ? 'sm' : 'md'}
              className="mr-3"
            />
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-secondary-900 dark:text-off-white">
                  {displayName}
                </Text>
                {staff.isRead === false ? (
                  <View className="ml-2 h-2 w-2 rounded-sm bg-primary-500" />
                ) : null}
              </View>
              <View className="mt-0.5 flex-row items-center">
                <BriefcaseIcon size={12} color="#9A9078" />
                <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400">
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
            <Badge variant={CONFIRMED_STAFF_STATUS[staff.status].variant} size="sm">
              {CONFIRMED_STAFF_STATUS[staff.status].label}
            </Badge>
          </Pressable>
          {onPress ? <ChevronRightIcon size={20} color="#A89C84" /> : null}
        </View>

        {compact ? null : (
          <View className="mt-3 flex-row items-center border-t border-secondary-100 pt-3 dark:border-surface-overlay">
            <ClockIcon size={16} color="#9A9078" />
            <View className="ml-2 flex-1 flex-row">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                    {timeInfo.isEffectiveStartActual ? '출근' : '시작'}
                  </Text>
                  {isCheckedIn ? (
                    <View className="ml-1">
                      <CheckCircleIcon size={12} color="#22C55E" />
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm font-medium text-secondary-900 dark:text-off-white">
                  {timeInfo.effectiveStart}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                  {timeInfo.isEffectiveEndActual ? '퇴근' : '종료'}
                </Text>
                <Text className="text-sm font-medium text-secondary-900 dark:text-off-white">
                  {timeInfo.effectiveEnd}
                </Text>
              </View>

              {workDuration ? (
                <View className="flex-1">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                    근무 시간
                  </Text>
                  <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {workDuration}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {staff.notes && !compact ? (
          <View className="mt-2 rounded-lg bg-secondary-50 p-2 dark:bg-surface">
            <Text className="text-sm text-secondary-600 dark:text-secondary-400" numberOfLines={2}>
              {staff.notes}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {showActions ? (
        <View className="mt-3 flex-row gap-2 border-t border-secondary-100 pt-3 dark:border-surface-overlay">
          {onEditTime && canEditTime ? (
            <Pressable
              onPress={handleEditTime}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-secondary-100 py-2 active:opacity-70 dark:bg-surface"
            >
              <EditIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                시간 수정
              </Text>
            </Pressable>
          ) : null}

          {onChangeRole && canEditTime ? (
            <Pressable
              onPress={handleChangeRole}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-secondary-100 py-2 active:opacity-70 dark:bg-surface"
            >
              <BriefcaseIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                역할 변경
              </Text>
            </Pressable>
          ) : null}

          {onReport ? (
            <Pressable
              onPress={handleReport}
              className="flex-row items-center justify-center rounded-lg bg-error-50 px-3 py-2 active:opacity-70 dark:bg-error-900/20"
            >
              <ExclamationTriangleIcon size={14} color="#DC2626" />
              <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
                신고
              </Text>
            </Pressable>
          ) : null}

          {onDelete && canDelete ? (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center rounded-lg bg-secondary-100 px-3 py-2 active:opacity-70 dark:bg-surface"
            >
              <TrashIcon size={14} color="#9A9078" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

export default ConfirmedStaffCard;
