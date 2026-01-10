/**
 * UNIQN Mobile - Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI (Assignment v2.0)
 * @version 2.0.0 - 시간대별 역할 직접 선택 UI로 개선
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
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

/** 역할 선택 키 (date-slot-role 조합) */
type SelectionKey = string;

interface DateSelectionProps {
  date: string;
  timeSlots: TimeSlot[];
  isMainDate?: boolean;
  description?: string;
  selectedKeys: Set<SelectionKey>;
  onRoleToggle: (date: string, slotTime: string, role: string) => void;
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
    floor: '플로어',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
    other: '기타',
  };
  return roleMap[role] ?? role;
};

const formatTimeDisplay = (slot: TimeSlot): string => {
  if (slot.isFullDay) return '종일';
  if (slot.isTimeToBeAnnounced) {
    return slot.tentativeDescription ? `시간 미정 (${slot.tentativeDescription})` : '시간 미정';
  }
  return slot.startTime ?? slot.time ?? '-';
};

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
  roleName: string;
  filled: number;
  headcount: number;
  isSelected: boolean;
  isFilled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const RoleCheckbox = memo(function RoleCheckbox({
  roleName,
  filled,
  headcount,
  isSelected,
  isFilled,
  onToggle,
  disabled,
}: RoleCheckboxProps) {
  const roleLabel = getRoleLabel(roleName);
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
        {roleLabel}({filled}/{headcount})
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
  const formattedDate = formatDate(date);

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
          const slotTime = slot.startTime ?? slot.time ?? '';
          const timeDisplay = formatTimeDisplay(slot);

          return (
            <View key={slotIndex} className="pl-2">
              {/* 시간 표시 */}
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                🕐 {timeDisplay}
              </Text>
              {/* 역할 체크박스들 */}
              <View className="flex-row flex-wrap pl-4">
                {slot.roles.map((role, roleIndex) => {
                  // RoleRequirement 타입에서 역할 이름 추출
                  const roleName = (role as { role?: string; name?: string }).role
                    ?? (role as { name?: string }).name
                    ?? 'dealer';
                  const selectionKey = makeSelectionKey(date, slotTime, roleName);
                  const isSelected = selectedKeys.has(selectionKey);
                  // filled, headcount 또는 count 추출
                  const filled = (role as { filled?: number }).filled ?? 0;
                  const headcount = (role as { headcount?: number; count?: number }).headcount
                    ?? (role as { count?: number }).count
                    ?? 0;
                  const isFilled = filled >= headcount;

                  return (
                    <RoleCheckbox
                      key={roleIndex}
                      roleName={roleName}
                      filled={filled}
                      headcount={headcount}
                      isSelected={isSelected}
                      isFilled={isFilled}
                      onToggle={() => onRoleToggle(date, slotTime, roleName)}
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
 * @description 시간대별 역할 직접 선택 UI (v2.0)
 * 각 시간대 옆에 역할 체크박스가 표시되며, 마감된 역할은 비활성화됨
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
            time: jobPosting.timeSlot?.split(' - ')[0] || jobPosting.timeSlot || '',
            endTime: jobPosting.timeSlot?.split(' - ')[1],
            roles: jobPosting.roles.map((r) => ({
              name: r.role,
              count: r.count,
              filled: r.filled,
            })),
          },
        ],
      },
    ] as DateSpecificRequirement[];
  }, [jobPosting]);

  // 선택된 키 Set (date|slot|role 조합)
  const selectedKeys = useMemo(() => {
    const keys = new Set<SelectionKey>();
    selectedAssignments.forEach((assignment) => {
      assignment.dates.forEach((date) => {
        const key = makeSelectionKey(date, assignment.timeSlot, assignment.role ?? '');
        keys.add(key);
      });
    });
    return keys;
  }, [selectedAssignments]);

  // 역할 토글 핸들러
  const handleRoleToggle = useCallback(
    (date: string, slotTime: string, role: string) => {
      const selectionKey = makeSelectionKey(date, slotTime, role);
      const isSelected = selectedKeys.has(selectionKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제: 해당 조합의 assignment 제거
        newAssignments = selectedAssignments.filter((a) => {
          const aKey = makeSelectionKey(a.dates[0] ?? '', a.timeSlot, a.role ?? '');
          return aKey !== selectionKey;
        });
      } else {
        // 선택: 최대 선택 수 확인 후 추가
        if (maxSelections && selectedAssignments.length >= maxSelections) {
          return; // 최대 선택 수 초과
        }
        const newAssignment = createSimpleAssignment(role, slotTime, date);
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
      const label = getRoleLabel(a.role ?? 'unknown');
      roleCount.set(label, (roleCount.get(label) ?? 0) + 1);
    });

    return Array.from(roleCount.entries())
      .map(([role, count]) => `${role} ${count}건`)
      .join(', ');
  }, [selectedAssignments]);

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

      {/* 날짜별 시간대/역할 선택 */}
      <View>
        {dateRequirements.map((req, index) => {
          const dateStr = getDateFromRequirement(req);

          return (
            <DateSelection
              key={index}
              date={dateStr}
              timeSlots={req.timeSlots}
              isMainDate={req.isMainDate}
              description={req.description}
              selectedKeys={selectedKeys}
              onRoleToggle={handleRoleToggle}
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
