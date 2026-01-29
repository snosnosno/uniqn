/**
 * UNIQN Mobile - 역할 체크박스 컴포넌트
 *
 * @description 역할 선택을 위한 체크박스 UI
 */

import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { getRoleDisplayName, isRoleFilled } from '@/types/unified';
import type { RoleCheckboxProps } from './types';

/**
 * 역할 체크박스 컴포넌트
 *
 * @example
 * <RoleCheckbox
 *   role={{ roleId: 'dealer', filledCount: 2, requiredCount: 5 }}
 *   isSelected={true}
 *   onToggle={() => handleToggle()}
 * />
 */
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
      className={`flex-row items-center mr-3 mb-1 ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {/* 체크박스 */}
      <View
        className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : isFilled
            ? 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
      </View>
      {/* 역할 라벨 + 충원 현황 */}
      <Text
        className={`text-sm ${
          isFilled
            ? 'text-gray-400 dark:text-gray-500 line-through'
            : isSelected
            ? 'text-primary-700 dark:text-primary-300 font-medium'
            : 'text-gray-700 dark:text-gray-300'
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
