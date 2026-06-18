import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { getRoleDisplayName, isRoleFilled } from '@/types/unified';
import type { RoleCheckboxProps } from './types';

export const RoleCheckbox = memo(function RoleCheckbox({
  role,
  isSelected,
  onToggle,
  disabled,
}: RoleCheckboxProps) {
  const roleLabel = getRoleDisplayName(role.roleId, role.customName);
  const isFilled = isRoleFilled(role);
  const isDisabled = disabled || isFilled;

  return (
    <Pressable
      onPress={() => !isDisabled && onToggle()}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      className={`mb-1 mr-3 flex-row items-center ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      <View
        className={`mr-2 h-5 w-5 items-center justify-center rounded border-2 ${
          isSelected
            ? 'border-primary-500 bg-primary-500'
            : isFilled
              ? 'border-secondary-300 bg-secondary-200 dark:border-surface-overlay dark:bg-surface'
              : 'border-secondary-300 dark:border-surface-overlay'
        }`}
      >
        {isSelected && <CheckIcon size={12} color="#09090B" />}
      </View>

      <Text
        className={`text-sm font-sans ${
          isFilled
            ? 'text-secondary-400 line-through dark:text-secondary-500'
            : isSelected
              ? 'font-sans-medium text-primary-700 dark:text-primary-300'
              : 'text-secondary-700 dark:text-secondary-300'
        }`}
      >
        {roleLabel}({role.filledCount}/{role.requiredCount})
      </Text>

      {isFilled && (
        <Badge variant="default" size="sm" className="ml-1">
          마감
        </Badge>
      )}
    </Pressable>
  );
});
