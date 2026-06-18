import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { XMarkIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

export interface ConfirmedActionsProps {
  onCancelConfirmation?: () => void;
}

export const ConfirmedActions = React.memo(function ConfirmedActions({
  onCancelConfirmation,
}: ConfirmedActionsProps) {
  // impeccable v2 §17 — 확정 취소는 결정적 순간이므로 Medium 햅틱 1회.
  // 200ms throttle 로 중복 탭 보호됨. await 로 햅틱 선행 → 상태 변경은 그 다음.
  const handleCancelConfirmation = useCallback(async () => {
    if (!onCancelConfirmation) return;
    await triggerHaptic('medium');
    onCancelConfirmation();
  }, [onCancelConfirmation]);

  if (!onCancelConfirmation) {
    return null;
  }

  return (
    <View className="mt-3 flex-row border-t border-secondary-100 pt-3 dark:border-surface-overlay">
      <Pressable
        onPress={handleCancelConfirmation}
        accessibilityRole="button"
        accessibilityLabel="확정 해제"
        accessibilityHint="확정을 해제하고 점유된 자리를 다시 비웁니다"
        className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
      >
        <XMarkIcon size={16} color={STATUS_COLORS.error} />
        <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
          확정 해제
        </Text>
      </Pressable>
    </View>
  );
});

export default ConfirmedActions;
