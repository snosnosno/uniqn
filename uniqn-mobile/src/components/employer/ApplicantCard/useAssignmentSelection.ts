/**
 * UNIQN Mobile - 일정 선택 커스텀 훅
 *
 * @description 지원자 카드에서 일정 선택 상태 관리
 *   + 그룹 선택 기능 지원 (연속/다중 날짜 통합)
 * @version 1.1.0
 */

import { useState, useMemo, useCallback } from 'react';
import { getAssignmentRoles } from '@/types';
import type { Assignment } from '@/types';
import { formatAssignments, createAssignmentKey, getDateFromKey } from './utils';
import { isConsecutiveDates } from '@/utils/scheduleGrouping';
import type { AssignmentDisplay, GroupedAssignmentDisplay } from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentSelectionProps {
  /** 지원자의 assignments 배열 */
  assignments?: Assignment[];
  /** 고정공고 모드 (일정 선택 비활성화) */
  isFixedMode?: boolean;
}

/** 그룹 선택 상태 */
export type GroupSelectionState = 'all' | 'some' | 'none';

export interface UseAssignmentSelectionReturn {
  /** 선택된 일정 키 Set */
  selectedKeys: Set<string>;
  /** 포맷된 일정 표시 배열 */
  assignmentDisplays: AssignmentDisplay[];
  /** 그룹화된 일정 표시 배열 (연속/다중 날짜 통합) */
  groupedAssignments: GroupedAssignmentDisplay[];
  /** 모든 일정 키 배열 */
  allAssignmentKeys: string[];
  /** 선택된 일정 개수 */
  selectedCount: number;
  /** 전체 일정 개수 */
  totalCount: number;
  /** 일정 선택/해제 토글 (같은 날짜에는 하나만 선택) */
  toggleAssignment: (key: string) => void;
  /** 그룹 전체 선택/해제 토글 */
  toggleGroup: (groupId: string) => void;
  /** 그룹 선택 상태 확인 */
  getGroupSelectionState: (groupId: string) => GroupSelectionState;
  /** 선택된 일정을 Assignment 배열로 반환 */
  getSelectedAssignments: () => Assignment[];
  /** 선택 초기화 */
  clearSelection: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 일정 선택 상태 관리 훅
 *
 * @description
 * - 일정 선택/해제 상태 관리
 * - 같은 날짜에는 하나의 역할/시간만 선택 가능 (자동 교체)
 * - 선택된 일정을 Assignment 배열로 변환
 *
 * @example
 * ```tsx
 * const {
 *   selectedKeys,
 *   assignmentDisplays,
 *   selectedCount,
 *   toggleAssignment,
 *   getSelectedAssignments,
 * } = useAssignmentSelection({
 *   assignments: applicant.assignments,
 *   isFixedMode: false,
 * });
 *
 * // 체크박스 토글
 * <Pressable onPress={() => toggleAssignment(key)}>
 *   ...
 * </Pressable>
 *
 * // 확정 시 선택된 일정 전달
 * const selected = getSelectedAssignments();
 * onConfirm(applicant, selected);
 * ```
 */
/**
 * 그룹 ID 생성 (timeSlot + role 조합)
 */
function createGroupId(timeSlot: string, role: string): string {
  return `${timeSlot}_${role}`;
}

export function useAssignmentSelection({
  assignments,
  isFixedMode = false,
}: UseAssignmentSelectionProps): UseAssignmentSelectionReturn {
  // 일정 선택 상태 (key: "date_timeSlot_role")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Assignments 정보 포맷
  const assignmentDisplays = useMemo(
    () => formatAssignments(assignments),
    [assignments]
  );

  // 그룹화된 일정 (같은 timeSlot + role 묶음)
  const groupedAssignments = useMemo<GroupedAssignmentDisplay[]>(() => {
    if (assignmentDisplays.length === 0) return [];

    // 그룹 맵: groupId -> items
    const groupMap = new Map<string, AssignmentDisplay[]>();

    for (const display of assignmentDisplays) {
      const groupId = createGroupId(display.timeSlot, display.role);
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(display);
    }

    // 그룹 배열 생성
    const groups: GroupedAssignmentDisplay[] = [];
    for (const [groupId, items] of groupMap.entries()) {
      // 날짜순 정렬
      const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date));
      const dates = sortedItems.map(item => item.date);
      const firstItem = sortedItems[0];

      groups.push({
        groupId,
        dateRange: {
          start: dates[0],
          end: dates[dates.length - 1],
          dates,
          totalDays: dates.length,
          isConsecutive: isConsecutiveDates(dates),
        },
        timeSlotDisplay: firstItem.timeSlotDisplay,
        roleLabel: firstItem.roleLabel,
        role: firstItem.role,
        timeSlot: firstItem.timeSlot,
        items: sortedItems,
      });
    }

    // 시작 날짜순 정렬
    return groups.sort((a, b) => a.dateRange.start.localeCompare(b.dateRange.start));
  }, [assignmentDisplays]);

  // 모든 일정 키 목록 (역할별로 분리)
  const allAssignmentKeys = useMemo(() => {
    const keys: string[] = [];
    for (const display of assignmentDisplays) {
      keys.push(createAssignmentKey(display.date, display.timeSlot, display.role));
    }
    return keys;
  }, [assignmentDisplays]);

  // 선택된 일정 개수
  const selectedCount = selectedKeys.size;
  const totalCount = allAssignmentKeys.length;

  /**
   * 일정 토글 (같은 날짜에는 하나만 선택 가능)
   *
   * @description
   * - 이미 선택된 항목 클릭 시: 해제
   * - 새로 선택 시: 같은 날짜의 다른 항목 자동 제거
   */
  const toggleAssignment = useCallback((key: string) => {
    if (isFixedMode) return; // 고정공고 모드에서는 선택 불가

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // 이미 선택된 항목 클릭 시 해제
        next.delete(key);
      } else {
        // 새로 선택 시, 같은 날짜의 다른 항목들 제거
        const selectedDate = getDateFromKey(key);
        // 같은 날짜의 기존 선택 항목 제거
        for (const existingKey of prev) {
          const existingDate = getDateFromKey(existingKey);
          if (existingDate === selectedDate) {
            next.delete(existingKey);
          }
        }
        next.add(key);
      }
      return next;
    });
  }, [isFixedMode]);

  /**
   * 선택된 일정으로 Assignment 배열 생성 (역할별로 분리)
   */
  const getSelectedAssignments = useCallback((): Assignment[] => {
    if (!assignments || isFixedMode) return [];

    const result: Assignment[] = [];
    for (const assignment of assignments) {
      const roles = getAssignmentRoles(assignment);

      for (const role of roles) {
        const selectedDates = assignment.dates.filter((date) =>
          selectedKeys.has(createAssignmentKey(date, assignment.timeSlot, role))
        );
        if (selectedDates.length > 0) {
          result.push({
            ...assignment,
            roleIds: [role], // v3.0: roleIds 배열로 설정
            dates: selectedDates,
          });
        }
      }
    }
    return result;
  }, [assignments, selectedKeys, isFixedMode]);

  /**
   * 그룹 선택 상태 확인
   */
  const getGroupSelectionState = useCallback((groupId: string): GroupSelectionState => {
    const group = groupedAssignments.find(g => g.groupId === groupId);
    if (!group) return 'none';

    const groupKeys = group.items.map(item =>
      createAssignmentKey(item.date, item.timeSlot, item.role)
    );

    const selectedInGroup = groupKeys.filter(key => selectedKeys.has(key)).length;

    if (selectedInGroup === 0) return 'none';
    if (selectedInGroup === groupKeys.length) return 'all';
    return 'some';
  }, [groupedAssignments, selectedKeys]);

  /**
   * 그룹 전체 선택/해제 토글
   *
   * @description
   * - 전체 선택 상태: 전체 해제
   * - 일부/미선택 상태: 전체 선택
   * - 같은 날짜의 다른 그룹 항목은 자동 제거됨
   */
  const toggleGroup = useCallback((groupId: string) => {
    if (isFixedMode) return;

    const group = groupedAssignments.find(g => g.groupId === groupId);
    if (!group) return;

    const state = getGroupSelectionState(groupId);

    setSelectedKeys((prev) => {
      const next = new Set(prev);

      if (state === 'all') {
        // 전체 해제
        for (const item of group.items) {
          const key = createAssignmentKey(item.date, item.timeSlot, item.role);
          next.delete(key);
        }
      } else {
        // 전체 선택 (같은 날짜의 다른 항목 제거)
        for (const item of group.items) {
          const key = createAssignmentKey(item.date, item.timeSlot, item.role);

          // 같은 날짜의 기존 선택 항목 제거
          for (const existingKey of prev) {
            const existingDate = getDateFromKey(existingKey);
            if (existingDate === item.date && !next.has(key)) {
              next.delete(existingKey);
            }
          }

          next.add(key);
        }
      }

      return next;
    });
  }, [isFixedMode, groupedAssignments, getGroupSelectionState]);

  /**
   * 선택 초기화
   */
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  return {
    selectedKeys,
    assignmentDisplays,
    groupedAssignments,
    allAssignmentKeys,
    selectedCount,
    totalCount,
    toggleAssignment,
    toggleGroup,
    getGroupSelectionState,
    getSelectedAssignments,
    clearSelection,
  };
}

export default useAssignmentSelection;
