/**
 * UNIQN Mobile - 근무 시간 섹션 컴포넌트
 *
 * @description 출근/퇴근/근무 시간 표시
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text } from 'react-native';
import { ClockIcon } from '../../../icons';
import { formatTime } from '@/utils/date';
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
  const isOvernight = hasValidTimes && endTime.toDateString() !== startTime.toDateString();

  return (
    <View className="px-4 py-4 border-b border-secondary-100 dark:border-surface-overlay">
      <View className="flex-row items-center mb-3">
        <ClockIcon size={18} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
          근무 시간
        </Text>
      </View>

      {hasValidTimes ? (
        <View className="flex-row items-center justify-between p-3 bg-surface-page dark:bg-surface rounded-lg">
          <View className="items-center">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
              출근
            </Text>
            <Text className="text-lg font-display-semibold text-success-600 dark:text-success-400">
              {formatTime(startTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-secondary-200 dark:bg-surface" />
          <View className="items-center">
            <View className="flex-row items-center mb-1 gap-1">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                퇴근
              </Text>
              {isOvernight ? (
                <View className="rounded bg-info-100 px-1.5 py-0.5 dark:bg-info-900/30">
                  <Text className="text-[10px] text-info-700 dark:text-info-300 font-sans-semibold">
                    익일
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
              {formatTime(endTime)}
            </Text>
          </View>
          <View className="h-0.5 flex-1 mx-4 bg-secondary-200 dark:bg-surface" />
          <View className="items-center">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
              근무
            </Text>
            <Text className="text-lg font-display-semibold text-primary-600 dark:text-primary-400">
              {hoursWorked !== undefined ? formatDuration(hoursWorked) : '-'}
            </Text>
          </View>
        </View>
      ) : (
        <View className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
          <Text className="text-sm text-warning-700 dark:text-warning-300 text-center font-sans">
            출퇴근 기록이 완료되지 않았습니다
          </Text>
        </View>
      )}
    </View>
  );
}
