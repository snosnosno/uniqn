/**
 * UNIQN Mobile - 정산 일괄 처리 액션바 컴포넌트
 *
 * @description 일괄 정산 선택/해제 및 실행 UI
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BanknotesIcon, CheckIcon } from '@/components/icons';
import { formatCurrency } from '@/utils/settlement';
import { triggerBatchStart } from '@/utils/haptics';

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
  // impeccable v2 §17 — 일괄 정산 "시작" 햅틱.
  // throttle 무관하게 Light 1회. 종료 햅틱은 useBulkSettlement 훅에서 발화.
  const handleBulkSettle = useCallback(async () => {
    if (selectedCount === 0) return;
    await triggerBatchStart();
    onBulkSettle();
  }, [selectedCount, onBulkSettle]);

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
                : 'border-secondary-400 dark:border-surface-overlay'
            }
          `}
          >
            {isAllSelected && <CheckIcon size={12} color="#fff" />}
          </View>
          <Text className="text-sm text-content-secondary font-sans">
            {isAllSelected ? '해제' : '전체'}
          </Text>
        </Pressable>
        <View>
          <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
            {selectedCount}건 선택
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            {formatCurrency(selectedAmount)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={handleBulkSettle}
        disabled={selectedCount === 0}
        className={`
          flex-row items-center px-4 py-2 rounded-lg
          ${selectedCount > 0 ? 'bg-primary-500 active:opacity-70' : 'bg-secondary-300 dark:bg-surface'}
        `}
      >
        <BanknotesIcon size={16} color={selectedCount > 0 ? '#fff' : SECONDARY_PALETTE[400]} />
        <Text
          className={`
          ml-1 text-sm font-sans-medium
          ${selectedCount > 0 ? 'text-surface-dark' : 'text-secondary-500 dark:text-secondary-400'}
        `}
        >
          일괄 정산
        </Text>
      </Pressable>
    </View>
  );
});

export default SettlementBulkActions;
