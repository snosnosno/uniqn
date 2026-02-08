/**
 * UNIQN Mobile - 지원자 배정 일정 표시
 *
 * @description 지원자의 날짜별 배정 일정 (시간대, 역할)을 그룹화하여 표시
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { CalendarIcon, ClockIcon, BriefcaseIcon } from '../../icons';
import { getAssignmentRoles } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import type { Assignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantProfileAssignmentsProps {
  assignments: Assignment[];
}

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}.${month}.${day}(${dayOfWeek})`;
};

// ============================================================================
// Component
// ============================================================================

export const ApplicantProfileAssignments = React.memo(function ApplicantProfileAssignments({
  assignments,
}: ApplicantProfileAssignmentsProps) {
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, { timeSlot: string; roles: string[] }[]> = {};

    for (const assignment of assignments) {
      const roles = getAssignmentRoles(assignment).map((r) => getRoleDisplayName(r, undefined));

      for (const date of assignment.dates) {
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push({
          timeSlot: assignment.timeSlot,
          roles,
        });
      }
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => ({
        date,
        formattedDate: formatDate(date),
        slots,
      }));
  }, [assignments]);

  if (groupedByDate.length === 0) return null;

  return (
    <View className="px-4 pb-4">
      <View className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
        <Text className="text-sm font-medium text-gray-900 dark:text-white mb-2">지원 일정</Text>
        {groupedByDate.map((item, idx) => (
          <View key={idx} className="mb-2 last:mb-0">
            <View className="flex-row items-center mb-1">
              <CalendarIcon size={14} color="#9333EA" />
              <Text className="ml-2 text-sm font-medium text-primary-700 dark:text-primary-300">
                {item.formattedDate}
              </Text>
            </View>
            {item.slots.map((slot, slotIdx) => (
              <View key={slotIdx} className="ml-6 flex-row items-center mb-1">
                <ClockIcon size={12} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                  {slot.timeSlot}
                </Text>
                <View className="ml-2">
                  <BriefcaseIcon size={12} color="#6B7280" />
                </View>
                <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                  {slot.roles.join(', ')}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

export default ApplicantProfileAssignments;
