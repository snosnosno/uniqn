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
import { formatDateKorean } from '@/utils/date';
import { NO_SHOW_NOTICE_TITLE, NO_SHOW_NOTICE_DESCRIPTION } from '../helpers';
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

  /** 실제 근거가 있는 급여. 없으면 null — 기본값으로 메우지 않는다. */
  const agreedSalary: SalaryInfo | null = useMemo(() => {
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
      ) ?? null
    );
  }, [
    schedule.settlementBreakdown?.salaryInfo,
    schedule.customSalaryInfo,
    schedule.postingProjection,
    schedule.role,
    schedule.customRole,
  ]);

  const salaryInfo: SalaryInfo = agreedSalary ?? DEFAULT_SALARY_INFO;

  /**
   * 스태프에게 금액을 보여줘도 되는지.
   *
   * 근거가 없으면 `DEFAULT_SALARY_INFO`(시급 15,000원)로 조용히 대체돼, **아무도 합의한 적 없는
   * 금액**이 본인 정산액처럼 보인다. '협의'(type 'other')도 금액 미정 상태라 총액을 계산하면
   * ₩0 이 확정 금액처럼 크게 뜬다. 두 경우 모두 계산 결과 대신 '미정'을 밝혀야 한다.
   */
  const canShowComputedSettlement =
    !!agreedSalary && !(agreedSalary.type === 'other' && agreedSalary.amount <= 0);

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

        {settlement && canShowComputedSettlement && (
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
      {/* 노쇼는 취소처럼 조기 return 하지 않는다 — 아래 '확정 정산 금액' 블록(0원 차감 표시)은
          정확히 이 경우를 위해 쓰인 것인데, 예전엔 노쇼가 cancelled 로 접혀 조기 return 에
          걸리는 바람에 코드에 있는 그 안내에 영영 도달하지 못했다. */}
      {schedule.type === STATUS.SCHEDULE.NO_SHOW && (
        <View className="mb-4 rounded-md bg-error-50 p-4 dark:bg-error-900/20">
          <Text className="text-sm font-sans-semibold text-error-700 dark:text-error-300">
            {NO_SHOW_NOTICE_TITLE}
          </Text>
          <Text className="mt-1 text-sm text-error-600 dark:text-error-400 font-sans">
            {NO_SHOW_NOTICE_DESCRIPTION}
          </Text>
        </View>
      )}

      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <BanknotesIcon size={18} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-2 text-sm font-sans-semibold text-content-secondary">정산 정보</Text>
        </View>
        <Badge variant={payrollStatusConfig.variant} size="sm">
          {payrollStatusConfig.label}
        </Badge>
      </View>

      {/* 지급 처리 시각 — '정산 완료' 배지만으로는 언제 처리됐는지 알 수 없어
          결국 구인자에게 전화하게 된다. 단, 처리 시각 ≠ 입금 시각이라 그 차이를 밝힌다. */}
      {schedule.payrollStatus === STATUS.PAYROLL.COMPLETED && schedule.payrollDate && (
        <View className="mb-4 rounded-md bg-success-50 px-3 py-2 dark:bg-success-900/20">
          <Text className="text-sm font-sans-medium text-success-700 dark:text-success-300">
            {formatDateKorean(schedule.payrollDate)} 지급 처리
          </Text>
          <Text className="mt-0.5 text-xs text-success-600 dark:text-success-400 font-sans">
            실제 입금은 구인자 이체 시점에 따라 다를 수 있어요.
          </Text>
        </View>
      )}

      {isEstimate && (
        <View className="mb-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
          <Text className="text-center text-xs text-primary-700 dark:text-primary-300 font-sans">
            출퇴근 기록이 없어 예정 시간 기준으로 계산한 예상 금액입니다.
          </Text>
        </View>
      )}

      {!canShowComputedSettlement ? (
        <View className="rounded-md border border-warning-200 bg-warning-50 p-4 dark:border-warning-700 dark:bg-warning-900/20">
          <Text className="text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
            급여가 아직 정해지지 않았어요
          </Text>
          <Text className="mt-1 text-xs text-warning-600 dark:text-warning-400 font-sans">
            구인자가 급여를 확정하면 이 화면에 정산 금액이 표시돼요. 급하면 구인자에게 직접 확인해
            주세요.
          </Text>
        </View>
      ) : settlement ? (
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

              {typeof allowances.guaranteedHours === 'number' && allowances.guaranteedHours > 0 && (
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

      {/* 0 원 확정(노쇼 차감·'협의' 급여)도 표시해야 이의 제기 시점을 놓치지 않는다.
          truthy 가드는 0 을 숨길 뿐 아니라 숫자 0 을 View 의 직접 자식으로 흘려 RN 을 죽인다. */}
      {typeof schedule.payrollAmount === 'number' && (
        <View className="mt-4 rounded-md bg-primary-50 p-4 dark:bg-primary-900/20">
          <Text className="mb-1 text-xs text-primary-600 dark:text-primary-400 font-sans">
            확정 정산 금액
          </Text>
          <Text className="text-xl font-display text-primary-700 dark:text-primary-300">
            {formatCurrency(schedule.payrollAmount)}
          </Text>
          {schedule.payrollAmount === 0 && (
            <Text className="mt-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
              구인자가 정산 금액을 0원으로 확정했어요. 다르다면 구인자에게 문의해 주세요.
            </Text>
          )}
        </View>
      )}
    </View>
  );
});
