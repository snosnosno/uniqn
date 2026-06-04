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
          <Text className="text-[10px] text-content-placeholder font-sans">수당 포함</Text>
        </View>
      </View>
      <Text className="mt-2 text-[10px] text-content-placeholder font-sans text-center">
        {
          '※ 스태프 화면의 \u201C확정\u201D 금액은 기본급 기준이며, 여기 \u201C총 정산액\u201D은 수당을 포함합니다.'
        }
      </Text>
    </Card>
  );
});

export default SettlementSummaryCard;
