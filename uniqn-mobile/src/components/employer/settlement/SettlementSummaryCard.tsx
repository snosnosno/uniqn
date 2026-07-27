/**
 * UNIQN Mobile - 정산 요약 카드 컴포넌트
 *
 * @description 정산 현황 요약 (미정산/완료/총 금액)
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SettingsIcon } from '@/components/icons';
import { formatCurrency } from '@/utils/settlement';

// ============================================================================
// Types
// ============================================================================

export interface SettlementSummaryCardProps {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  totalAmount: number;
  pendingAmount: number;
  onOpenSettings?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const SettlementSummaryCard = React.memo(function SettlementSummaryCard({
  totalCount,
  pendingCount,
  completedCount,
  totalAmount,
  pendingAmount,
  onOpenSettings,
}: SettlementSummaryCardProps) {
  return (
    <Card variant="filled" padding="md" className="mb-4 mx-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          정산 현황
        </Text>
        <View className="flex-row items-center">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 mr-2 font-sans">
            총 {totalCount}건
          </Text>
          {onOpenSettings && (
            <Pressable
              onPress={onOpenSettings}
              hitSlop={8}
              className="flex-row items-center px-2 py-1.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
              accessibilityLabel="정산 설정"
              accessibilityRole="button"
            >
              <SettingsIcon size={16} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                정산설정
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row justify-between mb-2">
        <View className="flex-1 items-center">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            미정산
          </Text>
          <Text className="text-lg font-display text-warning-600 dark:text-warning-400">
            {pendingCount}건
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            {formatCurrency(pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-secondary-200 dark:bg-surface" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            완료
          </Text>
          <Text className="text-lg font-display text-success-600 dark:text-success-400">
            {completedCount}건
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            {formatCurrency(totalAmount - pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-secondary-200 dark:bg-surface" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            총 정산액
          </Text>
          <Text className="text-lg font-display text-primary-600 dark:text-primary-400">
            {formatCurrency(totalAmount)}
          </Text>
          <Text className="text-micro text-content-placeholder font-sans">수당 포함</Text>
        </View>
      </View>
      {/* 과거 문구는 '스태프 확정=기본급 기준, 여기 총 정산액=수당 포함' 이었는데 둘 다 사실과
          반대였다. 동결값(payroll_amount)은 calculateSettlementAmount 의 afterTaxPay — 유효
          수당을 포함한 세후 금액이고(SettlementRepository), 정산 완료분의 '총 정산액' 은 바로
          그 동결값 자체다. 이 거짓 고지가 실제 금액 불일치(SETTLE-5/8)를 '원래 다른 값' 으로
          정당화해 결함 인지 자체를 막고 있었다. */}
      <Text className="mt-2 text-micro text-content-placeholder font-sans text-center">
        {
          '※ 금액은 모두 수당 포함 · 세후 기준이에요. 정산이 끝난 근무는 그때 확정된 금액이 그대로 남고, 남은 근무는 현재 설정으로 계산한 예상액이에요.'
        }
      </Text>
    </Card>
  );
});
