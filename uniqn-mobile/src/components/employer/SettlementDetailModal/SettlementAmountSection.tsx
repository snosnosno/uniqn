/**
 * UNIQN Mobile - 정산 금액 섹션 컴포넌트
 *
 * @description 급여, 수당, 세금, 총액 정보 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { BanknotesIcon } from '../../icons';
import { Badge } from '../../ui/Badge';
import { InfoRow } from './InfoRow';
import {
  formatCurrency,
  formatDuration,
  SALARY_TYPE_LABELS,
  type SalaryInfo,
} from '@/utils/settlement';

export interface SettlementAmountSectionProps {
  /** 급여 정보 */
  salaryInfo: SalaryInfo;
  /** 정산 계산 결과 */
  settlement: {
    basePay: number;
    allowancePay: number;
    taxAmount: number;
    totalPay: number;
    afterTaxPay: number;
    hoursWorked: number;
  };
  /** 수당 항목 (표시용) */
  allowanceItems: string[];
}

/**
 * 정산 금액 섹션
 *
 * @example
 * <SettlementAmountSection
 *   salaryInfo={{ type: 'hourly', amount: 15000 }}
 *   settlement={{ basePay: 120000, allowancePay: 10000, ... }}
 *   allowanceItems={['식비 10,000원', '교통비 제공']}
 * />
 */
export function SettlementAmountSection({
  salaryInfo,
  settlement,
  allowanceItems,
}: SettlementAmountSectionProps) {
  return (
    <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
      <View className="flex-row items-center mb-3">
        <BanknotesIcon size={18} color="#6B7280" />
        <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
          정산 금액
        </Text>
      </View>

      <View className="flex-col gap-1">
        {/* 급여 타입에 따른 계산 내역 */}
        {salaryInfo.type === 'hourly' ? (
          <InfoRow
            label={`${SALARY_TYPE_LABELS[salaryInfo.type]} ${formatCurrency(salaryInfo.amount)} × ${formatDuration(settlement.hoursWorked)}`}
            value={formatCurrency(settlement.basePay)}
          />
        ) : (
          <InfoRow
            label={`${SALARY_TYPE_LABELS[salaryInfo.type]}`}
            value={formatCurrency(settlement.basePay)}
          />
        )}

        {/* 수당 금액 (금액이 있는 경우만 표시) */}
        {settlement.allowancePay > 0 && (
          <InfoRow
            label="수당"
            value={`+${formatCurrency(settlement.allowancePay)}`}
            valueColor="text-green-600 dark:text-green-400"
          />
        )}

        {/* 수당 정보 뱃지 (제공 항목 포함) */}
        {allowanceItems.length > 0 && (
          <View className="flex-row flex-wrap py-2">
            {allowanceItems.map((item, idx) => (
              <Badge key={idx} variant="default" size="sm" className="mr-2 mb-1">
                {item}
              </Badge>
            ))}
          </View>
        )}

        {/* 세금 공제 (세금이 있는 경우만 표시) */}
        {settlement.taxAmount > 0 && (
          <InfoRow
            label="세금 공제"
            value={`-${formatCurrency(settlement.taxAmount)}`}
            valueColor="text-red-600 dark:text-red-400"
          />
        )}

        <View className="h-px bg-gray-200 dark:bg-surface my-2" />

        <InfoRow
          label="총 정산 금액"
          value={formatCurrency(
            settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay
          )}
          highlight
        />
      </View>
    </View>
  );
}
