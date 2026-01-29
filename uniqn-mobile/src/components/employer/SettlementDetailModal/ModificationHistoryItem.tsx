/**
 * UNIQN Mobile - 수정 이력 아이템 컴포넌트
 *
 * @description 시간/금액 수정 이력의 개별 아이템 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { parseTimestamp } from '@/utils/settlement';
import type { ModificationHistoryItemProps } from './types';

/**
 * 시간 변경 내용 포맷팅
 * @returns "출근시간 미정 → 11:00" 형식의 문자열 또는 null
 */
function formatTimeChange(
  prevValue: unknown,
  newValue: unknown,
  label: string
): string | null {
  // 둘 다 undefined면 변경 없음
  if (prevValue === undefined && newValue === undefined) {
    return null;
  }

  const prevTime = parseTimestamp(prevValue);
  const newTime = parseTimestamp(newValue);

  const prevStr = prevTime ? formatTime(prevTime) : '미정';
  const newStr = newTime ? formatTime(newTime) : '미정';

  // 같은 값이면 표시 안 함
  if (prevStr === newStr) {
    return null;
  }

  return `${label} ${prevStr} → ${newStr}`;
}

/**
 * 수정 이력 아이템 컴포넌트
 *
 * @example
 * <ModificationHistoryItem
 *   modification={{ modifiedAt: timestamp, reason: '출근 시간 수정' }}
 *   index={0}
 * />
 */
export function ModificationHistoryItem({ modification, index }: ModificationHistoryItemProps) {
  const modifiedAt = parseTimestamp(modification.modifiedAt);

  // 상세 변경 내용
  const startTimeChange = formatTimeChange(
    modification.previousStartTime,
    modification.newStartTime,
    '출근시간'
  );
  const endTimeChange = formatTimeChange(
    modification.previousEndTime,
    modification.newEndTime,
    '퇴근시간'
  );

  return (
    <View className="flex-row items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <View className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm text-gray-900 dark:text-white">
          {modification.reason || '시간 수정'}
        </Text>
        {modifiedAt && (
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(modifiedAt)} {formatTime(modifiedAt)}
          </Text>
        )}
        {/* 상세 변경 내용 표시 */}
        {(startTimeChange || endTimeChange) && (
          <View className="mt-1.5 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1.5">
            {startTimeChange && (
              <Text className="text-xs text-gray-600 dark:text-gray-300">
                • {startTimeChange}
              </Text>
            )}
            {endTimeChange && (
              <Text className="text-xs text-gray-600 dark:text-gray-300">
                • {endTimeChange}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
