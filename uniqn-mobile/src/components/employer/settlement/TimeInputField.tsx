/**
 * UNIQN Mobile - 시간 입력 필드 컴포넌트
 *
 * @description WorkTimeEditor 내부에서 출근/퇴근 시간 입력에 사용
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ClockIcon, CheckIcon, ChevronDownIcon } from '../../icons';
import { formatTime } from '@/utils/dateUtils';
import { formatTimeForInput } from './timeEditorUtils';

// ============================================================================
// Types
// ============================================================================

export interface TimeInputFieldProps {
  label: string;
  value: string;
  originalTime?: Date | null;
  iconColor: string;
  /** 미정 여부 */
  isUndefined?: boolean;
  /** 미정 상태 변경 핸들러 */
  onUndefinedChange?: (isUndefined: boolean) => void;
  /** 휠 피커 열기 */
  onOpenPicker: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TimeInputField({
  label,
  value,
  originalTime,
  iconColor,
  isUndefined = false,
  onUndefinedChange,
  onOpenPicker,
}: TimeInputFieldProps) {
  const hasChanged = originalTime && !isUndefined && formatTimeForInput(originalTime) !== value;

  // 표시용 텍스트 (24시 이상이면 다음날 표시)
  const displayText = useMemo(() => {
    if (!value) return '시간 선택';
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value;
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    if (hour >= 24) {
      return `${value} (다음날 ${(hour - 24).toString().padStart(2, '0')}:${minute})`;
    }
    return value;
  }, [value]);

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</Text>
        {/* 미정 체크박스 */}
        {onUndefinedChange && (
          <Pressable
            onPress={() => onUndefinedChange(!isUndefined)}
            className="flex-row items-center"
          >
            <View
              className={`w-5 h-5 rounded border items-center justify-center mr-1.5
                ${
                  isUndefined
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
                }`}
            >
              {isUndefined && <CheckIcon size={14} color="#FFFFFF" />}
            </View>
            <Text className="text-sm text-gray-600 dark:text-gray-400">미정</Text>
          </Pressable>
        )}
      </View>

      {/* 시간 선택 버튼 (휠 피커 트리거) */}
      <Pressable
        onPress={() => !isUndefined && onOpenPicker()}
        disabled={isUndefined}
        className={`flex-row items-center justify-between p-3 border rounded-lg min-h-[52px]
          ${
            isUndefined
              ? 'bg-gray-100 dark:bg-surface-dark border-gray-200 dark:border-surface-overlay'
              : 'bg-white dark:bg-surface border-gray-200 dark:border-surface-overlay active:bg-gray-50 dark:active:bg-gray-700'
          }`}
      >
        <View className="flex-row items-center flex-1">
          <ClockIcon size={20} color={isUndefined ? '#9CA3AF' : iconColor} />
          {isUndefined ? (
            <Text className="ml-2 text-lg font-semibold text-gray-400 dark:text-gray-500">
              미정
            </Text>
          ) : (
            <Text className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
              {displayText}
            </Text>
          )}
        </View>
        {!isUndefined && <ChevronDownIcon size={20} color="#9CA3AF" />}
      </Pressable>

      {hasChanged && originalTime && (
        <Text className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
          원래: {formatTime(originalTime)}
        </Text>
      )}
    </View>
  );
}
