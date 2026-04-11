import React, { memo, useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { buildPostingFacts, createPostingLegacyDateRequirements } from '@/domains/job-posting';
import { useJobSchedule } from '@/hooks';
import type { Assignment } from '@/types';
import { TBA_TIME_MARKER, createSimpleAssignment } from '@/types/assignment';
import type { TimeSlotInfo } from '@/types/unified';
import { getRoleDisplayName } from '@/types/unified';
import {
  groupDatedSchedules,
  makeSelectionKey,
  type ScheduleGroup,
  type SelectionKey,
} from '@/utils/assignment';
import { DateGroupSelection } from './DateGroupSelection';
import { DateSelection } from './DateSelection';
import type { AssignmentSelectorProps, TimeOptions } from './types';
import { getEffectiveRoleId } from './utils';

export type { AssignmentSelectorProps } from './types';

function getSlotSelectionTime(slot: TimeSlotInfo): string {
  return slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : (slot.startTime ?? '');
}

function matchesGroupedSelection(slot: TimeSlotInfo, slotTime: string, role: string): boolean {
  if (getSlotSelectionTime(slot) !== slotTime) {
    return false;
  }

  return slot.roles.some((slotRole) => getEffectiveRoleId(slotRole) === role);
}

function resolveGroupedAssignmentGroupId(
  schedule: ScheduleGroup['dates'][number],
  slotTime: string,
  role: string
): string | undefined {
  return schedule.timeSlots.find((slot) => matchesGroupedSelection(slot, slotTime, role))?.id;
}

export const AssignmentSelector = memo(function AssignmentSelector({
  jobPosting,
  selectedAssignments,
  onSelectionChange,
  maxSelections,
  disabled = false,
  error,
}: AssignmentSelectorProps) {
  const { datedSchedules, isFixed } = useJobSchedule(jobPosting);
  const postingFacts = useMemo(() => buildPostingFacts(jobPosting), [jobPosting]);

  const selectedKeys = useMemo(() => {
    const keys = new Set<SelectionKey>();

    selectedAssignments.forEach((assignment) => {
      assignment.dates.forEach((date) => {
        keys.add(makeSelectionKey(date, assignment.timeSlot, assignment.roleIds[0] ?? ''));
      });
    });

    return keys;
  }, [selectedAssignments]);

  const handleRoleToggle = useCallback(
    (date: string, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const selectionKey = makeSelectionKey(date, slotTime, role);
      const isSelected = selectedKeys.has(selectionKey);

      let nextAssignments: Assignment[];

      if (isSelected) {
        nextAssignments = selectedAssignments.filter((assignment) => {
          const assignmentKey = makeSelectionKey(
            assignment.dates[0] ?? '',
            assignment.timeSlot,
            assignment.roleIds[0] ?? ''
          );
          return assignmentKey !== selectionKey;
        });
      } else {
        if (maxSelections && selectedAssignments.length >= maxSelections) {
          return;
        }

        nextAssignments = [
          ...selectedAssignments,
          createSimpleAssignment(role, slotTime, date, {
            groupId: timeOptions?.assignmentGroupId,
            isTimeToBeAnnounced: timeOptions?.isTimeToBeAnnounced,
            tentativeDescription: timeOptions?.tentativeDescription,
          }),
        ];
      }

      onSelectionChange(nextAssignments);
    },
    [maxSelections, onSelectionChange, selectedAssignments, selectedKeys]
  );

  const handleGroupRoleToggle = useCallback(
    (group: ScheduleGroup, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const firstKey = makeSelectionKey(group.startDate, slotTime, role);
      const isSelected = selectedKeys.has(firstKey);

      let nextAssignments: Assignment[];

      if (isSelected) {
        const groupDates = new Set(group.dates.map((item) => item.date));
        nextAssignments = selectedAssignments.filter((assignment) => {
          const assignmentDate = assignment.dates[0] ?? '';
          const assignmentRole = assignment.roleIds[0] ?? '';
          const isInGroup = groupDates.has(assignmentDate);
          const isSameRole = assignmentRole === role && assignment.timeSlot === slotTime;

          return !(isInGroup && isSameRole);
        });
      } else {
        const newCount = group.dates.length;
        if (maxSelections && selectedAssignments.length + newCount > maxSelections) {
          return;
        }

        nextAssignments = [
          ...selectedAssignments,
          ...group.dates.map((schedule) =>
            createSimpleAssignment(role, slotTime, schedule.date, {
              groupId: resolveGroupedAssignmentGroupId(schedule, slotTime, role),
              isTimeToBeAnnounced: timeOptions?.isTimeToBeAnnounced,
              tentativeDescription: timeOptions?.tentativeDescription,
            })
          ),
        ];
      }

      onSelectionChange(nextAssignments);
    },
    [maxSelections, onSelectionChange, selectedAssignments, selectedKeys]
  );

  const selectionSummary = useMemo(() => {
    if (selectedAssignments.length === 0) {
      return '';
    }

    const roleCount = new Map<string, number>();
    selectedAssignments.forEach((assignment) => {
      const label = getRoleDisplayName(assignment.roleIds[0] ?? 'unknown');
      roleCount.set(label, (roleCount.get(label) ?? 0) + 1);
    });

    return Array.from(roleCount.entries())
      .map(([role, count]) => `${role} ${count}건`)
      .join(', ');
  }, [selectedAssignments]);

  const groupedRequirements = useMemo(
    () => createPostingLegacyDateRequirements(jobPosting),
    [jobPosting]
  );
  const usesGroupedDateRanges = postingFacts.workflow.usesGroupedDateRanges;
  const scheduleGroups = useMemo(() => {
    return groupDatedSchedules(datedSchedules, groupedRequirements, postingFacts.postingType);
  }, [datedSchedules, groupedRequirements, postingFacts.postingType]);

  if (isFixed) {
    return (
      <View className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30">
        <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
          고정 공고 지원은 현재 비활성화되어 있습니다.
        </Text>
        <Text className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
          날짜 기반 모집 공고만 지원할 수 있습니다.
        </Text>
        {error && <Text className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</Text>}
      </View>
    );
  }

  return (
    <View className="rounded-md bg-white p-4 dark:bg-surface">
      <View className="mb-3">
        <Text className="mb-1 text-base font-semibold text-gray-900 dark:text-white">
          날짜 및 역할 선택 <Text className="text-error-500">*</Text>
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          원하는 시간과 역할을 선택해 주세요
          {maxSelections ? ` (최대 ${maxSelections}개)` : ''}
        </Text>
      </View>

      <View>
        {usesGroupedDateRanges
          ? scheduleGroups.map((group) => (
              <DateGroupSelection
                key={group.id}
                group={group}
                selectedKeys={selectedKeys}
                onGroupRoleToggle={handleGroupRoleToggle}
                disabled={disabled}
              />
            ))
          : datedSchedules.map((schedule, index) => (
              <DateSelection
                key={schedule.date || index}
                date={schedule.date}
                timeSlots={schedule.timeSlots}
                selectedKeys={selectedKeys}
                onRoleToggle={handleRoleToggle}
                disabled={disabled}
              />
            ))}
      </View>

      {selectionSummary ? (
        <View className="mt-4 border-t border-gray-100 pt-4 dark:border-surface-overlay">
          <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
            선택된 {selectionSummary}
          </Text>
        </View>
      ) : null}

      {error && <Text className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</Text>}
    </View>
  );
});

export default AssignmentSelector;
