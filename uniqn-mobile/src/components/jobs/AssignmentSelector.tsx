/**
 * UNIQN Mobile - Assignment 선택 컴포넌트
 *
 * @description 다중 역할/시간/날짜 선택 UI (v3.1 - 대회 공고 연속 날짜 그룹화)
 * @version 3.1.0 - 대회 공고 연속 날짜 그룹 단위 선택 지원
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { useJobSchedule } from '@/hooks';
import type { Assignment, JobPosting, PostingType } from '@/types';
import {
  createSimpleAssignment,
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  TBA_TIME_MARKER,
} from '@/types';
import type { TimeSlotInfo, RoleInfo, DatedScheduleInfo } from '@/types/unified';
import {
  getRoleDisplayName,
  formatDateDisplay,
  formatTimeSlotDisplay,
  isRoleFilled,
} from '@/types/unified';
import {
  areDatesConsecutive,
  formatDateRangeWithCount,
} from '@/utils/dateRangeUtils';

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

/**
 * 연속 날짜 그룹 (대회 공고용)
 *
 * @description 연속 날짜 + 동일 timeSlots를 가진 스케줄을 그룹화
 */
interface ScheduleGroup {
  /** 고유 ID */
  id: string;
  /** 시작 날짜 (YYYY-MM-DD) */
  startDate: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  endDate: string;
  /** 그룹 레이블 (예: "1/17(금) ~ 1/19(일) (3일간)") */
  label: string;
  /** 그룹에 속한 개별 날짜 스케줄 정보 */
  dates: DatedScheduleInfo[];
  /** 공유 시간대 정보 (첫 번째 날짜 기준) */
  timeSlots: TimeSlotInfo[];
}

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

/**
 * 시간대 비교 (동일 여부)
 *
 * @description 두 시간대 배열이 같은 구조인지 확인 (시작시간, 역할ID 기준)
 */
const areTimeSlotsStructureEqual = (
  slots1: TimeSlotInfo[],
  slots2: TimeSlotInfo[]
): boolean => {
  if (slots1.length !== slots2.length) return false;

  // 시작시간 기준 정렬
  const sort = (slots: TimeSlotInfo[]) =>
    [...slots].sort((a, b) =>
      (a.startTime ?? '').localeCompare(b.startTime ?? '')
    );

  const sorted1 = sort(slots1);
  const sorted2 = sort(slots2);

  for (let i = 0; i < sorted1.length; i++) {
    const s1 = sorted1[i]!;
    const s2 = sorted2[i]!;

    // 시작 시간 비교
    if (s1.startTime !== s2.startTime) return false;
    if (!!s1.isTimeToBeAnnounced !== !!s2.isTimeToBeAnnounced) return false;

    // 역할 수 비교
    if (s1.roles.length !== s2.roles.length) return false;

    // 역할 ID 비교 (정렬 후)
    const roleIds1 = s1.roles.map((r) => r.roleId).sort();
    const roleIds2 = s2.roles.map((r) => r.roleId).sort();
    for (let j = 0; j < roleIds1.length; j++) {
      if (roleIds1[j] !== roleIds2[j]) return false;
    }
  }

  return true;
};

/**
 * DatedScheduleInfo[] → ScheduleGroup[] 변환
 *
 * @description 대회 공고: 연속 날짜 + 동일 timeSlots 구조를 그룹화
 *              일반/긴급/고정 공고: 개별 날짜를 각각 그룹으로
 */
const groupDatedSchedules = (
  schedules: DatedScheduleInfo[],
  postingType?: PostingType
): ScheduleGroup[] => {
  if (schedules.length === 0) return [];

  // 대회 공고가 아니면 그룹화하지 않음 (개별 날짜 각각 그룹)
  if (postingType !== 'tournament') {
    return schedules.map((s) => ({
      id: s.date,
      startDate: s.date,
      endDate: s.date,
      label: formatDateDisplay(s.date),
      dates: [s],
      timeSlots: s.timeSlots,
    }));
  }

  // 날짜 기준 정렬
  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));

  const groups: ScheduleGroup[] = [];
  let currentGroup: DatedScheduleInfo[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;

    // 연속 날짜이고 timeSlots 구조가 동일하면 같은 그룹
    if (
      areDatesConsecutive(prev.date, curr.date) &&
      areTimeSlotsStructureEqual(prev.timeSlots, curr.timeSlots)
    ) {
      currentGroup.push(curr);
    } else {
      // 새 그룹 시작
      groups.push(createGroupFromSchedules(currentGroup));
      currentGroup = [curr];
    }
  }

  // 마지막 그룹 추가
  groups.push(createGroupFromSchedules(currentGroup));

  return groups;
};

/**
 * DatedScheduleInfo[] → ScheduleGroup 생성
 */
const createGroupFromSchedules = (schedules: DatedScheduleInfo[]): ScheduleGroup => {
  const sortedDates = schedules.map((s) => s.date).sort();
  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;
  const label = formatDateRangeWithCount(startDate, endDate);

  return {
    id: `${startDate}-${endDate}`,
    startDate,
    endDate,
    label,
    dates: schedules,
    timeSlots: schedules[0]!.timeSlots, // 첫 번째 날짜 기준
  };
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
      <View className="flex-col gap-3">
        {timeSlots.map((slot, slotIndex) => {
          // 시간 미정이면 TBA_TIME_MARKER, 아니면 startTime 사용
          const slotTime = slot.isTimeToBeAnnounced
            ? TBA_TIME_MARKER
            : (slot.startTime ?? '');
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
                  // 커스텀 역할이면 customName을 키로 사용 (roles[].salary 구조와 일치)
                  const effectiveRoleId = role.roleId === 'other' && role.customName
                    ? role.customName
                    : role.roleId;
                  const selectionKey = makeSelectionKey(date, slotTime, effectiveRoleId);
                  const isSelected = selectedKeys.has(selectionKey);

                  return (
                    <RoleCheckbox
                      key={role.roleId || roleIndex}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() => onRoleToggle(date, slotTime, effectiveRoleId, {
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

/**
 * 그룹 선택 Props (대회 공고용)
 */
interface DateGroupSelectionProps {
  /** 스케줄 그룹 */
  group: ScheduleGroup;
  /** 선택된 키 Set */
  selectedKeys: Set<SelectionKey>;
  /** 그룹 역할 토글 콜백 (그룹 내 모든 날짜 동시 선택/해제) */
  onGroupRoleToggle: (
    group: ScheduleGroup,
    slotTime: string,
    role: string,
    timeOptions?: { isTimeToBeAnnounced?: boolean; tentativeDescription?: string }
  ) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 날짜 그룹 선택 항목 (대회 공고용)
 *
 * @description 연속 날짜 그룹을 하나의 카드로 표시
 * 역할 선택 시 그룹 내 모든 날짜에 동시 적용
 */
const DateGroupSelection = memo(function DateGroupSelection({
  group,
  selectedKeys,
  onGroupRoleToggle,
  disabled,
}: DateGroupSelectionProps) {
  const isSingleDate = group.startDate === group.endDate;
  const dayCount = group.dates.length;

  // 그룹 내 역할 선택 상태 확인 (첫 번째 날짜 기준)
  const isGroupRoleSelected = useCallback(
    (slotTime: string, effectiveRoleId: string): boolean => {
      const firstDate = group.startDate;
      const key = makeSelectionKey(firstDate, slotTime, effectiveRoleId);
      return selectedKeys.has(key);
    },
    [group.startDate, selectedKeys]
  );

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
      {/* 그룹 헤더 */}
      <View className="flex-row items-center flex-wrap mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          📅 {group.label}
        </Text>
        {!isSingleDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            {dayCount}일간 동시 선택
          </Badge>
        )}
      </View>

      {/* 시간대별 역할 선택 */}
      <View className="flex-col gap-3">
        {group.timeSlots.map((slot, slotIndex) => {
          const slotTime = slot.isTimeToBeAnnounced
            ? TBA_TIME_MARKER
            : (slot.startTime ?? '');
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
                  const effectiveRoleId =
                    role.roleId === 'other' && role.customName
                      ? role.customName
                      : role.roleId;
                  const isSelected = isGroupRoleSelected(slotTime, effectiveRoleId);

                  return (
                    <RoleCheckbox
                      key={role.roleId || roleIndex}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() =>
                        onGroupRoleToggle(group, slotTime, effectiveRoleId, {
                          isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
                          tentativeDescription: slot.tentativeDescription,
                        })
                      }
                      disabled={disabled}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* 안내 문구 (여러 날짜인 경우) */}
      {!isSingleDate && (
        <View className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            ⓘ 선택 시 {dayCount}일 모두 지원됩니다
          </Text>
        </View>
      )}
    </View>
  );
});

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

  // v3.1: 대회 공고 연속 날짜 그룹화
  const isTournament = jobPosting.postingType === 'tournament';

  const scheduleGroups = useMemo(() => {
    return groupDatedSchedules(datedSchedules, jobPosting.postingType);
  }, [datedSchedules, jobPosting.postingType]);

  // v3.1: 그룹 역할 토글 핸들러 (그룹 내 모든 날짜 동시 선택/해제)
  const handleGroupRoleToggle = useCallback(
    (
      group: ScheduleGroup,
      slotTime: string,
      role: string,
      timeOptions?: { isTimeToBeAnnounced?: boolean; tentativeDescription?: string }
    ) => {
      // 그룹의 첫 번째 날짜 기준으로 선택 상태 확인
      const firstKey = makeSelectionKey(group.startDate, slotTime, role);
      const isSelected = selectedKeys.has(firstKey);

      let newAssignments: Assignment[];

      if (isSelected) {
        // 해제: 그룹 내 모든 날짜의 해당 역할 제거
        const groupDates = new Set(group.dates.map((d) => d.date));
        newAssignments = selectedAssignments.filter((a) => {
          const aDate = a.dates[0] ?? '';
          const aRole = a.roleIds[0] ?? '';
          // 그룹 내 날짜이고 같은 역할이면 제거
          const isInGroup = groupDates.has(aDate);
          const isSameRole = aRole === role && a.timeSlot === slotTime;
          return !(isInGroup && isSameRole);
        });
      } else {
        // 선택: 그룹 내 모든 날짜에 해당 역할 추가
        // 최대 선택 수 확인 (그룹 전체 추가 가능 여부)
        const newCount = group.dates.length;
        if (maxSelections && selectedAssignments.length + newCount > maxSelections) {
          return; // 최대 선택 수 초과
        }

        // 그룹 내 모든 날짜에 Assignment 생성
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
            // 커스텀 역할이면 customName을 키로 사용 (roleSalaries 키와 일치)
            const effectiveRoleId = role.roleId === 'other' && role.customName
              ? role.customName
              : role.roleId;
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
                onToggle={() => handleRoleToggle(FIXED_DATE_MARKER, FIXED_TIME_MARKER, effectiveRoleId)}
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

      {/* 날짜별 시간대/역할 선택 (v3.1: 대회 공고는 그룹 단위) */}
      <View>
        {isTournament ? (
          // 대회 공고: 그룹 기반 렌더링 (연속 날짜 묶음)
          scheduleGroups.map((group) => (
            <DateGroupSelection
              key={group.id}
              group={group}
              selectedKeys={selectedKeys}
              onGroupRoleToggle={handleGroupRoleToggle}
              disabled={disabled}
            />
          ))
        ) : (
          // 일반/긴급 공고: 개별 날짜 렌더링
          datedSchedules.map((schedule, index) => (
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
          ))
        )}
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
