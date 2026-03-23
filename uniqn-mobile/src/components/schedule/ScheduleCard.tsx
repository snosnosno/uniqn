/**
 * UNIQN Mobile - ScheduleCard component
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  BanknotesIcon,
  UserIcon,
} from '@/components/icons';
import { getRoleDisplayName } from '@/types/unified';
import {
  formatCurrency,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import {
  calculateSettlementWithTax,
  DEFAULT_SALARY_INFO,
  DEFAULT_TAX_SETTINGS,
} from '@/domains/settlement';
import {
  formatTime,
  formatDate,
  formatSalaryDisplay,
  getRoleSalaryFromProjection,
  statusConfig,
  attendanceConfig,
} from './helpers';
import { STATUS } from '@/constants';
import { WorkTimeDisplay } from '@/shared/time';
import type { ScheduleEvent } from '@/types';

export interface ScheduleCardProps {
  schedule: ScheduleEvent;
  onPress?: () => void;
}

export const ScheduleCard = memo(function ScheduleCard({ schedule, onPress }: ScheduleCardProps) {
  const status = statusConfig[schedule.type];
  const attendance = attendanceConfig[schedule.status];
  const ownerName = schedule.postingProjection?.ownerName;

  const projectedSalary = useMemo(
    () =>
      getRoleSalaryFromProjection(schedule.postingProjection, schedule.role, schedule.customRole),
    [schedule.postingProjection, schedule.role, schedule.customRole]
  );

  const salaryDisplay = useMemo(() => {
    const salary =
      schedule.settlementBreakdown?.salaryInfo || schedule.customSalaryInfo || projectedSalary;
    return formatSalaryDisplay(salary);
  }, [schedule.settlementBreakdown?.salaryInfo, schedule.customSalaryInfo, projectedSalary]);

  const completedAmount = useMemo(() => {
    if (schedule.type !== STATUS.SCHEDULE.COMPLETED) return null;

    if (schedule.payrollAmount && schedule.payrollAmount > 0) {
      return schedule.payrollAmount;
    }

    if (schedule.checkInTime && schedule.checkOutTime) {
      const salaryInfo: SalaryInfo =
        schedule.customSalaryInfo ||
        projectedSalary ||
        schedule.postingProjection?.settlement.defaultSalary ||
        DEFAULT_SALARY_INFO;
      const allowances: Allowances | undefined =
        schedule.customAllowances || schedule.postingProjection?.settlement.allowances;
      const taxSettings: TaxSettings =
        schedule.customTaxSettings ||
        schedule.postingProjection?.settlement.taxSettings ||
        DEFAULT_TAX_SETTINGS;

      const result = calculateSettlementWithTax(
        schedule.checkInTime,
        schedule.checkOutTime,
        salaryInfo,
        allowances,
        taxSettings
      );

      const amount = taxSettings.type !== 'none' ? result.afterTaxPay : result.totalPay;
      return amount > 0 ? amount : null;
    }

    return null;
  }, [
    projectedSalary,
    schedule.type,
    schedule.payrollAmount,
    schedule.checkInTime,
    schedule.checkOutTime,
    schedule.customSalaryInfo,
    schedule.customAllowances,
    schedule.customTaxSettings,
    schedule.postingProjection,
  ]);

  const timeDisplayInfo = useMemo(() => WorkTimeDisplay.getDisplayInfo(schedule), [schedule]);

  const confirmedTimeDisplay = useMemo(() => {
    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) return null;
    return `${timeDisplayInfo.effectiveStart} - ${timeDisplayInfo.effectiveEnd}`;
  }, [schedule.type, timeDisplayInfo]);

  const isCancelled = schedule.type === STATUS.SCHEDULE.CANCELLED;
  const accessibilityLabel = `${schedule.jobPostingName}, ${status.label}, ${formatDate(schedule.date)}${
    schedule.location ? `, ${schedule.location}` : ''
  }`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Card className={`mb-3 ${isCancelled ? 'opacity-60' : ''}`}>
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row flex-wrap items-center">
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>

            {schedule.type === STATUS.SCHEDULE.CONFIRMED && (
              <View className={`ml-2 rounded-full px-2 py-0.5 ${attendance.bgColor}`}>
                <Text className={`text-xs font-medium ${attendance.textColor}`}>
                  {attendance.label}
                </Text>
              </View>
            )}
          </View>

          {schedule.type === STATUS.SCHEDULE.COMPLETED && completedAmount && (
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(completedAmount)}
            </Text>
          )}
        </View>

        <Text
          className={`mb-2 text-base font-semibold ${
            isCancelled
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-900 dark:text-white'
          }`}
          numberOfLines={1}
        >
          {schedule.jobPostingName}
        </Text>

        {schedule.location && (
          <View className="mb-2 flex-row items-center">
            <MapIcon size={14} color="#6B7280" />
            <Text
              className="ml-1.5 flex-1 text-sm text-gray-500 dark:text-gray-400"
              numberOfLines={1}
            >
              {schedule.location}
            </Text>
          </View>
        )}

        {schedule.type === STATUS.SCHEDULE.APPLIED ? (
          <View>
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(schedule.date)}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-surface-elevated" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatTime(schedule.startTime)}
              </Text>
            </View>

            <View className="mt-2 flex-row flex-wrap items-center">
              <View className="mr-3 flex-row items-center">
                <BriefcaseIcon size={14} color="#6B7280" />
                <Text className="ml-1.5 text-sm text-gray-700 dark:text-gray-300">
                  {getRoleDisplayName(schedule.role, schedule.customRole)}
                </Text>
              </View>

              {salaryDisplay && (
                <View className="mr-3 flex-row items-center">
                  <BanknotesIcon size={14} color="#6B7280" />
                  <Text className="ml-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {salaryDisplay}
                  </Text>
                </View>
              )}

              {ownerName && (
                <View className="flex-row items-center">
                  <UserIcon size={14} color="#9CA3AF" />
                  <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">{ownerName}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View>
            <View className="flex-row items-center">
              <CalendarIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(schedule.date)}
              </Text>
              <View className="mx-2 h-3 w-px bg-gray-300 dark:bg-surface-elevated" />
              <ClockIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
                {schedule.type === STATUS.SCHEDULE.COMPLETED
                  ? timeDisplayInfo.duration
                  : confirmedTimeDisplay}
              </Text>
            </View>

            <View className="mt-2 flex-row items-center">
              <BriefcaseIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm text-gray-700 dark:text-gray-300">
                {getRoleDisplayName(schedule.role, schedule.customRole)}
              </Text>
            </View>
          </View>
        )}

        {isCancelled && (
          <View className="mt-3 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-900/20">
            <Text className="text-center text-xs text-red-600 dark:text-red-400">
              이 일정이 취소되었습니다.
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
});

export default ScheduleCard;
