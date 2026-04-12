import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { XMarkIcon } from '@/components/icons';

export interface ConfirmedActionsProps {
  onCancelConfirmation?: () => void;
}

export const ConfirmedActions = React.memo(function ConfirmedActions({
  onCancelConfirmation,
}: ConfirmedActionsProps) {
  if (!onCancelConfirmation) {
    return null;
  }

  return (
    <View className="mt-3 flex-row border-t border-secondary-100 pt-3 dark:border-surface-overlay">
      <Pressable
        onPress={onCancelConfirmation}
        className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
      >
        <XMarkIcon size={16} color={STATUS_COLORS.error} />
        <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
          확정 취소
        </Text>
      </Pressable>
    </View>
  );
});

export default ConfirmedActions;
