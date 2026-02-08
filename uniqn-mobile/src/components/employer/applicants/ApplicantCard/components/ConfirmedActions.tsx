/**
 * UNIQN Mobile - 확정 상태 액션 버튼
 *
 * @description 확정 취소, 스태프 변환 버튼
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { XMarkIcon, UserPlusIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmedActionsProps {
  /** 확정 취소 핸들러 (없으면 버튼 숨김) */
  onCancelConfirmation?: () => void;
  /** 스태프 변환 핸들러 (없으면 버튼 숨김) */
  onConvertToStaff?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ConfirmedActions = React.memo(function ConfirmedActions({
  onCancelConfirmation,
  onConvertToStaff,
}: ConfirmedActionsProps) {
  // 둘 다 없으면 렌더링 안 함
  if (!onCancelConfirmation && !onConvertToStaff) {
    return null;
  }

  return (
    <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
      {/* 확정 취소 버튼 */}
      {onCancelConfirmation && (
        <Pressable
          onPress={onCancelConfirmation}
          className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
        >
          <XMarkIcon size={16} color="#EF4444" />
          <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
            확정 취소
          </Text>
        </Pressable>
      )}

      {/* 스태프 변환 버튼 */}
      {onConvertToStaff && (
        <Pressable
          onPress={onConvertToStaff}
          className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
        >
          <UserPlusIcon size={16} color="#fff" />
          <Text className="ml-1 text-sm font-medium text-white">스태프 변환</Text>
        </Pressable>
      )}
    </View>
  );
});

export default ConfirmedActions;
