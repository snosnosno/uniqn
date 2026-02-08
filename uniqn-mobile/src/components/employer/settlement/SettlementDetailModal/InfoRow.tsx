/**
 * UNIQN Mobile - 정보 행 컴포넌트
 *
 * @description 라벨-값 형태의 정보 표시 행
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { InfoRowProps } from './types';

/**
 * 정보 행 컴포넌트
 *
 * @example
 * <InfoRow label="기본 급여" value="150,000원" />
 * <InfoRow label="총액" value="200,000원" highlight />
 */
export function InfoRow({ label, value, highlight, valueColor }: InfoRowProps) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-gray-600 dark:text-gray-400">{label}</Text>
      <Text
        className={`text-sm font-medium ${
          highlight
            ? 'text-lg font-bold text-primary-600 dark:text-primary-400'
            : valueColor || 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
