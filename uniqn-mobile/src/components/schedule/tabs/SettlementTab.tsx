/**
 * UNIQN Mobile - 스케줄 상세 모달 정산 탭
 *
 * @description 급여 계산, 수당, 세금, 총 금액 표시
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui';
import { BanknotesIcon } from '@/components/icons';
import {
  formatCurrency,
  formatDuration,
  calculateSettlementWithTax,
  calculateHoursWorked,
  SALARY_TYPE_LABELS,
  PROVIDED_FLAG,
  DEFAULT_SALARY_INFO,
  DEFAULT_TAX_SETTINGS,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import type { ScheduleEvent, PayrollStatus } from '@/types';
import type { JobPostingCard } from '@/types/jobPosting';

// ============================================================================
// Types
// ============================================================================

export interface SettlementTabProps {
  schedule: ScheduleEvent;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 역할에 해당하는 급여 정보 찾기
 * - dateRequirements에서 역할별 급여 조회
 * - 찾지 못하면 defaultSalary 반환
 */
function getRoleSalary(
  card: JobPostingCard | undefined,
  role: string,
  customRole?: string
): SalaryInfo {
  if (!card) return DEFAULT_SALARY_INFO;

  // useSameSalary가 true면 defaultSalary 사용
  if (card.useSameSalary && card.defaultSalary) {
    return card.defaultSalary;
  }

  // dateRequirements에서 역할별 급여 찾기
  for (const dateReq of card.dateRequirements || []) {
    for (const timeSlot of dateReq.timeSlots || []) {
      for (const r of timeSlot.roles || []) {
        // 역할 매칭
        const isMatch =
          (role === 'other' && customRole && r.customRole === customRole) ||
          (r.role === role);

        if (isMatch && r.salary) {
          return r.salary;
        }
      }
    }
  }

  // 역할별 급여 못 찾으면 defaultSalary 폴백
  return card.defaultSalary || DEFAULT_SALARY_INFO;
}

// ============================================================================
// Constants
// ============================================================================

const PAYROLL_STATUS_CONFIG: Record<PayrollStatus, {
  label: string;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
}> = {
  pending: { label: '미정산', variant: 'warning' },
  processing: { label: '처리중', variant: 'primary' },
  completed: { label: '정산완료', variant: 'success' },
};

// ============================================================================
// Sub Components
// ============================================================================

interface RowProps {
  label: string;
  value: string;
  isTotal?: boolean;
  isNegative?: boolean;
  isProvided?: boolean;
}

function Row({ label, value, isTotal, isNegative, isProvided }: RowProps) {
  return (
    <View className={`flex-row justify-between items-center py-2 ${isTotal ? 'pt-3 border-t border-gray-200 dark:border-gray-600' : ''}`}>
      <Text className={`text-sm ${isTotal ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </Text>
      <Text
        className={`text-sm font-medium ${
          isTotal
            ? 'text-lg font-bold text-primary-600 dark:text-primary-400'
            : isNegative
              ? 'text-red-600 dark:text-red-400'
              : isProvided
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export const SettlementTab = memo(function SettlementTab({ schedule }: SettlementTabProps) {
  // settlementBreakdown이 있으면 미리 계산된 값 사용 (성능 최적화)
  const hasBreakdown = !!schedule.settlementBreakdown;

  // 급여 정보: settlementBreakdown > 개별 오버라이드 > JobPostingCard
  const salaryInfo: SalaryInfo = useMemo(() => {
    // 미리 계산된 값 우선
    if (schedule.settlementBreakdown?.salaryInfo) {
      return schedule.settlementBreakdown.salaryInfo;
    }
    // 구인자가 개별 수정한 급여 정보가 있으면 우선 사용
    if (schedule.customSalaryInfo) {
      return schedule.customSalaryInfo;
    }
    // 없으면 JobPostingCard에서 역할별 급여 조회
    return getRoleSalary(
      schedule.jobPostingCard,
      schedule.role,
      schedule.customRole
    );
  }, [schedule.settlementBreakdown?.salaryInfo, schedule.customSalaryInfo, schedule.jobPostingCard, schedule.role, schedule.customRole]);

  // 수당 정보: settlementBreakdown > 개별 오버라이드 > JobPostingCard 기본값
  const allowances: Allowances | undefined = useMemo(() => {
    if (schedule.settlementBreakdown?.allowances) {
      return schedule.settlementBreakdown.allowances;
    }
    return schedule.customAllowances || schedule.jobPostingCard?.allowances;
  }, [schedule.settlementBreakdown?.allowances, schedule.customAllowances, schedule.jobPostingCard?.allowances]);

  // 세금 설정: settlementBreakdown > 개별 오버라이드 > JobPostingCard 기본값
  const taxSettings: TaxSettings = useMemo(() => {
    if (schedule.settlementBreakdown?.taxSettings) {
      return schedule.settlementBreakdown.taxSettings;
    }
    return schedule.customTaxSettings ||
      schedule.jobPostingCard?.taxSettings ||
      DEFAULT_TAX_SETTINGS;
  }, [schedule.settlementBreakdown?.taxSettings, schedule.customTaxSettings, schedule.jobPostingCard?.taxSettings]);

  // 정산 계산 (세금 포함)
  // 우선순위: 실제 시간 재계산 > settlementBreakdown > 예정 시간 계산
  const settlement = useMemo(() => {
    // 1. 실제 출퇴근 시간이 있으면 항상 최신 시간으로 재계산 (시간 수정 시 즉시 반영)
    if (schedule.checkInTime && schedule.checkOutTime) {
      return calculateSettlementWithTax(
        schedule.checkInTime,
        schedule.checkOutTime,
        salaryInfo,
        allowances,
        taxSettings
      );
    }

    // 2. 미리 계산된 settlementBreakdown이 있으면 사용 (출퇴근 시간 없는 경우)
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

    // 3. 예정 시간으로 예상 금액 계산 (폴백)
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
  }, [schedule.settlementBreakdown, schedule.checkInTime, schedule.checkOutTime, schedule.startTime, schedule.endTime, salaryInfo, allowances, taxSettings]);

  // 근무 시간: settlementBreakdown 우선 사용
  const hoursWorked = useMemo(() => {
    // 미리 계산된 값 사용
    if (schedule.settlementBreakdown?.hoursWorked !== undefined) {
      return schedule.settlementBreakdown.hoursWorked;
    }
    // 폴백: 직접 계산
    if (schedule.checkInTime && schedule.checkOutTime) {
      return calculateHoursWorked(schedule.checkInTime, schedule.checkOutTime);
    }
    if (schedule.startTime && schedule.endTime) {
      return calculateHoursWorked(schedule.startTime, schedule.endTime);
    }
    return 0;
  }, [schedule.settlementBreakdown?.hoursWorked, schedule.checkInTime, schedule.checkOutTime, schedule.startTime, schedule.endTime]);

  // 예상 금액 여부: settlementBreakdown 우선 사용
  const isEstimate = hasBreakdown
    ? schedule.settlementBreakdown!.isEstimate
    : !schedule.checkInTime || !schedule.checkOutTime;
  const payrollStatus = (schedule.payrollStatus || 'pending') as PayrollStatus;
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  // 지원중 상태면 안내 메시지 표시
  if (schedule.type === 'applied') {
    return (
      <View className="py-6 items-center">
        <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 w-full">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
            지원이 확정되면 정산 정보를 확인할 수 있습니다.
          </Text>
        </View>

        {/* 예상 급여 미리보기 */}
        {settlement && (
          <View className="mt-4 w-full p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">예상 급여 (참고용)</Text>
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(settlement.totalPay)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // 취소 상태면 안내 메시지 표시
  if (schedule.type === 'cancelled') {
    return (
      <View className="py-6 items-center">
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 w-full">
          <Text className="text-sm text-red-600 dark:text-red-400 text-center">
            취소된 스케줄입니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-2">
      {/* 정산 상태 */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <BanknotesIcon size={18} color="#6B7280" />
          <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            정산 정보
          </Text>
        </View>
        <Badge variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Badge>
      </View>

      {/* 예상 금액 안내 */}
      {isEstimate && (
        <View className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text className="text-xs text-blue-700 dark:text-blue-300 text-center">
            출퇴근 기록이 없어 예정 시간 기준으로 계산된 예상 금액입니다.
          </Text>
        </View>
      )}

      {settlement ? (
        <View className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
          {/* 급여 계산 */}
          <View className="mb-4">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">급여 계산</Text>
            <View className="flex-row items-baseline">
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                {SALARY_TYPE_LABELS[salaryInfo.type]} {salaryInfo.amount.toLocaleString()}원
              </Text>
              {salaryInfo.type === 'hourly' && (
                <Text className="text-sm text-gray-500 dark:text-gray-500 ml-1">
                  × {formatDuration(hoursWorked)}
                </Text>
              )}
            </View>
            <Row label="기본급" value={formatCurrency(settlement.basePay)} />
          </View>

          {/* 수당 */}
          {allowances && (
            <View className="mb-4 pt-3 border-t border-gray-200 dark:border-gray-600">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">수당</Text>

              {/* 보장시간 */}
              {allowances.guaranteedHours && allowances.guaranteedHours > 0 && (
                <Row label="보장시간" value={`${allowances.guaranteedHours}시간`} />
              )}

              {/* 식비 */}
              {allowances.meal !== undefined && allowances.meal !== 0 && (
                <Row
                  label="식비"
                  value={allowances.meal === PROVIDED_FLAG ? '제공' : `+${formatCurrency(allowances.meal)}`}
                  isProvided={allowances.meal === PROVIDED_FLAG}
                />
              )}

              {/* 교통비 */}
              {allowances.transportation !== undefined && allowances.transportation !== 0 && (
                <Row
                  label="교통비"
                  value={allowances.transportation === PROVIDED_FLAG ? '제공' : `+${formatCurrency(allowances.transportation)}`}
                  isProvided={allowances.transportation === PROVIDED_FLAG}
                />
              )}

              {/* 숙박비 */}
              {allowances.accommodation !== undefined && allowances.accommodation !== 0 && (
                <Row
                  label="숙박비"
                  value={allowances.accommodation === PROVIDED_FLAG ? '제공' : `+${formatCurrency(allowances.accommodation)}`}
                  isProvided={allowances.accommodation === PROVIDED_FLAG}
                />
              )}

              {settlement.allowancePay > 0 && (
                <Row label="수당 합계" value={`+${formatCurrency(settlement.allowancePay)}`} />
              )}
            </View>
          )}

          {/* 세금 */}
          {taxSettings.type !== 'none' && settlement.taxAmount > 0 && (
            <View className="mb-4 pt-3 border-t border-gray-200 dark:border-gray-600">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                세금 ({taxSettings.type === 'rate' ? `${taxSettings.value}%` : '고정'})
              </Text>
              <Row
                label="공제액"
                value={`-${formatCurrency(settlement.taxAmount)}`}
                isNegative
              />
            </View>
          )}

          {/* 총 금액 */}
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
        <View className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
            정산 정보를 계산할 수 없습니다.
          </Text>
        </View>
      )}

      {/* 실제 정산 금액이 있으면 표시 */}
      {schedule.payrollAmount && schedule.payrollAmount > 0 && (
        <View className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
          <Text className="text-xs text-primary-600 dark:text-primary-400 mb-1">
            확정 정산 금액
          </Text>
          <Text className="text-xl font-bold text-primary-700 dark:text-primary-300">
            {formatCurrency(schedule.payrollAmount)}
          </Text>
        </View>
      )}
    </View>
  );
});

export default SettlementTab;
