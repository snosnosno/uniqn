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
import { formatNumber } from '@/utils/salary';
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
        <GiftIcon size={20} color="#9A9078" />
        <Text className="ml-2 font-sans-semibold text-secondary-900 dark:text-off-white">
          추가 수당 (선택)
        </Text>
      </View>

      <Card variant="outlined" padding="md">
        {/* 보장시간 */}
        <View className="pb-3 mb-3 border-b border-secondary-100 dark:border-surface-overlay">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Text className="text-xl mr-2 font-sans">{''}</Text>
              <Text className="text-sm text-secondary-900 dark:text-off-white font-sans">
                보장시간
              </Text>
            </View>
            <View className="flex-row items-center">
              <TextInput
                placeholder="0"
                placeholderTextColor="#A89C84"
                value={allowances?.guaranteedHours ? String(allowances.guaranteedHours) : ''}
                onChangeText={onGuaranteedHoursChange}
                keyboardType="numeric"
                className="w-16 py-2 px-2 text-right text-sm font-sans rounded-md bg-secondary-50 dark:bg-surface text-secondary-900 dark:text-off-white"
              />
              <Text className="text-secondary-600 dark:text-secondary-400 ml-2 text-sm font-sans">
                시간
              </Text>
            </View>
          </View>
        </View>

        {ALLOWANCE_TYPES.map((allowance, index) => {
          const value = allowances?.[allowance.key as keyof typeof allowances];
          const isProvided = value === PROVIDED_FLAG;
          const displayLabel = isProvided ? allowance.providedLabel : allowance.label;

          return (
            <View
              key={allowance.key}
              className={`${
                index < ALLOWANCE_TYPES.length - 1
                  ? 'pb-3 mb-3 border-b border-secondary-100 dark:border-surface-overlay'
                  : ''
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Text className="text-xl mr-2 font-sans">{allowance.icon}</Text>
                  <Text
                    className={`text-sm font-sans ${
                      isProvided
                        ? 'text-primary-600 dark:text-primary-400 font-sans-medium'
                        : 'text-secondary-900 dark:text-off-white'
                    }`}
                  >
                    {displayLabel}
                  </Text>
                </View>

                {/* 제공 토글 */}
                <View className="flex-row items-center">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 mr-2 font-sans">
                    제공
                  </Text>
                  <Switch
                    value={isProvided}
                    onValueChange={(v) => onAllowanceProvidedToggle(allowance.key, v)}
                    trackColor={{ false: '#D6D2CA', true: '#D4AF37' }}
                    thumbColor={isProvided ? '#FFFFFF' : '#F5F5F2'}
                  />
                </View>
              </View>

              {/* 금액 입력 (제공이 아닐 때만) */}
              {!isProvided && (
                <View className="flex-row items-center justify-end mt-2">
                  <Text className="text-secondary-500 dark:text-secondary-400 text-sm mr-2 font-sans">
                    ₩
                  </Text>
                  <TextInput
                    placeholder={allowance.placeholder}
                    placeholderTextColor="#A89C84"
                    value={value && value > 0 ? formatNumber(value) : ''}
                    onChangeText={(v) => onAllowanceChange(allowance.key, v)}
                    keyboardType="numeric"
                    className="w-32 py-2 px-2 text-right text-sm font-sans rounded-md bg-secondary-50 dark:bg-surface text-secondary-900 dark:text-off-white"
                  />
                  <Text className="text-secondary-600 dark:text-secondary-400 ml-2 text-sm font-sans">
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
