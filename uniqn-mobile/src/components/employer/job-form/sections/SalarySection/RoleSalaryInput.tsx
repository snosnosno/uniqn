/**
 * UNIQN Mobile - 역할별 급여 입력 컴포넌트
 *
 * @description 개별 역할의 급여 타입/금액 입력 UI
 */

import React, { memo } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { RoleResolver } from '@/shared/role';
import { formatCurrency } from '@/utils/salary';
import { SALARY_TYPES } from './constants';
import type { RoleSalaryInputProps } from './types';

// 역할 변환은 RoleResolver 사용
const getRoleDisplayName = RoleResolver.toDisplayName.bind(RoleResolver);

/**
 * 역할별 급여 입력 컴포넌트
 *
 * @example
 * <RoleSalaryInput
 *   role={role}
 *   index={0}
 *   isReadOnly={false}
 *   onSalaryTypeChange={handleTypeChange}
 *   onSalaryAmountChange={handleAmountChange}
 * />
 */
export const RoleSalaryInput = memo(function RoleSalaryInput({
  role,
  index,
  isReadOnly,
  onSalaryTypeChange,
  onSalaryAmountChange,
}: RoleSalaryInputProps) {
  const roleSalary = role.salary;
  const roleType = roleSalary?.type || 'hourly';
  const isOther = roleType === 'other';
  const displayName = getRoleDisplayName(role.name);

  return (
    <View
      className={`mb-3 p-3 border rounded-lg ${
        isReadOnly
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* 역할명 + 인원 */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-medium text-gray-900 dark:text-white text-sm">
          {displayName}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {role.count}명
        </Text>
      </View>

      {/* 급여 타입 선택 */}
      <View className="flex-row gap-1 mb-2">
        {SALARY_TYPES.map((type) => {
          const isSelected = roleType === type.value;
          return (
            <Pressable
              key={type.value}
              onPress={() => !isReadOnly && onSalaryTypeChange(index, type.value)}
              disabled={isReadOnly}
              className={`flex-1 py-1.5 rounded-md ${
                isSelected
                  ? 'bg-primary-500'
                  : isReadOnly
                    ? 'bg-gray-100 dark:bg-gray-700/50'
                    : 'bg-gray-100 dark:bg-gray-700'
              }`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: isReadOnly }}
            >
              <Text
                className={`text-center text-xs font-medium ${
                  isSelected
                    ? 'text-white'
                    : isReadOnly
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 금액 입력 (협의가 아닐 때만) */}
      {!isOther && (
        <View className="flex-row items-center justify-end">
          <Text className="text-gray-500 dark:text-gray-400 text-sm mr-2">
            ₩
          </Text>
          <TextInput
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            value={
              roleSalary?.amount && roleSalary.amount > 0
                ? formatCurrency(roleSalary.amount)
                : ''
            }
            onChangeText={(v) => onSalaryAmountChange(index, v)}
            keyboardType="numeric"
            editable={!isReadOnly}
            className={`w-32 py-2 px-2 text-right text-sm rounded-md ${
              isReadOnly
                ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-400'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          />
          <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
            원
          </Text>
        </View>
      )}

      {/* 협의 선택 시 안내 */}
      {isOther && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          급여는 개별 협의로 진행됩니다
        </Text>
      )}

      {/* 전체 동일 모드 안내 */}
      {isReadOnly && (
        <Text className="text-xs text-primary-500 dark:text-primary-400 mt-1">
          첫 번째 역할과 동일하게 적용됩니다
        </Text>
      )}
    </View>
  );
});
