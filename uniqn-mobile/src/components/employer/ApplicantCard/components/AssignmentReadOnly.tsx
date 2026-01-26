/**
 * UNIQN Mobile - 일정 읽기 전용 표시 컴포넌트
 *
 * @description 확정/거절 상태에서 일정 목록 표시
 * @version 2.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

import { CalendarIcon, BriefcaseIcon } from '@/components/icons';

import type { AssignmentDisplay, IconColors } from '../types';
import { createAssignmentKey } from '../utils';

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
}

// ============================================================================
// Component
// ============================================================================

export const AssignmentReadOnly = React.memo(function AssignmentReadOnly({
  assignmentDisplays,
  isDark,
  iconColors,
}: AssignmentReadOnlyProps) {
  if (assignmentDisplays.length === 0) {
    return null;
  }

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
});

export default AssignmentReadOnly;
