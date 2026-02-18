/**
 * UNIQN Mobile - Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI (v3.1 - 대회 공고 연속 날짜 그룹화)
 * @version 4.0.0 - 서브컴포넌트 모듈화
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useJobSchedule } from '@/hooks';
import type { Assignment, StaffRole } from '@/types';
import { createSimpleAssignment, FIXED_DATE_MARKER, FIXED_TIME_MARKER } from '@/types';
import { isStaffRole } from '@/types/role';
import { getRoleDisplayName } from '@/types/unified';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import {
  makeSelectionKey,
  groupDatedSchedules,
  type SelectionKey,
  type ScheduleGroup,
} from '@/utils/assignment';

// Sub-components
import { RoleCheckbox } from './RoleCheckbox';
import { DateSelection } from './DateSelection';
import { DateGroupSelection } from './DateGroupSelection';
import type { AssignmentSelectorProps, TimeOptions } from './types';

// Re-export types for backward compatibility
export type { AssignmentSelectorProps } from './types';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Assignment 선택 컴포넌트
 *
 * @description 시간대별 역할 직접 선택 UI (v3.1)
 * useJobSchedule Hook을 사용하여 통합 타입 기반으로 데이터 처리
 * 대회 공고: 연속 날짜 그룹 단위 선택
 *
 * @example
 * <AssignmentSelector
 *   jobPosting={job}
 *   selectedAssignments={assignments}
 *   onSelectionChange={setAssignments}
 * />
 */
export const AssignmentSelector = memo(function AssignmentSelector({
  jobPosting,
  selectedAssignments,
  onSelectionChange,
  maxSelections,
  disabled = false,
  error,
}: AssignmentSelectorProps) {
  // v3.0: useJobSchedule Hook으로 정규화된 데이터 사용
  const { datedSchedules, isFixed, fixedSchedule } = useJobSchedule(jobPosting);

  // 선택된 키 Set (date|slot|role 조합)
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

  // 역할 토글 핸들러
  const handleRoleToggle = useCallback(
    (date: string, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const selectionKey = makeSelectionKey(date, slotTime, role);
      const isSelected = selectedKeys.has(selectionKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제: 해당 조합의 assignment 제거
        newAssignments = selectedAssignments.filter((a) => {
          const aKey = makeSelectionKey(a.dates[0] ?? '', a.timeSlot, a.roleIds[0] ?? '');
          return aKey !== selectionKey;
        });
      } else {
        // 선택: 최대 선택 수 확인 후 추가
        if (maxSelections && selectedAssignments.length >= maxSelections) {
          return;
        }
        // 커스텀 역할이면 'other'로 매핑
        const roleId: StaffRole = isStaffRole(role) ? role : 'other';
        const newAssignment = createSimpleAssignment(roleId, slotTime, date, {
          isTimeToBeAnnounced: timeOptions?.isTimeToBeAnnounced,
          tentativeDescription: timeOptions?.tentativeDescription,
        });
        newAssignments = [...selectedAssignments, newAssignment];
      }

      onSelectionChange(newAssignments);
    },
    [selectedKeys, selectedAssignments, maxSelections, onSelectionChange]
  );

  // 선택된 역할 요약
  const selectionSummary = useMemo(() => {
    if (selectedAssignments.length === 0) return '';

    const roleCount = new Map<string, number>();
    selectedAssignments.forEach((a) => {
      const label = getRoleDisplayName(a.roleIds[0] ?? 'unknown');
      roleCount.set(label, (roleCount.get(label) ?? 0) + 1);
    });

    return Array.from(roleCount.entries())
      .map(([role, count]) => `${role} ${count}건`)
      .join(', ');
  }, [selectedAssignments]);

  // v3.1: 대회 공고 연속 날짜 그룹화
  const isTournament = jobPosting.postingType === 'tournament';

  const scheduleGroups = useMemo(() => {
    return groupDatedSchedules(
      datedSchedules,
      jobPosting.dateSpecificRequirements as DateSpecificRequirement[] | undefined,
      jobPosting.postingType
    );
  }, [datedSchedules, jobPosting.dateSpecificRequirements, jobPosting.postingType]);

  // v3.1: 그룹 역할 토글 핸들러
  const handleGroupRoleToggle = useCallback(
    (group: ScheduleGroup, slotTime: string, role: string, timeOptions?: TimeOptions) => {
      const firstKey = makeSelectionKey(group.startDate, slotTime, role);
      const isSelected = selectedKeys.has(firstKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제: 그룹 내 모든 날짜의 해당 역할 제거
        const groupDates = new Set(group.dates.map((d) => d.date));
        newAssignments = selectedAssignments.filter((a) => {
          const aDate = a.dates[0] ?? '';
          const aRole = a.roleIds[0] ?? '';
          const isInGroup = groupDates.has(aDate);
          const isSameRole = aRole === role && a.timeSlot === slotTime;
          return !(isInGroup && isSameRole);
        });
      } else {
        // 선택: 그룹 내 모든 날짜에 해당 역할 추가
        const newCount = group.dates.length;
        if (maxSelections && selectedAssignments.length + newCount > maxSelections) {
          return;
        }

        // 커스텀 역할이면 'other'로 매핑
        const roleId: StaffRole = isStaffRole(role) ? role : 'other';
        const groupAssignments = group.dates.map((schedule) =>
          createSimpleAssignment(roleId, slotTime, schedule.date, {
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

  // 고정공고: 역할만 선택 (날짜/시간 없음)
  if (isFixed && fixedSchedule) {
    return (
      <View className="bg-white dark:bg-surface rounded-xl p-4">
        <View className="mb-3">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            역할 선택 <Text className="text-error-500">*</Text>
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            원하는 역할을 선택하세요
            {maxSelections && ` (최대 ${maxSelections}개)`}
          </Text>
        </View>

        <View className="flex-row flex-wrap">
          {fixedSchedule.roles.map((role, index) => {
            const effectiveRoleId =
              role.roleId === 'other' && role.customName ? role.customName : role.roleId;
            const selectionKey = makeSelectionKey(
              FIXED_DATE_MARKER,
              FIXED_TIME_MARKER,
              effectiveRoleId
            );
            const isSelected = selectedKeys.has(selectionKey);

            return (
              <RoleCheckbox
                key={role.roleId || index}
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

        {/* 선택 요약 */}
        {selectedAssignments.length > 0 && (
          <View className="mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
            <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              ✓ 선택됨: {selectionSummary}
            </Text>
          </View>
        )}

        {error && <Text className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</Text>}
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4">
      {/* 헤더 */}
      <View className="mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          날짜 및 역할 선택 <Text className="text-error-500">*</Text>
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          원하는 시간대와 역할을 선택하세요
          {maxSelections && ` (최대 ${maxSelections}개)`}
        </Text>
      </View>

      {/* 날짜별 시간대/역할 선택 (v3.1: 대회 공고는 그룹 단위) */}
      <View>
        {isTournament
          ? // 대회 공고: 그룹 기반 렌더링
            scheduleGroups.map((group) => (
              <DateGroupSelection
                key={group.id}
                group={group}
                selectedKeys={selectedKeys}
                onGroupRoleToggle={handleGroupRoleToggle}
                disabled={disabled}
              />
            ))
          : // 일반/긴급 공고: 개별 날짜 렌더링
            datedSchedules.map((schedule, index) => (
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

      {/* 선택 요약 */}
      {selectedAssignments.length > 0 && (
        <View className="mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
            ✓ 선택됨: {selectionSummary}
          </Text>
        </View>
      )}

      {/* 에러 메시지 */}
      {error && <Text className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</Text>}
    </View>
  );
});

export default AssignmentSelector;
