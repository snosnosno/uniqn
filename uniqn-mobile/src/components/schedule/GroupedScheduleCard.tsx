/**
 * UNIQN Mobile - GroupedScheduleCard component
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { Card, Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  BanknotesIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@/components/icons';
import { formatDateDisplay, formatRolesDisplay } from '@/utils/scheduleGrouping';
import { formatSalaryDisplay } from './helpers';
import { STATUS } from '@/constants';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import { SCHEDULE_STATUS, ATTENDANCE_STATUS } from '@/constants/statusConfig';
import type { GroupedScheduleEvent } from '@/types';

export interface GroupedScheduleCardProps {
  group: GroupedScheduleEvent;
  onPress?: () => void;
  onDatePress?: (date: string, scheduleEventId: string) => void;
  defaultExpanded?: boolean;
}

export const GroupedScheduleCard = memo(function GroupedScheduleCard({
  group,
  onPress,
  onDatePress,
  defaultExpanded = false,
}: GroupedScheduleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const status = SCHEDULE_STATUS[group.type];
  const isCancelled = group.type === STATUS.SCHEDULE.CANCELLED;
  const hasPendingCancellation = group.originalEvents.some((event) => event.isCancellationPending);

  const rolesDisplay = useMemo(
    () => formatRolesDisplay(group.roles, group.customRoles),
    [group.roles, group.customRoles]
  );
  const dateDisplay = useMemo(
    () => formatDateDisplay(group.dateRange.dates),
    [group.dateRange.dates]
  );
  const salaryDisplay = useMemo(
    () => formatSalaryDisplay(group.postingProjection?.settlement.defaultSalary),
    [group.postingProjection]
  );
  const ownerName = group.postingProjection?.ownerName;

  const attendanceSummary = useMemo(() => {
    if (group.type !== STATUS.SCHEDULE.CONFIRMED) return null;

    const checkedIn = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_IN
    ).length;
    const checkedOut = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_OUT
    ).length;

    if (checkedIn > 0) return { label: '근무 중', status: STATUS.ATTENDANCE.CHECKED_IN };
    if (checkedOut > 0) return { label: '퇴근 완료', status: STATUS.ATTENDANCE.CHECKED_OUT };
    return { label: '출근 전', status: STATUS.ATTENDANCE.NOT_STARTED };
  }, [group.type, group.dateStatuses]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  const handleDatePress = useCallback(
    (date: string, scheduleEventId: string) => {
      onDatePress?.(date, scheduleEventId);
    },
    [onDatePress]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.jobPostingName} 일정 상세 보기, ${group.dateRange.totalDays}일`}
    >
      <Card className={`mb-3 ${isCancelled ? 'opacity-60' : ''}`}>
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row flex-wrap items-center">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>

            <View className="ml-2 rounded-sm bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
              <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                {group.dateRange.totalDays}일
              </Text>
            </View>

            {attendanceSummary && (
              <View
                className={`ml-2 rounded-sm px-2 py-0.5 ${
                  ATTENDANCE_STATUS[attendanceSummary.status].bgColor
                }`}
              >
                <Text
                  className={`text-xs font-sans-medium ${
                    ATTENDANCE_STATUS[attendanceSummary.status].textColor
                  }`}
                >
                  {attendanceSummary.label}
                </Text>
              </View>
            )}

            {hasPendingCancellation && (
              <View className="ml-2">
                <Badge variant="warning">{APPLICATION_STATUS_LABELS.cancellation_pending}</Badge>
              </View>
            )}
          </View>
        </View>

        <Text
          className={`mb-2 text-base font-sans-semibold ${
            isCancelled
              ? 'text-secondary-400 dark:text-secondary-500 line-through'
              : 'text-secondary-900 dark:text-off-white'
          }`}
          numberOfLines={1}
        >
          {group.jobPostingName}
        </Text>

        {group.location && (
          <View className="mb-2 flex-row items-center">
            <MapIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text
              className="ml-1.5 flex-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans"
              numberOfLines={1}
            >
              {group.location}
            </Text>
          </View>
        )}

        <View className="mb-2 flex-row items-center">
          <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
            {dateDisplay}
          </Text>
        </View>

        {group.timeSlot && (
          <View className="mb-2 flex-row items-center">
            <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
              {group.timeSlot}
            </Text>
          </View>
        )}

        <View className="flex-row flex-wrap items-center">
          <View className="mr-3 flex-row items-center">
            <BriefcaseIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1.5 text-sm text-content-secondary font-sans">{rolesDisplay}</Text>
          </View>

          {group.type === STATUS.SCHEDULE.APPLIED && salaryDisplay && (
            <View className="mr-3 flex-row items-center">
              <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1.5 text-sm font-sans-medium text-content-secondary">
                {salaryDisplay}
              </Text>
            </View>
          )}

          {ownerName && group.type === STATUS.SCHEDULE.APPLIED && (
            <View className="flex-row items-center">
              <UserIcon size={14} color={SECONDARY_PALETTE[400]} />
              <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {ownerName}
              </Text>
            </View>
          )}
        </View>

        {group.dateRange.totalDays > 1 && (
          <Pressable
            onPress={toggleExpanded}
            className="mt-3 flex-row items-center justify-center border-t border-secondary-200 py-2 dark:border-surface-overlay"
            accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
          >
            <Text className="mr-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              날짜별 상세
            </Text>
            {isExpanded ? (
              <ChevronUpIcon size={16} color={SECONDARY_PALETTE[500]} />
            ) : (
              <ChevronDownIcon size={16} color={SECONDARY_PALETTE[500]} />
            )}
          </Pressable>
        )}

        {isExpanded && (
          <View className="mt-2 border-t border-secondary-100 pt-2 dark:border-surface-overlay">
            {group.dateStatuses.map((dateStatus, index) => {
              const attendance = ATTENDANCE_STATUS[dateStatus.status];
              return (
                <Pressable
                  key={dateStatus.date}
                  onPress={() => handleDatePress(dateStatus.date, dateStatus.scheduleEventId)}
                  className={`flex-row items-center justify-between py-2 ${
                    index < group.dateStatuses.length - 1
                      ? 'border-b border-secondary-100 dark:border-surface-overlay/50'
                      : ''
                  }`}
                  accessibilityLabel={`${dateStatus.formattedDate} ${attendance.label}`}
                >
                  <Text className="text-sm text-content-secondary font-sans">
                    {dateStatus.formattedDate}
                  </Text>
                  <View className={`rounded-sm px-2 py-0.5 ${attendance.bgColor}`}>
                    <Text className={`text-xs font-sans-medium ${attendance.textColor}`}>
                      {attendance.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {hasPendingCancellation && (
          <View className="mt-3 rounded-lg bg-warning-50 px-3 py-2 dark:bg-warning-900/20">
            <Text className="text-center text-xs text-warning-700 dark:text-warning-400 font-sans">
              취소 요청 검토 중입니다.
            </Text>
          </View>
        )}

        {isCancelled && (
          <View className="mt-3 rounded-lg bg-error-50 px-3 py-2 dark:bg-error-900/20">
            <Text className="text-center text-xs text-error-600 dark:text-error-400 font-sans">
              이 일정이 취소되었습니다.
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
});

export default GroupedScheduleCard;
