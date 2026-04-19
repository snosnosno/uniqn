/**
 * UNIQN Mobile - schedule detail settlement tab
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui';
import { BanknotesIcon } from '@/components/icons';
import {
  formatCurrency,
  formatDuration,
  SALARY_TYPE_LABELS,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import {
  calculateSettlementWithTax,
  calculateHoursWorked,
  PROVIDED_FLAG,
  DEFAULT_SALARY_INFO,
  DEFAULT_TAX_SETTINGS,
  getRoleSalaryFromSettlementSource,
} from '@/domains/settlement';
import { STATUS } from '@/constants';
import { PAYROLL_STATUS } from '@/constants/statusConfig';
import type { ScheduleEvent, PayrollStatus } from '@/types';

export interface SettlementTabProps {
  schedule: ScheduleEvent;
}

interface RowProps {
  label: string;
  value: string;
  isTotal?: boolean;
  isNegative?: boolean;
  isProvided?: boolean;
}

function Row({ label, value, isTotal, isNegative, isProvided }: RowProps) {
  return (
    <View
      className={`flex-row items-center justify-between py-2 ${
        isTotal ? 'border-t border-secondary-200 pt-3 dark:border-surface-overlay' : ''
      }`}
    >
      <Text
        className={`text-sm font-sans ${
          isTotal
            ? 'font-sans-semibold text-content-primary'
            : 'text-secondary-600 dark:text-secondary-400'
        }`}
      >
        {label}
      </Text>
      <Text
        className={`text-sm font-sans-medium ${
          isTotal
            ? 'text-lg font-display text-primary-600 dark:text-primary-400'
            : isNegative
              ? 'text-error-600 dark:text-error-400'
              : isProvided
                ? 'text-success-600 dark:text-success-400'
                : 'text-content-primary'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

export const SettlementTab = memo(function SettlementTab({ schedule }: SettlementTabProps) {
  const hasBreakdown = !!schedule.settlementBreakdown;

  const salaryInfo: SalaryInfo = useMemo(() => {
    if (schedule.settlementBreakdown?.salaryInfo) {
      return schedule.settlementBreakdown.salaryInfo;
    }
    if (schedule.customSalaryInfo) {
      return schedule.customSalaryInfo;
    }
    return (
      getRoleSalaryFromSettlementSource(
        schedule.postingProjection?.settlement,
        schedule.role,
        schedule.customRole
      ) || DEFAULT_SALARY_INFO
    );
  }, [
    schedule.settlementBreakdown?.salaryInfo,
    schedule.customSalaryInfo,
    schedule.postingProjection,
    schedule.role,
    schedule.customRole,
  ]);

  const allowances: Allowances | undefined = useMemo(() => {
    if (schedule.settlementBreakdown?.allowances) {
      return schedule.settlementBreakdown.allowances;
    }
    return schedule.customAllowances || schedule.postingProjection?.settlement.allowances;
  }, [
    schedule.settlementBreakdown?.allowances,
    schedule.customAllowances,
    schedule.postingProjection,
  ]);

  const taxSettings: TaxSettings = useMemo(() => {
    if (schedule.settlementBreakdown?.taxSettings) {
      return schedule.settlementBreakdown.taxSettings;
    }
    return (
      schedule.customTaxSettings ||
      schedule.postingProjection?.settlement.taxSettings ||
      DEFAULT_TAX_SETTINGS
    );
  }, [
    schedule.settlementBreakdown?.taxSettings,
    schedule.customTaxSettings,
    schedule.postingProjection,
  ]);

  const settlement = useMemo(() => {
    if (schedule.checkInTime && schedule.checkOutTime) {
      return calculateSettlementWithTax(
        schedule.checkInTime,
        schedule.checkOutTime,
        salaryInfo,
        allowances,
        taxSettings
      );
    }

    if (schedule.settlementBreakdown) {
      return {
        hoursWorked: schedule.settlementBreakdown.hoursWorked,
        basePay: schedule.settlementBreakdown.basePay,
        allowancePay: schedule.settlementBreakdown.allowancePay,
        totalPay: schedule.settlementBreakdown.totalPay,
        taxAmount: schedule.settlementBreakdown.taxAmount,
        afterTaxPay: schedule.settlementBreakdown.afterTaxPay,
      };
    }

    if (schedule.startTime && schedule.endTime) {
      return calculateSettlementWithTax(
        schedule.startTime,
        schedule.endTime,
        salaryInfo,
        allowances,
        taxSettings
      );
    }

    return null;
  }, [
    schedule.checkInTime,
    schedule.checkOutTime,
    schedule.settlementBreakdown,
    schedule.startTime,
    schedule.endTime,
    salaryInfo,
    allowances,
    taxSettings,
  ]);

  const hoursWorked = useMemo(() => {
    if (schedule.settlementBreakdown?.hoursWorked !== undefined) {
      return schedule.settlementBreakdown.hoursWorked;
    }
    if (schedule.checkInTime && schedule.checkOutTime) {
      return calculateHoursWorked(schedule.checkInTime, schedule.checkOutTime);
    }
    if (schedule.startTime && schedule.endTime) {
      return calculateHoursWorked(schedule.startTime, schedule.endTime);
    }
    return 0;
  }, [
    schedule.settlementBreakdown?.hoursWorked,
    schedule.checkInTime,
    schedule.checkOutTime,
    schedule.startTime,
    schedule.endTime,
  ]);

  const isEstimate = hasBreakdown
    ? schedule.settlementBreakdown!.isEstimate
    : !schedule.checkInTime || !schedule.checkOutTime;
  const payrollStatus = (schedule.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus;
  const payrollStatusConfig = PAYROLL_STATUS[payrollStatus];

  if (schedule.type === STATUS.SCHEDULE.APPLIED) {
    return (
      <View className="items-center py-6">
        <View className="w-full rounded-md bg-warning-50 p-4 dark:bg-warning-900/20">
          <Text className="text-center text-sm text-warning-700 dark:text-warning-300 font-sans">
            지원이 확정되면 정산 정보를 확인할 수 있습니다.
          </Text>
        </View>

        {settlement && (
          <View className="mt-4 w-full rounded-md bg-surface-page dark:bg-surface p-4 dark:bg-surface/50">
            <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              예상 급여 (참고용)
            </Text>
            <Text className="text-lg font-display text-content-primary dark:text-off-white">
              {formatCurrency(settlement.totalPay)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (schedule.type === STATUS.SCHEDULE.CANCELLED) {
    return (
      <View className="items-center py-6">
        <View className="w-full rounded-md bg-error-50 p-4 dark:bg-error-900/20">
          <Text className="text-center text-sm text-error-600 dark:text-error-400 font-sans">
            취소된 일정입니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-2">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <BanknotesIcon size={18} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">정산 정보</Text>
        </View>
        <Badge variant={payrollStatusConfig.variant} size="sm">
          {payrollStatusConfig.label}
        </Badge>
      </View>

      {isEstimate && (
        <View className="mb-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
          <Text className="text-center text-xs text-primary-700 dark:text-primary-300 font-sans">
            출퇴근 기록이 없어 예정 시간 기준으로 계산한 예상 금액입니다.
          </Text>
        </View>
      )}

      {settlement ? (
        <View className="rounded-md bg-surface-page dark:bg-surface p-4 dark:bg-surface/30">
          <View className="mb-4">
            <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              급여 계산
            </Text>
            <View className="flex-row items-baseline">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
              </Text>
              {salaryInfo.type === 'hourly' && (
                <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-500 font-sans">
                  × {formatDuration(hoursWorked)}
                </Text>
              )}
            </View>
            <Row label="기본급" value={formatCurrency(settlement.basePay)} />
          </View>

          {allowances && (
            <View className="mb-4 border-t border-secondary-200 pt-3 dark:border-surface-overlay">
              <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                수당
              </Text>

              {allowances.guaranteedHours && allowances.guaranteedHours > 0 && (
                <Row label="보장시간" value={`${allowances.guaranteedHours}시간`} />
              )}

              {allowances.meal !== undefined && allowances.meal !== 0 && (
                <Row
                  label="식비"
                  value={
                    allowances.meal === PROVIDED_FLAG
                      ? '제공'
                      : `+${formatCurrency(allowances.meal)}`
                  }
                  isProvided={allowances.meal === PROVIDED_FLAG}
                />
              )}

              {allowances.transportation !== undefined && allowances.transportation !== 0 && (
                <Row
                  label="교통비"
                  value={
                    allowances.transportation === PROVIDED_FLAG
                      ? '제공'
                      : `+${formatCurrency(allowances.transportation)}`
                  }
                  isProvided={allowances.transportation === PROVIDED_FLAG}
                />
              )}

              {allowances.accommodation !== undefined && allowances.accommodation !== 0 && (
                <Row
                  label="숙박비"
                  value={
                    allowances.accommodation === PROVIDED_FLAG
                      ? '제공'
                      : `+${formatCurrency(allowances.accommodation)}`
                  }
                  isProvided={allowances.accommodation === PROVIDED_FLAG}
                />
              )}

              {settlement.allowancePay > 0 && (
                <Row label="수당 합계" value={`+${formatCurrency(settlement.allowancePay)}`} />
              )}
            </View>
          )}

          {taxSettings.type !== 'none' && settlement.taxAmount > 0 && (
            <View className="mb-4 border-t border-secondary-200 pt-3 dark:border-surface-overlay">
              <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                세금 ({taxSettings.type === 'rate' ? `${taxSettings.value}%` : '고정'})
              </Text>
              <Row label="공제액" value={`-${formatCurrency(settlement.taxAmount)}`} isNegative />
            </View>
          )}

          <Row
            label={isEstimate ? '예상 총 금액' : '총 정산 금액'}
            value={formatCurrency(
              taxSettings.type !== 'none' && settlement.afterTaxPay !== undefined
                ? settlement.afterTaxPay
                : settlement.totalPay
            )}
            isTotal
          />
        </View>
      ) : (
        <View className="rounded-md bg-surface-page dark:bg-surface p-4 dark:bg-surface/50">
          <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            정산 정보를 계산할 수 없습니다.
          </Text>
        </View>
      )}

      {schedule.payrollAmount && schedule.payrollAmount > 0 && (
        <View className="mt-4 rounded-md bg-primary-50 p-4 dark:bg-primary-900/20">
          <Text className="mb-1 text-xs text-primary-600 dark:text-primary-400 font-sans">
            확정 정산 금액
          </Text>
          <Text className="text-xl font-display text-primary-700 dark:text-primary-300">
            {formatCurrency(schedule.payrollAmount)}
          </Text>
        </View>
      )}
    </View>
  );
});

export default SettlementTab;
