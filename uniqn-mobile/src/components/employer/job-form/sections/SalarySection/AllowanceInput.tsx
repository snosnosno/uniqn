/**
 * UNIQN Mobile - 수당 입력 컴포넌트
 *
 * @description 식비, 교통비, 숙박비 등 수당 입력 UI
 */

import React, { memo } from 'react';
import { View, Text, Switch, TextInput } from 'react-native';
import { Card } from '@/components';
import { GiftIcon } from '@/components/icons';
import { PROVIDED_FLAG } from '@/utils/settlement';
import { formatCurrency } from '@/utils/salary';
import { ALLOWANCE_TYPES } from './constants';
import type { AllowanceInputProps } from './types';

/**
 * 수당 입력 컴포넌트
 *
 * @example
 * <AllowanceInput
 *   allowances={data.allowances}
 *   onGuaranteedHoursChange={handleGuaranteedHoursChange}
 *   onAllowanceChange={handleAllowanceChange}
 *   onAllowanceProvidedToggle={handleAllowanceProvidedToggle}
 * />
 */
export const AllowanceInput = memo(function AllowanceInput({
  allowances,
  onGuaranteedHoursChange,
  onAllowanceChange,
  onAllowanceProvidedToggle,
}: AllowanceInputProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-3">
        <GiftIcon size={20} color="#6B7280" />
        <Text className="ml-2 font-semibold text-gray-900 dark:text-white">
          추가 수당 (선택)
        </Text>
      </View>

      <Card variant="outlined" padding="md">
        {/* 보장시간 */}
        <View className="pb-3 mb-3 border-b border-gray-100 dark:border-surface-overlay">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Text className="text-xl mr-2">⏰</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
                보장시간
              </Text>
            </View>
            <View className="flex-row items-center">
              <TextInput
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={allowances?.guaranteedHours ? String(allowances.guaranteedHours) : ''}
                onChangeText={onGuaranteedHoursChange}
                keyboardType="numeric"
                className="w-16 py-2 px-2 text-right text-sm rounded-md bg-gray-50 dark:bg-surface text-gray-900 dark:text-white"
              />
              <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                시간
              </Text>
            </View>
          </View>
        </View>

        {ALLOWANCE_TYPES.map((allowance, index) => {
          const value =
            allowances?.[allowance.key as keyof typeof allowances];
          const isProvided = value === PROVIDED_FLAG;
          const displayLabel = isProvided ? allowance.providedLabel : allowance.label;

          return (
            <View
              key={allowance.key}
              className={`${
                index < ALLOWANCE_TYPES.length - 1
                  ? 'pb-3 mb-3 border-b border-gray-100 dark:border-surface-overlay'
                  : ''
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Text className="text-xl mr-2">{allowance.icon}</Text>
                  <Text className={`text-sm ${
                    isProvided
                      ? 'text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {displayLabel}
                  </Text>
                </View>

                {/* 제공 토글 */}
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                    제공
                  </Text>
                  <Switch
                    value={isProvided}
                    onValueChange={(v) => onAllowanceProvidedToggle(allowance.key, v)}
                    trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                    thumbColor={isProvided ? '#4F46E5' : '#F3F4F6'}
                  />
                </View>
              </View>

              {/* 금액 입력 (제공이 아닐 때만) */}
              {!isProvided && (
                <View className="flex-row items-center justify-end mt-2">
                  <Text className="text-gray-500 dark:text-gray-400 text-sm mr-2">
                    ₩
                  </Text>
                  <TextInput
                    placeholder={allowance.placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value && value > 0 ? formatCurrency(value) : ''}
                    onChangeText={(v) => onAllowanceChange(allowance.key, v)}
                    keyboardType="numeric"
                    className="w-32 py-2 px-2 text-right text-sm rounded-md bg-gray-50 dark:bg-surface text-gray-900 dark:text-white"
                  />
                  <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                    원
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
});
