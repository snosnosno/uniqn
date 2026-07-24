import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WorkTimeDisplay } from '@/shared/time';
import { useThemeStore } from '@/stores/themeStore';
import { getRoleDisplayName } from '@/types/unified';
import { slotColorSwatchClassName } from '@/domains/weeklyGrid';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EditIcon,
  ExclamationTriangleIcon,
  RefreshIcon,
  TrashIcon,
} from '@/components/icons';

export interface ConfirmedStaffCardProps {
  staff: ConfirmedStaff;
  onPress?: (staff: ConfirmedStaff) => void;
  onViewProfile?: (staff: ConfirmedStaff) => void;
  onEditTime?: (staff: ConfirmedStaff) => void;
  onChangeRole?: (staff: ConfirmedStaff) => void;
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  onStatusChange?: (staff: ConfirmedStaff) => void;
  onCancelNoShow?: (staff: ConfirmedStaff) => void;
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
  onCancelNoShow,
  showActions = true,
  compact = false,
}: ConfirmedStaffCardProps) {
  const { isDarkMode } = useThemeStore();
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: staff.staffId,
    fallbackName: staff.staffName,
    fallbackNickname: staff.staffNickname,
    fallbackPhotoURL: staff.staffPhotoURL,
    fallbackPhotoURLBlurhash: staff.staffPhotoURLBlurhash,
  });

  // 배치 색상 태그(#4) — 근무표에서 고른 슬롯 색상을 카드 이름 앞 스와치로 표시.
  const colorSwatch = slotColorSwatchClassName(staff.color);

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
  // 정산 완료 건은 서버(ConfirmedStaffRepository.updateWorkTimeWithTransaction)가 수정을 거부하므로
  // 버튼 단계에서 미리 숨긴다 — SettlementDetailModal의 payrollStatus===PENDING 계약과 동일.
  const canEditTime =
    staff.status !== STATUS.WORK_LOG.CANCELLED &&
    staff.status !== STATUS.CONFIRMED_STAFF.NO_SHOW &&
    staff.payrollStatus !== STATUS.PAYROLL.COMPLETED;
  const canDelete =
    staff.status === STATUS.WORK_LOG.SCHEDULED || staff.status === STATUS.WORK_LOG.CANCELLED;
  const canChangeStatus =
    staff.status === STATUS.WORK_LOG.SCHEDULED ||
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;
  // 정산 완료 건은 서버(ConfirmedStaffRepository.cancelNoShow)가 취소를 거부하므로
  // 버튼 단계에서 미리 숨긴다.
  const canCancelNoShow = staff.isNoShow && staff.payrollStatus !== STATUS.PAYROLL.COMPLETED;

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

  const handleCancelNoShow = useCallback(() => {
    onCancelNoShow?.(staff);
  }, [onCancelNoShow, staff]);

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
              blurhash={profilePhotoURLBlurhash}
            />
            <View className="flex-1">
              <View className="flex-row items-center">
                {colorSwatch ? (
                  <View
                    className={`mr-1.5 h-3 w-3 rounded-sm border border-divider ${colorSwatch}`}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                  {displayName}
                </Text>
                {staff.isRead === false ? (
                  <View className="ml-2 h-2 w-2 rounded-sm bg-primary-500" />
                ) : null}
              </View>
              <View className="mt-0.5 flex-row items-center">
                <BriefcaseIcon size={12} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
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
          {onPress ? <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} /> : null}
        </View>

        {compact ? null : (
          <View className="mt-3 flex-row items-center border-t border-secondary-100 pt-3 dark:border-surface-overlay">
            <ClockIcon size={16} color={SECONDARY_PALETTE[500]} />
            <View className="ml-2 flex-1 flex-row">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    {timeInfo.isEffectiveStartActual ? '출근' : '시작'}
                  </Text>
                  {isCheckedIn ? (
                    <View className="ml-1">
                      <CheckCircleIcon size={12} color="#22C55E" />
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {timeInfo.effectiveStart}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {timeInfo.isEffectiveEndActual ? '퇴근' : '종료'}
                </Text>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {/* P2-3-lite: 심야 운영 자정 넘김은 "익일" 병기(SSOT isEndNextDay) */}
                  {timeInfo.isEndNextDay ? `익일 ${timeInfo.effectiveEnd}` : timeInfo.effectiveEnd}
                </Text>
              </View>

              {workDuration ? (
                <View className="flex-1">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    근무 시간
                  </Text>
                  <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                    {workDuration}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {staff.notes && !compact ? (
          <View className="mt-2 rounded-lg bg-surface-page dark:bg-surface p-2">
            <Text
              className="text-sm text-content-muted dark:text-secondary-400 font-sans"
              numberOfLines={2}
            >
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
              className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
            >
              <EditIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              <Text className="ml-1 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                시간 수정
              </Text>
            </Pressable>
          ) : null}

          {onChangeRole && canEditTime ? (
            <Pressable
              onPress={handleChangeRole}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
            >
              <BriefcaseIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              <Text className="ml-1 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                역할 변경
              </Text>
            </Pressable>
          ) : null}

          {onCancelNoShow && canCancelNoShow ? (
            <Pressable
              onPress={handleCancelNoShow}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
            >
              <RefreshIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1 text-sm font-sans-medium text-content-primary dark:text-off-white">
                노쇼 취소
              </Text>
            </Pressable>
          ) : null}

          {onReport ? (
            <Pressable
              onPress={handleReport}
              className="flex-row items-center justify-center rounded-lg bg-error-50 px-3 py-2 active:opacity-70 dark:bg-error-900/20"
            >
              <ExclamationTriangleIcon size={14} color="#DC2626" />
              <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
                신고
              </Text>
            </Pressable>
          ) : null}

          {onDelete && canDelete ? (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center rounded-lg bg-surface-card px-3 py-2 active:opacity-70 dark:bg-surface"
            >
              <TrashIcon size={14} color={SECONDARY_PALETTE[500]} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});
