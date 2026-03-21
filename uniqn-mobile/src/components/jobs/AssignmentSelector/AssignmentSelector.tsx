import React, { memo, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { createPostingLegacyDateRequirements } from '@/domains/job-posting';
import { useJobSchedule } from '@/hooks';
import type { Assignment } from '@/types';
import { createSimpleAssignment, FIXED_DATE_MARKER, FIXED_TIME_MARKER } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import {
  makeSelectionKey,
  groupDatedSchedules,
  type SelectionKey,
  type ScheduleGroup,
} from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import { DateSelection } from './DateSelection';
import { DateGroupSelection } from './DateGroupSelection';
import type { AssignmentSelectorProps, TimeOptions } from './types';
import { getEffectiveRoleId, getRoleCheckboxKey } from './utils';

export type { AssignmentSelectorProps } from './types';

export const AssignmentSelector = memo(function AssignmentSelector({
  jobPosting,
  selectedAssignments,
  onSelectionChange,
  maxSelections,
  disabled = false,
  error,
}: AssignmentSelectorProps) {
  const { datedSchedules, isFixed, fixedSchedule } = useJobSchedule(jobPosting);

  const selectedKeys = useMemo(() => {
    const keys = new Set<SelectionKey>();

    selectedAssignments.forEach((assignment) => {
      assignment.dates.forEach((date) => {
        const key = makeSelectionKey(date, assignment.timeSlot, assignment.roleIds[0] ?? '');
        keys.add(key);
      });
    });

    return keys;
  }, [selectedAssignments]);

  const handleRoleToggle = useCallback(
    (date: string, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const selectionKey = makeSelectionKey(date, slotTime, role);
      const isSelected = selectedKeys.has(selectionKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        newAssignments = selectedAssignments.filter((assignment) => {
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

        const newAssignment = createSimpleAssignment(role, slotTime, date, {
          isTimeToBeAnnounced: timeOptions?.isTimeToBeAnnounced,
          tentativeDescription: timeOptions?.tentativeDescription,
        });

        newAssignments = [...selectedAssignments, newAssignment];
      }

      onSelectionChange(newAssignments);
    },
    [selectedKeys, selectedAssignments, maxSelections, onSelectionChange]
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

  const isTournament = jobPosting.postingType === 'tournament';
  const groupedRequirements = useMemo(
    () => createPostingLegacyDateRequirements(jobPosting),
    [jobPosting]
  );

  const scheduleGroups = useMemo(() => {
    return groupDatedSchedules(datedSchedules, groupedRequirements, jobPosting.postingType);
  }, [datedSchedules, groupedRequirements, jobPosting.postingType]);

  const handleGroupRoleToggle = useCallback(
    (group: ScheduleGroup, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const firstKey = makeSelectionKey(group.startDate, slotTime, role);
      const isSelected = selectedKeys.has(firstKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        const groupDates = new Set(group.dates.map((date) => date.date));
        newAssignments = selectedAssignments.filter((assignment) => {
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

        const groupAssignments = group.dates.map((schedule) =>
          createSimpleAssignment(role, slotTime, schedule.date, {
            isTimeToBeAnnounced: timeOptions?.isTimeToBeAnnounced,
            tentativeDescription: timeOptions?.tentativeDescription,
          })
        );

        newAssignments = [...selectedAssignments, ...groupAssignments];
      }

      onSelectionChange(newAssignments);
    },
    [selectedKeys, selectedAssignments, maxSelections, onSelectionChange]
  );

  if (isFixed && fixedSchedule) {
    return (
      <View className="bg-white dark:bg-surface rounded-xl p-4">
        <View className="mb-3">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            역할 선택 <Text className="text-error-500">*</Text>
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            원하는 역할을 선택해 주세요
            {maxSelections ? ` (최대 ${maxSelections}개)` : ''}
          </Text>
        </View>

        <View className="flex-row flex-wrap">
          {fixedSchedule.roles.map((role, index) => {
            const effectiveRoleId = getEffectiveRoleId(role);
            const selectionKey = makeSelectionKey(
              FIXED_DATE_MARKER,
              FIXED_TIME_MARKER,
              effectiveRoleId
            );
            const isSelected = selectedKeys.has(selectionKey);

            return (
              <RoleCheckbox
                key={getRoleCheckboxKey(role, index)}
                role={role}
                isSelected={isSelected}
                onToggle={() =>
                  handleRoleToggle(FIXED_DATE_MARKER, FIXED_TIME_MARKER, effectiveRoleId)
                }
                disabled={disabled}
              />
            );
          })}
        </View>

        {selectedAssignments.length > 0 && (
          <View className="mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
            <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              선택됨: {selectionSummary}
            </Text>
          </View>
        )}

        {error && <Text className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</Text>}
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4">
      <View className="mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          날짜 및 역할 선택 <Text className="text-error-500">*</Text>
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          원하는 시간대와 역할을 선택해 주세요
          {maxSelections ? ` (최대 ${maxSelections}개)` : ''}
        </Text>
      </View>

      <View>
        {isTournament
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

      {selectedAssignments.length > 0 && (
        <View className="mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
            선택됨: {selectionSummary}
          </Text>
        </View>
      )}

      {error && <Text className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</Text>}
    </View>
  );
});

export default AssignmentSelector;
