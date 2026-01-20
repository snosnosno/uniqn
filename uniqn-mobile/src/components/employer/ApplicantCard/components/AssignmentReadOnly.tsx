/**
 * UNIQN Mobile - 일정 읽기 전용 표시 컴포넌트
 *
 * @description 확정/거절 상태에서 일정 목록 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

import { CalendarIcon, BriefcaseIcon } from '@/components/icons';

import type { AssignmentDisplay, IconColors } from '../types';
import { createAssignmentKey, formatAppliedDate } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentReadOnlyProps {
  /** 일정 표시 데이터 */
  assignmentDisplays: AssignmentDisplay[];
  /** 다크모드 여부 */
  isDark: boolean;
  /** 아이콘 색상 */
  iconColors: IconColors;
  /** 레거시 지원일 (assignments가 없을 때) */
  appliedDate?: string;
  /** 레거시 시간대 (assignments가 없을 때) */
  appliedTimeSlot?: string;
}

// ============================================================================
// Component
// ============================================================================

export const AssignmentReadOnly = React.memo(function AssignmentReadOnly({
  assignmentDisplays,
  isDark,
  iconColors,
  appliedDate,
  appliedTimeSlot,
}: AssignmentReadOnlyProps) {
  // 새 포맷 일정 표시
  if (assignmentDisplays.length > 0) {
    return (
      <View className="gap-1.5 mb-3">
        {assignmentDisplays.map((display) => {
          const key = createAssignmentKey(display.date, display.timeSlot, display.role);
          return (
            <View
              key={key}
              className={`flex-row items-center rounded-lg px-3 py-2 border ${
                isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
              }`}
            >
              <CalendarIcon size={16} color={iconColors.unchecked} />
              <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {display.formattedDate} {display.timeSlotDisplay}
              </Text>
              <View className={`mx-2 h-4 w-px ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} />
              <BriefcaseIcon size={16} color={iconColors.unchecked} />
              <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {display.roleLabel}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  // 레거시 포맷 (assignments가 없을 때)
  if (appliedDate || appliedTimeSlot) {
    return (
      <View className={`flex-row items-center rounded-lg px-3 py-2 self-start mb-3 border ${
        isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
      }`}>
        <CalendarIcon size={16} color={iconColors.unchecked} />
        <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {formatAppliedDate(appliedDate)}
          {appliedTimeSlot && ` ${appliedTimeSlot}`}
        </Text>
      </View>
    );
  }

  return null;
});

export default AssignmentReadOnly;
