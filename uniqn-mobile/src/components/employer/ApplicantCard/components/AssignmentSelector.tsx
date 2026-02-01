/**
 * UNIQN Mobile - 일정 선택 컴포넌트
 *
 * @description 체크박스로 일정 선택 (지원자 확정 시 사용)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { CheckIcon, CalendarIcon, BriefcaseIcon } from '@/components/icons';

import type { AssignmentDisplay, IconColors } from '../types';
import { createAssignmentKey } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentSelectorProps {
  /** 일정 표시 데이터 */
  assignmentDisplays: AssignmentDisplay[];
  /** 선택된 키 Set */
  selectedKeys: Set<string>;
  /** 선택 개수 */
  selectedCount: number;
  /** 다크모드 여부 */
  isDark: boolean;
  /** 아이콘 색상 */
  iconColors: IconColors;
  /** 토글 핸들러 */
  onToggle: (key: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const AssignmentSelector = React.memo(function AssignmentSelector({
  assignmentDisplays,
  selectedKeys,
  selectedCount,
  isDark,
  iconColors,
  onToggle,
}: AssignmentSelectorProps) {
  if (assignmentDisplays.length === 0) {
    return null;
  }

  return (
    <View className="mb-3">
      {/* 안내 문구 */}
      <View className="flex-row items-center mb-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          같은 날짜에는 하나의 역할/시간만 선택 가능합니다
        </Text>
        <Text className="ml-auto text-xs text-primary-500 dark:text-primary-400 font-medium">
          {selectedCount}개 선택
        </Text>
      </View>

      {/* 일정 목록 */}
      <View className="gap-1.5">
        {assignmentDisplays.map((display) => {
          const key = createAssignmentKey(display.date, display.timeSlot, display.role);
          const isChecked = selectedKeys.has(key);

          const bgClass = isChecked
            ? (isDark ? 'bg-primary-900 border-primary-700' : 'bg-primary-100 border-primary-300')
            : (isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200');

          return (
            <Pressable
              key={key}
              onPress={() => onToggle(key)}
              className={`flex-row items-center rounded-lg px-3 py-2.5 border active:opacity-70 ${bgClass}`}
            >
              {/* 체크박스 */}
              <View className={`
                h-5 w-5 rounded border-2 items-center justify-center mr-3
                ${isChecked
                  ? 'bg-primary-500 border-primary-500'
                  : (isDark ? 'border-gray-500' : 'border-gray-400')}
              `}>
                {isChecked && <CheckIcon size={12} color="#fff" />}
              </View>

              {/* 일정 정보 */}
              <CalendarIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
              <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {display.formattedDate} {display.timeSlotDisplay}
              </Text>
              <View className={`mx-2 h-4 w-px ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} />
              <BriefcaseIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
              <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {display.roleLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export default AssignmentSelector;
