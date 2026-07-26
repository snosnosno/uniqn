/**
 * UNIQN Mobile - 지원자 일괄 확정 액션바 컴포넌트
 *
 * @description 신규(applied) 지원자 일괄 선택/해제 및 확정 실행 UI.
 *              정산 화면의 SettlementBulkActions 와 동일한 선택 패턴을 차용한다.
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckIcon, CheckCircleIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantBulkActionsProps {
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkConfirm: () => void;
  isAllSelected: boolean;
  isBulkConfirming?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ApplicantBulkActions = React.memo(function ApplicantBulkActions({
  selectedCount,
  onSelectAll,
  onClearSelection,
  onBulkConfirm,
  isAllSelected,
  isBulkConfirming = false,
}: ApplicantBulkActionsProps) {
  const disabled = selectedCount === 0 || isBulkConfirming;

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
      <View className="flex-row items-center">
        <Pressable
          onPress={isAllSelected ? onClearSelection : onSelectAll}
          className="flex-row items-center mr-4"
          accessibilityRole="button"
          accessibilityLabel={isAllSelected ? '전체 선택 해제' : '전체 선택'}
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
        <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
          {selectedCount}명 선택
        </Text>
      </View>
      <Pressable
        onPress={onBulkConfirm}
        disabled={disabled}
        className={`
          flex-row items-center px-4 py-2 rounded-lg
          ${disabled ? 'bg-secondary-300 dark:bg-surface-elevated' : 'bg-primary-500 active:opacity-70'}
        `}
        accessibilityRole="button"
        accessibilityLabel={`${selectedCount}명 일괄 확정`}
      >
        <CheckCircleIcon size={16} color={disabled ? SECONDARY_PALETTE[400] : '#fff'} />
        <Text
          className={`
          ml-1 text-sm font-sans-medium
          ${disabled ? 'text-secondary-500 dark:text-secondary-400' : 'text-surface-dark'}
        `}
        >
          {isBulkConfirming ? '확정 중...' : '일괄 확정'}
        </Text>
      </Pressable>
    </View>
  );
});
