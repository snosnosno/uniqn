/**
 * UNIQN Mobile - 신규 지원 액션 버튼
 *
 * @description 지원자 확정/거절 버튼
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';

import { CheckIcon, XMarkIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

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

  // impeccable v2 §17 — 결정적 순간 햅틱:
  //  - 확정(긍정) → Medium (성공적 승인 신호)
  //  - 거절(파괴적) → Warning (사용자가 "결과를 되돌릴 수 없음" 을 손끝으로 인지)
  // 200ms throttle 로 중복 탭 보호됨.
  const handleConfirm = useCallback(() => {
    void triggerHaptic('medium');
    onConfirm();
  }, [onConfirm]);

  const handleReject = useCallback(() => {
    void triggerHaptic('warning');
    onReject();
  }, [onReject]);

  return (
    <View className="flex-row mt-3 pt-3 border-t border-secondary-100 dark:border-surface-overlay">
      {/* 거절 버튼 */}
      <Pressable
        onPress={handleReject}
        accessibilityRole="button"
        accessibilityLabel="지원 거절"
        accessibilityHint="지원자를 거절합니다"
        className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
      >
        <XMarkIcon size={16} color={STATUS_COLORS.error} />
        <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
          거절
        </Text>
      </Pressable>

      {/* 확정 버튼 */}
      <Pressable
        onPress={handleConfirm}
        disabled={isConfirmDisabled}
        accessibilityRole="button"
        accessibilityLabel={confirmButtonText}
        accessibilityHint="지원자를 확정합니다"
        accessibilityState={{ disabled: isConfirmDisabled }}
        className={`flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-70 ${
          isConfirmDisabled ? 'bg-secondary-300 dark:bg-surface-elevated' : 'bg-primary-500'
        }`}
      >
        <CheckIcon size={16} color="#fff" />
        <Text className="ml-1 text-sm font-sans-medium text-surface-dark">{confirmButtonText}</Text>
      </Pressable>
    </View>
  );
});

export default AppliedActions;
