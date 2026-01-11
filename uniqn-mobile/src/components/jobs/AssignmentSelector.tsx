/**
 * UNIQN Mobile - Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI (v3.0 - useJobSchedule Hook 적용)
 * @version 3.0.0 - 통합 타입 기반으로 리팩토링
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { useJobSchedule } from '@/hooks';
import type { Assignment, JobPosting } from '@/types';
import { createSimpleAssignment } from '@/types';
import type { TimeSlotInfo, RoleInfo } from '@/types/unified';
import {
  getRoleDisplayName,
  formatDateDisplay,
  formatTimeSlotDisplay,
  isRoleFilled,
} from '@/types/unified';

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

/** 역할 선택 키 (date-slot-role 조합) */
type SelectionKey = string;

interface DateSelectionProps {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시간대 정보 배열 (v3.0: TimeSlotInfo[]) */
  timeSlots: TimeSlotInfo[];
  /** 메인 날짜 여부 */
  isMainDate?: boolean;
  /** 설명 */
  description?: string;
  /** 선택된 키 Set */
  selectedKeys: Set<SelectionKey>;
  /** 역할 토글 콜백 */
  onRoleToggle: (
    date: string,
    slotTime: string,
    role: string,
    timeOptions?: { isTimeToBeAnnounced?: boolean; tentativeDescription?: string }
  ) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** 선택 키 생성 (date|slot|role) */
const makeSelectionKey = (date: string, slotTime: string, role: string): SelectionKey => {
  return `${date}|${slotTime}|${role}`;
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 역할 체크박스 컴포넌트
 */
interface RoleCheckboxProps {
  /** 역할 정보 (v3.0: RoleInfo) */
  role: RoleInfo;
  /** 선택 여부 */
  isSelected: boolean;
  /** 토글 콜백 */
  onToggle: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

const RoleCheckbox = memo(function RoleCheckbox({
  role,
  isSelected,
  onToggle,
  disabled,
}: RoleCheckboxProps) {
  const roleLabel = getRoleDisplayName(role.roleId, role.customName);
  const isFilled = isRoleFilled(role);
  const isDisabled = disabled || isFilled;

  return (
    <Pressable
      onPress={() => !isDisabled && onToggle()}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      className={`flex-row items-center mr-3 mb-1 ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {/* 체크박스 */}
      <View
        className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : isFilled
            ? 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
      </View>
      {/* 역할 라벨 + 충원 현황 */}
      <Text
        className={`text-sm ${
          isFilled
            ? 'text-gray-400 dark:text-gray-500 line-through'
            : isSelected
            ? 'text-primary-700 dark:text-primary-300 font-medium'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {roleLabel}({role.filledCount}/{role.requiredCount})
      </Text>
      {isFilled && (
        <Badge variant="default" size="sm" className="ml-1">
          마감
        </Badge>
      )}
    </Pressable>
  );
});

/**
 * 날짜/시간대 선택 항목 (역할 체크박스 포함)
 */
const DateSelection = memo(function DateSelection({
  date,
  timeSlots,
  isMainDate,
  description,
  selectedKeys,
  onRoleToggle,
  disabled,
}: DateSelectionProps) {
  const formattedDate = formatDateDisplay(date);

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
      {/* 날짜 헤더 */}
      <View className="flex-row items-center mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          📅 {formattedDate}
        </Text>
        {isMainDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            메인
          </Badge>
        )}
      </View>

      {description && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {description}
        </Text>
      )}

      {/* 시간대별 역할 선택 */}
      <View className="space-y-3">
        {timeSlots.map((slot, slotIndex) => {
          // 시간 미정이면 빈 문자열, 아니면 startTime 사용
          const slotTime = slot.isTimeToBeAnnounced ? '' : (slot.startTime ?? '');
          const timeDisplay = formatTimeSlotDisplay(slot);

          return (
            <View key={slot.id || slotIndex} className="pl-2">
              {/* 시간 표시 */}
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                🕐 {timeDisplay}
              </Text>
              {/* 역할 체크박스들 */}
              <View className="flex-row flex-wrap pl-4">
                {slot.roles.map((role, roleIndex) => {
                  const selectionKey = makeSelectionKey(date, slotTime, role.roleId);
                  const isSelected = selectedKeys.has(selectionKey);

                  return (
                    <RoleCheckbox
                      key={role.roleId || roleIndex}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() => onRoleToggle(date, slotTime, role.roleId, {
                        isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
                        tentativeDescription: slot.tentativeDescription,
                      })}
                      disabled={disabled}
                    />
                  );
                })}
              </View>
            </View>
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
 * @description 시간대별 역할 직접 선택 UI (v3.0)
 * useJobSchedule Hook을 사용하여 통합 타입 기반으로 데이터 처리
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
        // v3.0: roleIds[0] 사용 (단일 역할 선택 기준)
        const key = makeSelectionKey(date, assignment.timeSlot, assignment.roleIds[0] ?? '');
        keys.add(key);
      });
    });
    return keys;
  }, [selectedAssignments]);

  // 역할 토글 핸들러
  const handleRoleToggle = useCallback(
    (
      date: string,
      slotTime: string,
      role: string,
      timeOptions?: { isTimeToBeAnnounced?: boolean; tentativeDescription?: string }
    ) => {
      const selectionKey = makeSelectionKey(date, slotTime, role);
      const isSelected = selectedKeys.has(selectionKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제: 해당 조합의 assignment 제거
        newAssignments = selectedAssignments.filter((a) => {
          // v3.0: roleIds[0] 사용
          const aKey = makeSelectionKey(a.dates[0] ?? '', a.timeSlot, a.roleIds[0] ?? '');
          return aKey !== selectionKey;
        });
      } else {
        // 선택: 최대 선택 수 확인 후 추가
        if (maxSelections && selectedAssignments.length >= maxSelections) {
          return; // 최대 선택 수 초과
        }
        // 미정 시간 정보를 포함하여 Assignment 생성
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

  // 선택된 역할 요약
  const selectionSummary = useMemo(() => {
    if (selectedAssignments.length === 0) return '';

    const roleCount = new Map<string, number>();
    selectedAssignments.forEach((a) => {
      // v3.0: roleIds[0] 사용
      const label = getRoleDisplayName(a.roleIds[0] ?? 'unknown');
      roleCount.set(label, (roleCount.get(label) ?? 0) + 1);
    });

    return Array.from(roleCount.entries())
      .map(([role, count]) => `${role} ${count}건`)
      .join(', ');
  }, [selectedAssignments]);

  // 고정공고: 역할만 선택 (날짜/시간 없음)
  if (isFixed && fixedSchedule) {
    return (
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4">
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
            const selectionKey = makeSelectionKey('fixed', '', role.roleId);
            const isSelected = selectedKeys.has(selectionKey);

            return (
              <RoleCheckbox
                key={role.roleId || index}
                role={role}
                isSelected={isSelected}
                onToggle={() => handleRoleToggle('fixed', '', role.roleId)}
                disabled={disabled}
              />
            );
          })}
        </View>

        {/* 선택 요약 */}
        {selectedAssignments.length > 0 && (
          <View className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              ✓ 선택됨: {selectionSummary}
            </Text>
          </View>
        )}

        {error && (
          <Text className="text-sm text-red-500 dark:text-red-400 mt-2">
            {error}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4">
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

      {/* 날짜별 시간대/역할 선택 (v3.0: datedSchedules 직접 사용) */}
      <View>
        {datedSchedules.map((schedule, index) => (
          <DateSelection
            key={schedule.date || index}
            date={schedule.date}
            timeSlots={schedule.timeSlots}
            isMainDate={schedule.isMainDate}
            description={schedule.description}
            selectedKeys={selectedKeys}
            onRoleToggle={handleRoleToggle}
            disabled={disabled}
          />
        ))}
      </View>

      {/* 선택 요약 */}
      {selectedAssignments.length > 0 && (
        <View className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-sm text-primary-600 dark:text-primary-400 font-medium">
            ✓ 선택됨: {selectionSummary}
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
