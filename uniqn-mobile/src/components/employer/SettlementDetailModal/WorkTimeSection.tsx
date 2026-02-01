/**
 * UNIQN Mobile - 근무 시간 섹션 컴포넌트
 *
 * @description 출근/퇴근/근무 시간 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { ClockIcon } from '../../icons';
import { formatTime } from '@/utils/dateUtils';
import { formatDuration } from '@/utils/settlement';

export interface WorkTimeSectionProps {
  /** 출근 시간 */
  startTime: Date | null;
  /** 퇴근 시간 */
  endTime: Date | null;
  /** 근무 시간 (시간 단위) */
  hoursWorked?: number;
}

/**
 * 근무 시간 섹션
 *
 * @example
 * <WorkTimeSection
 *   startTime={new Date('2024-01-15T09:00:00')}
 *   endTime={new Date('2024-01-15T18:00:00')}
 *   hoursWorked={9}
 * />
 */
export function WorkTimeSection({ startTime, endTime, hoursWorked }: WorkTimeSectionProps) {
  const hasValidTimes = startTime && endTime;

  return (
    <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
      <View className="flex-row items-center mb-3">
        <ClockIcon size={18} color="#6B7280" />
        <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
          근무 시간
        </Text>
      </View>

      {hasValidTimes ? (
        <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-surface rounded-lg">
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">출근</Text>
            <Text className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatTime(startTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-surface" />
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">퇴근</Text>
            <Text className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatTime(endTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-gray-200 dark:bg-surface" />
          <View className="items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">근무</Text>
            <Text className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {hoursWorked !== undefined ? formatDuration(hoursWorked) : '-'}
            </Text>
          </View>
        </View>
      ) : (
        <View className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
            출퇴근 기록이 완료되지 않았습니다
          </Text>
        </View>
      )}
    </View>
  );
}
