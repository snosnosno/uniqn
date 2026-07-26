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
import { calculateSettlementWithTax, DEFAULT_TAX_SETTINGS } from '@/domains/settlement';
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
import { PAYROLL_STATUS } from '@/constants/statusConfig';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import { WorkTimeDisplay } from '@/shared/time';
import { shouldUseFrozenPayrollAmount } from '@/utils/settlementGrouping';
import type { ScheduleEvent, PayrollStatus } from '@/types';

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
    const isCompleted = schedule.type === STATUS.SCHEDULE.COMPLETED;
    if (!isCompleted) return null;

    // 동결값 판정은 정산 목록(settlementGrouping)과 동일한 SSOT 헬퍼를 공유한다.
    // Number.isFinite로 판정 → 노쇼 등 정산 0원 완료 건도 동결값을 존중(0 표시).
    if (shouldUseFrozenPayrollAmount(isCompleted, schedule.payrollAmount)) {
      return schedule.payrollAmount;
    }

    if (schedule.checkInTime && schedule.checkOutTime) {
      // 급여 근거가 하나도 없으면 계산하지 않는다 — DEFAULT_SALARY_INFO(시급 15,000원)로
      // 메우면 아무도 합의한 적 없는 금액이 카드에 확정처럼 찍힌다.
      const agreedSalary =
        schedule.customSalaryInfo ||
        projectedSalary ||
        schedule.postingProjection?.settlement.defaultSalary;
      if (!agreedSalary) return null;

      const salaryInfo: SalaryInfo = agreedSalary;
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

  const payrollStatusConfig =
    PAYROLL_STATUS[(schedule.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus];

  const timeDisplayInfo = useMemo(() => WorkTimeDisplay.getDisplayInfo(schedule), [schedule]);

  const confirmedTimeDisplay = useMemo(() => {
    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) return null;
    return `${timeDisplayInfo.effectiveStart} - ${timeDisplayInfo.effectiveEnd}`;
  }, [schedule.type, timeDisplayInfo]);

  const isCancelled = schedule.type === STATUS.SCHEDULE.CANCELLED;
  // 스크린리더로 카드 하나를 들었을 때 완결 문장이 되도록 금액·취소요청 여부까지 넣는다.
  const accessibilityLabel = [
    status.label,
    schedule.jobPostingName,
    formatDate(schedule.date),
    schedule.location,
    typeof completedAmount === 'number' ? formatCurrency(completedAmount) : null,
    schedule.type === STATUS.SCHEDULE.COMPLETED ? payrollStatusConfig?.label : null,
    hasPendingCancellation ? '취소 요청 검토 중' : null,
  ]
    .filter(Boolean)
    .join(', ');

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

            {/* 0 원 확정(노쇼 차감·'협의' 급여)도 표시해야 한다. truthy 가드는 0 을 숨길 뿐
                아니라 숫자 0 을 View 의 직접 자식으로 흘려 RN 렌더를 죽인다. */}
            {schedule.type === STATUS.SCHEDULE.COMPLETED && typeof completedAmount === 'number' && (
              <View className="items-end">
                <Text className="text-base font-sans-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(completedAmount)}
                </Text>
                {/* '입금 됐나'는 근무 후 가장 잦은 확인인데, 예전에는 카드를 하나씩 열어
                      정산 탭까지 들어가야 알 수 있었다. 모달과 같은 SSOT 배지를 카드에 올린다. */}
                <View className="mt-1">
                  <Badge variant={payrollStatusConfig.variant} size="sm">
                    {payrollStatusConfig.label}
                  </Badge>
                </View>
              </View>
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

              <View className="mt-2 flex-row flex-wrap items-center">
                <View className="mr-3 flex-row items-center">
                  <BriefcaseIcon size={14} color={SECONDARY_PALETTE[500]} />
                  <Text className="ml-1.5 text-sm text-content-secondary font-sans">
                    {getRoleDisplayName(schedule.role, schedule.customRole)}
                  </Text>
                </View>

                {/* 확정에도 급여를 남긴다 — '언제/어디서/얼마'가 카드 3요소인데, 지원 중에
                    보이던 금액이 확정되는 순간(실제로 돈이 걸린 순간) 사라지고 있었다. */}
                {schedule.type === STATUS.SCHEDULE.CONFIRMED && salaryDisplay && (
                  <View className="mr-3 flex-row items-center">
                    <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
                    <Text className="ml-1.5 text-sm font-sans-medium text-content-secondary">
                      {salaryDisplay}
                    </Text>
                  </View>
                )}

                {schedule.type === STATUS.SCHEDULE.CONFIRMED && ownerName && (
                  <View className="flex-row items-center">
                    <UserIcon size={14} color={SECONDARY_PALETTE[400]} />
                    <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                      {ownerName}
                    </Text>
                  </View>
                )}
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
