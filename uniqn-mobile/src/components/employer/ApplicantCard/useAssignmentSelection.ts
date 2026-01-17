/**
 * UNIQN Mobile - 일정 선택 커스텀 훅
 *
 * @description 지원자 카드에서 일정 선택 상태 관리
 * @version 1.0.0
 */

import { useState, useMemo, useCallback } from 'react';
import { getAssignmentRoles } from '@/types';
import type { Assignment } from '@/types';
import { formatAssignments, createAssignmentKey, getDateFromKey } from './utils';
import type { AssignmentDisplay } from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentSelectionProps {
  /** 지원자의 assignments 배열 */
  assignments?: Assignment[];
  /** 고정공고 모드 (일정 선택 비활성화) */
  isFixedMode?: boolean;
}

export interface UseAssignmentSelectionReturn {
  /** 선택된 일정 키 Set */
  selectedKeys: Set<string>;
  /** 포맷된 일정 표시 배열 */
  assignmentDisplays: AssignmentDisplay[];
  /** 모든 일정 키 배열 */
  allAssignmentKeys: string[];
  /** 선택된 일정 개수 */
  selectedCount: number;
  /** 전체 일정 개수 */
  totalCount: number;
  /** 일정 선택/해제 토글 (같은 날짜에는 하나만 선택) */
  toggleAssignment: (key: string) => void;
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
   * 선택 초기화
   */
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  return {
    selectedKeys,
    assignmentDisplays,
    allAssignmentKeys,
    selectedCount,
    totalCount,
    toggleAssignment,
    getSelectedAssignments,
    clearSelection,
  };
}

export default useAssignmentSelection;
