/**
 * UNIQN Mobile - 정산 요약 카드 컴포넌트
 *
 * @description 정산 현황 요약 (미정산/완료/총 금액)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../../ui/Card';
import { SettingsIcon } from '../../icons';
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
        <Text className="text-base font-semibold text-gray-900 dark:text-white">정산 현황</Text>
        <View className="flex-row items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">총 {totalCount}건</Text>
          {onOpenSettings && (
            <Pressable
              onPress={onOpenSettings}
              hitSlop={8}
              className="flex-row items-center px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
              accessibilityLabel="정산 설정"
              accessibilityRole="button"
            >
              <SettingsIcon size={16} color="#6B7280" />
              <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">정산설정</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row justify-between mb-2">
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">미정산</Text>
          <Text className="text-lg font-bold text-warning-600 dark:text-warning-400">
            {pendingCount}건
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-gray-200 dark:bg-surface" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">완료</Text>
          <Text className="text-lg font-bold text-success-600 dark:text-success-400">
            {completedCount}건
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(totalAmount - pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-gray-200 dark:bg-surface" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 금액</Text>
          <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(totalAmount)}
          </Text>
        </View>
      </View>
    </Card>
  );
});

export default SettlementSummaryCard;
