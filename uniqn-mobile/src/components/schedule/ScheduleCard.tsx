/**
 * UNIQN Mobile - ScheduleCard component
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CardStripe, Badge } from '@/components/ui';
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
  SCHEDULE_STATUS_STRIPE_TONE,
} from './helpers';
import { STATUS } from '@/constants';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
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
  const hasPendingCancellation = Boolean(schedule.isCancellationPending);

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

  const stripeTone = SCHEDULE_STATUS_STRIPE_TONE[schedule.type];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <CardStripe tone={stripeTone} style={{ marginBottom: 12 }}>
        <View
          className={`bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3 ${
            isCancelled ? 'opacity-60' : ''
          }`}
        >
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 flex-row flex-wrap items-center">
              <Badge variant="chip" dot>
                {status.label}
              </Badge>

              {schedule.type === STATUS.SCHEDULE.CONFIRMED && (
                <View className={`ml-2 rounded-sm px-2 py-0.5 ${attendance.bgColor}`}>
                  <Text className={`text-xs font-sans-medium ${attendance.textColor}`}>
                    {attendance.label}
                  </Text>
                </View>
              )}

              {hasPendingCancellation && (
                <View className="ml-2">
                  <Badge variant="warning">{APPLICATION_STATUS_LABELS.cancellation_pending}</Badge>
                </View>
              )}
            </View>

            {schedule.type === STATUS.SCHEDULE.COMPLETED && completedAmount && (
              <Text className="text-base font-sans-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(completedAmount)}
              </Text>
            )}
          </View>

          <Text
            className={`mb-2 text-base font-sans-semibold dark:leading-base-dark ${
              isCancelled
                ? 'text-secondary-400 dark:text-secondary-500 line-through'
                : 'text-content-primary'
            }`}
            numberOfLines={1}
          >
            {schedule.jobPostingName}
          </Text>

          {schedule.location && (
            <View className="mb-2 flex-row items-center">
              <MapIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text
                className="ml-1.5 flex-1 text-sm text-secondary-500 dark:text-secondary-400 dark:leading-sm-dark font-sans"
                numberOfLines={1}
              >
                {schedule.location}
              </Text>
            </View>
          )}

          {schedule.type === STATUS.SCHEDULE.APPLIED ? (
            <View>
              <View className="flex-row items-center">
                <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                  {formatDate(schedule.date)}
                </Text>
                <View className="mx-2 h-3 w-px bg-secondary-300 dark:bg-surface-elevated" />
                <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                  {formatTime(schedule.startTime)}
                </Text>
              </View>

              <View className="mt-2 flex-row flex-wrap items-center">
                <View className="mr-3 flex-row items-center">
                  <BriefcaseIcon size={14} color={SECONDARY_PALETTE[500]} />
                  <Text className="ml-1.5 text-sm text-content-secondary font-sans">
                    {getRoleDisplayName(schedule.role, schedule.customRole)}
                  </Text>
                </View>

                {salaryDisplay && (
                  <View className="mr-3 flex-row items-center">
                    <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
                    <Text className="ml-1.5 text-sm font-sans-medium text-content-secondary">
                      {salaryDisplay}
                    </Text>
                  </View>
                )}

                {ownerName && (
                  <View className="flex-row items-center">
                    <UserIcon size={14} color={SECONDARY_PALETTE[400]} />
                    <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                      {ownerName}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center">
                <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                  {formatDate(schedule.date)}
                </Text>
                <View className="mx-2 h-3 w-px bg-secondary-300 dark:bg-surface-elevated" />
                <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                  {schedule.type === STATUS.SCHEDULE.COMPLETED
                    ? timeDisplayInfo.duration
                    : confirmedTimeDisplay}
                </Text>
              </View>

              <View className="mt-2 flex-row items-center">
                <BriefcaseIcon size={14} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1.5 text-sm text-content-secondary font-sans">
                  {getRoleDisplayName(schedule.role, schedule.customRole)}
                </Text>
              </View>
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
        </View>
      </CardStripe>
    </Pressable>
  );
});

export default ScheduleCard;
