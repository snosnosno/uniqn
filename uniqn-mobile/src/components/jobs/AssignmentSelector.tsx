/**
 * UNIQN Mobile - Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI (Assignment v2.0)
 * @version 1.0.0
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { Assignment, DateSpecificRequirement, TimeSlot, JobPosting } from '@/types';
import { getDateFromRequirement, sortDateRequirements, createSimpleAssignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface AssignmentSelectorProps {
  /** 공고 정보 */
  jobPosting: JobPosting;
  /** 선택된 Assignments */
  selectedAssignments: Assignment[];
  /** 선택 변경 콜백 */
  onSelectionChange: (assignments: Assignment[]) => void;
  /** 최대 선택 가능 수 (기본: 제한 없음) */
  maxSelections?: number;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 에러 메시지 */
  error?: string;
}

interface DateSelectionProps {
  date: string;
  timeSlots: TimeSlot[];
  isMainDate?: boolean;
  description?: string;
  isSelected: boolean;
  selectedSlots: string[];
  onDateToggle: (date: string) => void;
  onSlotToggle: (date: string, slotTime: string) => void;
  disabled?: boolean;
}

interface RoleSelectorProps {
  roles: string[];
  selectedRole: string | null;
  onRoleSelect: (role: string) => void;
  disabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
};

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    dealer: '딜러',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
  };
  return roleMap[role] ?? role;
};

const formatTimeRange = (slot: TimeSlot): string => {
  if (slot.isFullDay) return '종일';
  if (slot.isTimeToBeAnnounced) return slot.tentativeDescription ?? '시간 미정';
  return slot.endTime ? `${slot.time} - ${slot.endTime}` : slot.time;
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 역할 선택기
 */
const RoleSelector = memo(function RoleSelector({
  roles,
  selectedRole,
  onRoleSelect,
  disabled,
}: RoleSelectorProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        역할 선택
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {roles.map((role) => {
            const isSelected = selectedRole === role;
            return (
              <Pressable
                key={role}
                onPress={() => !disabled && onRoleSelect(role)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled }}
                className={`px-4 py-2 rounded-lg border ${
                  isSelected
                    ? 'bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700'
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected
                      ? 'text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {getRoleLabel(role)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

/**
 * 날짜/시간대 선택 항목
 */
const DateSelection = memo(function DateSelection({
  date,
  timeSlots,
  isMainDate,
  description,
  isSelected,
  selectedSlots,
  onDateToggle,
  onSlotToggle,
  disabled,
}: DateSelectionProps) {
  const formattedDate = formatDate(date);
  const allSlotsSelected = timeSlots.every((slot) =>
    selectedSlots.includes(slot.time)
  );

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
      {/* 날짜 헤더 */}
      <Pressable
        onPress={() => !disabled && onDateToggle(date)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled }}
        className="flex-row items-center justify-between mb-2"
      >
        <View className="flex-row items-center">
          <View
            className={`w-5 h-5 rounded mr-3 border-2 items-center justify-center ${
              allSlotsSelected
                ? 'bg-primary-600 border-primary-600'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {allSlotsSelected && (
              <Text className="text-white text-xs">✓</Text>
            )}
          </View>
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {formattedDate}
          </Text>
          {isMainDate && (
            <Badge variant="primary" size="sm" className="ml-2">
              메인
            </Badge>
          )}
        </View>
      </Pressable>

      {description && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2 ml-8">
          {description}
        </Text>
      )}

      {/* 시간대 목록 */}
      <View className="ml-8">
        {timeSlots.map((slot, index) => {
          const slotSelected = selectedSlots.includes(slot.time);
          return (
            <Pressable
              key={index}
              onPress={() => !disabled && onSlotToggle(date, slot.time)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: slotSelected, disabled }}
              className="flex-row items-center py-2"
            >
              <View
                className={`w-4 h-4 rounded mr-2 border items-center justify-center ${
                  slotSelected
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {slotSelected && (
                  <Text className="text-white text-xs">✓</Text>
                )}
              </View>
              <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                {formatTimeRange(slot)}
              </Text>
              <View className="flex-row gap-1">
                {slot.roles.slice(0, 2).map((role, idx) => (
                  <Badge key={idx} variant="default" size="sm">
                    {getRoleLabel(role.name)} {role.count}명
                  </Badge>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI
 * DateSpecificRequirement가 있으면 다중 날짜 모드, 없으면 단일 날짜 모드
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
  // 선택된 역할
  const [selectedRole, setSelectedRole] = useState<string | null>(
    selectedAssignments[0]?.role ?? jobPosting.roles[0]?.role ?? null
  );

  // 사용 가능한 역할 목록
  const availableRoles = useMemo(() => {
    return jobPosting.roles.map((r) => r.role);
  }, [jobPosting.roles]);

  // 날짜별 요구사항 (정렬됨)
  const dateRequirements = useMemo(() => {
    if (jobPosting.dateSpecificRequirements?.length) {
      return sortDateRequirements(jobPosting.dateSpecificRequirements);
    }
    // 레거시: 단일 날짜
    return [
      {
        date: jobPosting.workDate,
        timeSlots: [
          {
            time: jobPosting.timeSlot.split(' - ')[0] || jobPosting.timeSlot,
            endTime: jobPosting.timeSlot.split(' - ')[1],
            roles: jobPosting.roles.map((r) => ({ name: r.role, count: r.count })),
          },
        ],
      },
    ] as DateSpecificRequirement[];
  }, [jobPosting]);

  // 선택 상태 맵 (date -> slot times[])
  const selectionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    selectedAssignments.forEach((assignment) => {
      assignment.dates.forEach((date) => {
        if (!map.has(date)) {
          map.set(date, new Set());
        }
        map.get(date)!.add(assignment.timeSlot);
      });
    });
    return map;
  }, [selectedAssignments]);

  // 역할 선택 핸들러
  const handleRoleSelect = useCallback((role: string) => {
    setSelectedRole(role);
  }, []);

  // 날짜 전체 토글
  const handleDateToggle = useCallback(
    (date: string) => {
      if (!selectedRole) return;

      const requirement = dateRequirements.find(
        (r) => getDateFromRequirement(r) === date
      );
      if (!requirement) return;

      const currentSlots = selectionMap.get(date) ?? new Set();
      const allSlots = requirement.timeSlots.map((s) => s.time);
      const allSelected = allSlots.every((slot) => currentSlots.has(slot));

      let newAssignments: Assignment[];

      if (allSelected) {
        // 전체 해제: 해당 날짜의 모든 assignment 제거
        newAssignments = selectedAssignments.filter(
          (a) => !a.dates.includes(date)
        );
      } else {
        // 전체 선택: 해당 날짜의 모든 시간대 추가
        const existingOtherDates = selectedAssignments.filter(
          (a) => !a.dates.includes(date)
        );
        const newSlotAssignments = allSlots.map((slotTime) =>
          createSimpleAssignment(selectedRole, slotTime, date)
        );
        newAssignments = [...existingOtherDates, ...newSlotAssignments];
      }

      onSelectionChange(newAssignments);
    },
    [selectedRole, dateRequirements, selectionMap, selectedAssignments, onSelectionChange]
  );

  // 개별 시간대 토글
  const handleSlotToggle = useCallback(
    (date: string, slotTime: string) => {
      if (!selectedRole) return;

      const currentSlots = selectionMap.get(date) ?? new Set();
      const isSelected = currentSlots.has(slotTime);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제
        newAssignments = selectedAssignments.filter(
          (a) => !(a.dates.includes(date) && a.timeSlot === slotTime)
        );
      } else {
        // 선택
        if (maxSelections && selectedAssignments.length >= maxSelections) {
          return; // 최대 선택 수 초과
        }
        const newAssignment = createSimpleAssignment(selectedRole, slotTime, date);
        newAssignments = [...selectedAssignments, newAssignment];
      }

      onSelectionChange(newAssignments);
    },
    [selectedRole, selectionMap, selectedAssignments, maxSelections, onSelectionChange]
  );

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4">
      {/* 역할 선택 */}
      <RoleSelector
        roles={availableRoles}
        selectedRole={selectedRole}
        onRoleSelect={handleRoleSelect}
        disabled={disabled}
      />

      {/* 날짜/시간대 선택 */}
      <View>
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          날짜 및 시간 선택
          {maxSelections && (
            <Text className="text-gray-400"> (최대 {maxSelections}개)</Text>
          )}
        </Text>

        {dateRequirements.map((req, index) => {
          const dateStr = getDateFromRequirement(req);
          const selectedSlots = Array.from(selectionMap.get(dateStr) ?? []);
          const isSelected = selectedSlots.length > 0;

          return (
            <DateSelection
              key={index}
              date={dateStr}
              timeSlots={req.timeSlots}
              isMainDate={req.isMainDate}
              description={req.description}
              isSelected={isSelected}
              selectedSlots={selectedSlots}
              onDateToggle={handleDateToggle}
              onSlotToggle={handleSlotToggle}
              disabled={disabled}
            />
          );
        })}
      </View>

      {/* 선택 요약 */}
      {selectedAssignments.length > 0 && (
        <View className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            선택됨: {selectedAssignments.length}개 시간대
          </Text>
        </View>
      )}

      {/* 에러 메시지 */}
      {error && (
        <Text className="text-sm text-red-500 dark:text-red-400 mt-2">
          {error}
        </Text>
      )}
    </View>
  );
});

export default AssignmentSelector;
