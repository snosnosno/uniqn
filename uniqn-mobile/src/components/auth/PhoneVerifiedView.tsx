/**
 * UNIQN Mobile - 전화번호 인증 완료 상태 뷰
 *
 * @description PhoneVerification의 'verified' 단계 렌더링
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { CheckCircleIcon } from '@/components/icons';

interface PhoneVerifiedViewProps {
  /** 인증된 전화번호 (표시용) */
  phone: string;
  /** 컴팩트 모드 (헤더/아이콘 숨김) */
  compact: boolean;
}

export const PhoneVerifiedView: React.FC<PhoneVerifiedViewProps> = React.memo(
  ({ phone, compact }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
      <View className="w-full">
        {!compact && (
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-sm items-center justify-center mb-3">
              <CheckCircleIcon size={32} color="#22c55e" />
            </View>
            <Text className="text-xl font-bold text-secondary-900 dark:text-white">
              문자인증 완료
            </Text>
          </View>
        )}

        <View
          className="rounded-md p-4 border"
          style={{
            backgroundColor: isDark ? '#1f2937' : '#f0fdf4',
            borderColor: isDark ? '#166534' : '#bbf7d0',
          }}
        >
          <View className="flex-row items-center mb-3">
            <CheckCircleIcon size={20} color="#22c55e" />
            <Text className="ml-2 text-success-700 dark:text-success-400 font-semibold">
              인증 완료
            </Text>
          </View>
          <View
            className="rounded-lg p-3"
            style={{ backgroundColor: isDark ? '#374151' : '#ffffff' }}
          >
            <View className="flex-row justify-between">
              <Text className="text-secondary-500 dark:text-secondary-400 text-sm">휴대폰</Text>
              <Text className="text-secondary-900 dark:text-white font-medium">{phone}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

PhoneVerifiedView.displayName = 'PhoneVerifiedView';
