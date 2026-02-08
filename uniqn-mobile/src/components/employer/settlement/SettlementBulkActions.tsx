/**
 * UNIQN Mobile - 정산 일괄 처리 액션바 컴포넌트
 *
 * @description 일괄 정산 선택/해제 및 실행 UI
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BanknotesIcon, CheckIcon } from '../../icons';
import { formatCurrency } from '@/utils/settlement';

// ============================================================================
// Types
// ============================================================================

export interface SettlementBulkActionsProps {
  selectedCount: number;
  selectedAmount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSettle: () => void;
  isAllSelected: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SettlementBulkActions = React.memo(function SettlementBulkActions({
  selectedCount,
  selectedAmount,
  onSelectAll,
  onClearSelection,
  onBulkSettle,
  isAllSelected,
}: SettlementBulkActionsProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
      <View className="flex-row items-center">
        <Pressable
          onPress={isAllSelected ? onClearSelection : onSelectAll}
          className="flex-row items-center mr-4"
        >
          <View
            className={`
            h-5 w-5 rounded border-2 items-center justify-center mr-2
            ${
              isAllSelected
                ? 'bg-primary-500 border-primary-500'
                : 'border-gray-400 dark:border-surface-overlay'
            }
          `}
          >
            {isAllSelected && <CheckIcon size={12} color="#fff" />}
          </View>
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            {isAllSelected ? '해제' : '전체'}
          </Text>
        </Pressable>
        <View>
          <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
            {selectedCount}건 선택
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(selectedAmount)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onBulkSettle}
        disabled={selectedCount === 0}
        className={`
          flex-row items-center px-4 py-2 rounded-lg
          ${selectedCount > 0 ? 'bg-primary-500 active:opacity-70' : 'bg-gray-300 dark:bg-surface'}
        `}
      >
        <BanknotesIcon size={16} color={selectedCount > 0 ? '#fff' : '#9CA3AF'} />
        <Text
          className={`
          ml-1 text-sm font-medium
          ${selectedCount > 0 ? 'text-white' : 'text-gray-500 dark:text-gray-400'}
        `}
        >
          일괄 정산
        </Text>
      </Pressable>
    </View>
  );
});

export default SettlementBulkActions;
