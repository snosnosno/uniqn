import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { getAssignmentRoles } from '@/types/assignment';
import { getRoleDisplayName } from '@/types/unified';
import { toDate } from '@/utils/date';
import type { Assignment } from '@/types';
import { BriefcaseIcon, CalendarIcon, ClockIcon } from '../../icons';

export interface ApplicantProfileAssignmentsProps {
  assignments: Assignment[];
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const formatDate = (dateStr?: string): string => {
  if (!dateStr) {
    return '';
  }

  const date = toDate(dateStr);
  if (!date) {
    return dateStr;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];

  return `${year}.${month}.${day}(${weekday})`;
};

export const ApplicantProfileAssignments = React.memo(function ApplicantProfileAssignments({
  assignments,
}: ApplicantProfileAssignmentsProps) {
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, { timeSlot: string; roles: string[] }[]> = {};

    for (const assignment of assignments) {
      const roles = getAssignmentRoles(assignment).map((role) =>
        getRoleDisplayName(role, undefined)
      );

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
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, slots]) => ({
        date,
        formattedDate: formatDate(date),
        slots,
      }));
  }, [assignments]);

  if (groupedByDate.length === 0) {
    return null;
  }

  return (
    <View className="px-4 pb-4">
      <View className="rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
        <Text className="mb-2 text-sm font-medium text-secondary-900 dark:text-off-white">
          지원 일정
        </Text>
        {groupedByDate.map((item, index) => (
          <View key={index} className="mb-2 last:mb-0">
            <View className="mb-1 flex-row items-center">
              <CalendarIcon size={14} color="#B8962E" />
              <Text className="ml-2 text-sm font-medium text-primary-700 dark:text-primary-300">
                {item.formattedDate}
              </Text>
            </View>

            {item.slots.map((slot, slotIndex) => (
              <View key={slotIndex} className="mb-1 ml-6 flex-row items-center">
                <ClockIcon size={12} color="#9A9078" />
                <Text className="ml-1 text-sm text-secondary-600 dark:text-secondary-400">
                  {slot.timeSlot}
                </Text>
                <View className="ml-2">
                  <BriefcaseIcon size={12} color="#9A9078" />
                </View>
                <Text className="ml-1 text-sm text-secondary-600 dark:text-secondary-400">
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
