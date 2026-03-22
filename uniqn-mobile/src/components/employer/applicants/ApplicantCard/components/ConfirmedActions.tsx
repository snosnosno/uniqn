import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
    <View className="mt-3 flex-row border-t border-gray-100 pt-3 dark:border-surface-overlay">
      <Pressable
        onPress={onCancelConfirmation}
        className="flex-1 flex-row items-center justify-center rounded-lg bg-gray-100 py-2 active:opacity-70 dark:bg-surface"
      >
        <XMarkIcon size={16} color="#EF4444" />
        <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
          확정 취소
        </Text>
      </Pressable>
    </View>
  );
});

export default ConfirmedActions;
