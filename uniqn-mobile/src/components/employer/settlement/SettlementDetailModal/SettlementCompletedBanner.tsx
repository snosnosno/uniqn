/**
 * UNIQN Mobile - 정산 완료 배너 컴포넌트
 *
 * @description 정산 완료 상태 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircleIcon } from '../../../icons';
import { formatDate } from '@/utils/date';
import { parseTimestamp } from '@/utils/settlement';

export interface SettlementCompletedBannerProps {
  /** 정산 완료 날짜 (Timestamp 또는 Date) */
  payrollDate?: unknown;
}

/**
 * 정산 완료 배너
 *
 * @example
 * <SettlementCompletedBanner payrollDate={workLog.payrollDate} />
 */
export function SettlementCompletedBanner({ payrollDate }: SettlementCompletedBannerProps) {
  const parsedDate = parseTimestamp(payrollDate);

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircleIcon size={20} color="#10B981" />
        <Text className="ml-2 text-base font-medium text-green-600 dark:text-green-400">
          {parsedDate ? `${formatDate(parsedDate)} 정산 완료` : '정산 완료'}
        </Text>
      </View>
    </View>
  );
}
