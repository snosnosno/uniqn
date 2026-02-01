/**
 * UNIQN Mobile - 신규 지원 액션 버튼
 *
 * @description 지원자 확정/거절 버튼
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { CheckIcon, XMarkIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface AppliedActionsProps {
  /** 고정공고 모드 */
  isFixedMode: boolean;
  /** 전체 일정 개수 */
  totalCount: number;
  /** 선택된 일정 개수 */
  selectedCount: number;
  /** 확정 핸들러 */
  onConfirm: () => void;
  /** 거절 핸들러 */
  onReject: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const AppliedActions = React.memo(function AppliedActions({
  isFixedMode,
  totalCount,
  selectedCount,
  onConfirm,
  onReject,
}: AppliedActionsProps) {
  // 확정 버튼 비활성화 조건: 고정공고가 아니고, 일정이 있는데 선택된 것이 없을 때
  const isConfirmDisabled = !isFixedMode && totalCount > 0 && selectedCount === 0;

  // 확정 버튼 텍스트
  const confirmButtonText = isFixedMode
    ? '역할 확정'
    : totalCount > 0 && selectedCount < totalCount
      ? `${selectedCount}개 확정`
      : '확정';

  return (
    <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
      {/* 거절 버튼 */}
      <Pressable
        onPress={onReject}
        className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
      >
        <XMarkIcon size={16} color="#EF4444" />
        <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">거절</Text>
      </Pressable>

      {/* 확정 버튼 */}
      <Pressable
        onPress={onConfirm}
        disabled={isConfirmDisabled}
        className={`flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-70 ${
          isConfirmDisabled ? 'bg-gray-300 dark:bg-surface-elevated' : 'bg-primary-500'
        }`}
      >
        <CheckIcon size={16} color="#fff" />
        <Text className="ml-1 text-sm font-medium text-white">{confirmButtonText}</Text>
      </Pressable>
    </View>
  );
});

export default AppliedActions;
