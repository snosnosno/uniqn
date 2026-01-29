/**
 * UNIQN Mobile - 예상 비용 카드 컴포넌트
 *
 * @description 예상 총 인건비 표시 UI
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '@/utils/salary';
import type { EstimatedCostCardProps } from './types';

/**
 * 예상 비용 카드 컴포넌트
 *
 * @example
 * <EstimatedCostCard
 *   estimatedCost={1200000}
 *   totalCount={5}
 * />
 */
export const EstimatedCostCard = memo(function EstimatedCostCard({
  estimatedCost,
  totalCount,
}: EstimatedCostCardProps) {
  if (estimatedCost <= 0) {
    return null;
  }

  return (
    <View className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
      <Text className="text-sm text-primary-700 dark:text-primary-300 mb-2">
        예상 총 인건비 (1일 기준)
      </Text>
      <Text className="text-2xl font-bold text-primary-900 dark:text-primary-100">
        {formatCurrency(estimatedCost)}원
      </Text>
      <Text className="text-xs text-primary-600 dark:text-primary-400 mt-1">
        {totalCount}명 기준 (시급은 8시간 환산)
      </Text>
    </View>
  );
});
