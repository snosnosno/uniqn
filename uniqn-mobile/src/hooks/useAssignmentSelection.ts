/**
 * UNIQN Mobile - Assignment 선택 상태 관리 훅
 *
 * @description Assignment v2.0 선택 상태 관리를 위한 커스텀 훅
 * @version 1.0.0
 */

import { useState, useCallback, useMemo } from 'react';
import type { Assignment, TimeSlot } from '@/types';
import {
  createSimpleAssignment,
  isValidAssignment,
  getAssignmentRole,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentSelectionOptions {
  /** 초기 선택 값 */
  initialAssignments?: Assignment[];
  /** 최대 선택 가능 수 */
  maxSelections?: number;
  /** 변경 콜백 */
  onChange?: (assignments: Assignment[]) => void;
}

export interface UseAssignmentSelectionReturn {
  /** 선택된 Assignments */
  assignments: Assignment[];
  /** 선택된 역할 */
  selectedRole: string | null;
  /** 역할 설정 */
  setSelectedRole: (role: string) => void;
  /** Assignment 추가 */
  addAssignment: (assignment: Assignment) => boolean;
  /** Assignment 제거 */
  removeAssignment: (date: string, timeSlot: string) => void;
  /** 날짜 전체 토글 */
  toggleDate: (date: string, timeSlots: TimeSlot[]) => void;
  /** 시간대 토글 */
  toggleTimeSlot: (date: string, timeSlot: string) => void;
  /** 전체 초기화 */
  clearAll: () => void;
  /** 선택 유효성 검사 */
  isValid: boolean;
  /** 선택된 날짜 수 */
  selectedDateCount: number;
  /** 선택된 시간대 수 */
  selectedSlotCount: number;
  /** 특정 시간대 선택 여부 */
  isSlotSelected: (date: string, timeSlot: string) => boolean;
  /** 특정 날짜의 모든 시간대 선택 여부 */
  isDateFullySelected: (date: string, timeSlots: TimeSlot[]) => boolean;
  /** 최대 선택 도달 여부 */
  isMaxReached: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Assignment 선택 상태 관리 훅
 *
 * @description 다중 역할/시간/날짜 선택 상태를 관리
 *
 * @example
 * const {
 *   assignments,
 *   selectedRole,
 *   setSelectedRole,
 *   toggleTimeSlot,
 *   isValid,
 * } = useAssignmentSelection({
 *   initialAssignments: [],
 *   maxSelections: 10,
 *   onChange: (assignments) => console.log(assignments),
 * });
 */
export function useAssignmentSelection({
  initialAssignments = [],
  maxSelections,
  onChange,
}: UseAssignmentSelectionOptions = {}): UseAssignmentSelectionReturn {
  // 상태
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedRole, setSelectedRole] = useState<string | null>(
    initialAssignments[0] ? getAssignmentRole(initialAssignments[0]) : null
  );

  // 선택 맵 (date -> Set<timeSlot>)
  const selectionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    assignments.forEach((assignment) => {
      assignment.dates.forEach((date) => {
        if (!map.has(date)) {
          map.set(date, new Set());
        }
        map.get(date)!.add(assignment.timeSlot);
      });
    });
    return map;
  }, [assignments]);

  // 선택된 날짜 수
  const selectedDateCount = useMemo(() => {
    return selectionMap.size;
  }, [selectionMap]);

  // 선택된 시간대 수
  const selectedSlotCount = useMemo(() => {
    return assignments.length;
  }, [assignments]);

  // 최대 선택 도달 여부
  const isMaxReached = useMemo(() => {
    return maxSelections ? assignments.length >= maxSelections : false;
  }, [assignments.length, maxSelections]);

  // 유효성 검사
  const isValid = useMemo(() => {
    return (
      assignments.length > 0 &&
      selectedRole !== null &&
      assignments.every((a) => isValidAssignment(a))
    );
  }, [assignments, selectedRole]);

  // 상태 업데이트 헬퍼
  const updateAssignments = useCallback(
    (newAssignments: Assignment[]) => {
      setAssignments(newAssignments);
      onChange?.(newAssignments);
    },
    [onChange]
  );

  // Assignment 추가
  const addAssignment = useCallback(
    (assignment: Assignment): boolean => {
      if (maxSelections && assignments.length >= maxSelections) {
        return false;
      }
      if (!isValidAssignment(assignment)) {
        return false;
      }
      updateAssignments([...assignments, assignment]);
      return true;
    },
    [assignments, maxSelections, updateAssignments]
  );

  // Assignment 제거
  const removeAssignment = useCallback(
    (date: string, timeSlot: string) => {
      const newAssignments = assignments.filter(
        (a) => !(a.dates.includes(date) && a.timeSlot === timeSlot)
      );
      updateAssignments(newAssignments);
    },
    [assignments, updateAssignments]
  );

  // 시간대 선택 여부 확인
  const isSlotSelected = useCallback(
    (date: string, timeSlot: string): boolean => {
      return selectionMap.get(date)?.has(timeSlot) ?? false;
    },
    [selectionMap]
  );

  // 날짜의 모든 시간대 선택 여부 확인
  const isDateFullySelected = useCallback(
    (date: string, timeSlots: TimeSlot[]): boolean => {
      const selectedSlots = selectionMap.get(date);
      if (!selectedSlots) return false;
      return timeSlots.every((slot) => {
        const slotTime = slot.startTime ?? '';
        return selectedSlots.has(slotTime);
      });
    },
    [selectionMap]
  );

  // 시간대 토글
  const toggleTimeSlot = useCallback(
    (date: string, timeSlot: string) => {
      if (!selectedRole) return;

      const isSelected = isSlotSelected(date, timeSlot);

      if (isSelected) {
        removeAssignment(date, timeSlot);
      } else {
        if (isMaxReached) return;
        const newAssignment = createSimpleAssignment(selectedRole, timeSlot, date);
        addAssignment(newAssignment);
      }
    },
    [selectedRole, isSlotSelected, removeAssignment, isMaxReached, addAssignment]
  );

  // 날짜 전체 토글
  const toggleDate = useCallback(
    (date: string, timeSlots: TimeSlot[]) => {
      if (!selectedRole) return;

      const isFullySelected = isDateFullySelected(date, timeSlots);

      if (isFullySelected) {
        // 해당 날짜의 모든 선택 해제
        const newAssignments = assignments.filter(
          (a) => !a.dates.includes(date)
        );
        updateAssignments(newAssignments);
      } else {
        // 해당 날짜의 모든 시간대 선택
        const existingOtherDates = assignments.filter(
          (a) => !a.dates.includes(date)
        );
        const currentSlots = selectionMap.get(date) ?? new Set();
        const newSlots = timeSlots.filter((slot) => {
          const slotTime = slot.startTime ?? '';
          return !currentSlots.has(slotTime);
        });

        // 최대 선택 수 확인
        const remainingSlots = maxSelections
          ? maxSelections - existingOtherDates.length
          : newSlots.length;
        const slotsToAdd = newSlots.slice(0, remainingSlots);

        const newAssignments = slotsToAdd
          .map((slot) => {
            const slotTime = slot.startTime ?? '';
            return slotTime ? createSimpleAssignment(selectedRole, slotTime, date) : null;
          })
          .filter((a): a is NonNullable<typeof a> => a !== null);

        updateAssignments([...existingOtherDates, ...newAssignments]);
      }
    },
    [
      selectedRole,
      isDateFullySelected,
      assignments,
      selectionMap,
      maxSelections,
      updateAssignments,
    ]
  );

  // 전체 초기화
  const clearAll = useCallback(() => {
    updateAssignments([]);
  }, [updateAssignments]);

  // 역할 설정 (기존 선택 유지하면서 역할만 변경)
  const handleSetSelectedRole = useCallback(
    (role: string) => {
      setSelectedRole(role);
      // 기존 assignments의 역할도 업데이트
      if (assignments.length > 0) {
        const updatedAssignments = assignments.map((a) => ({
          ...a,
          role,
          roles: undefined, // 단일 역할로 변경
        }));
        updateAssignments(updatedAssignments);
      }
    },
    [assignments, updateAssignments]
  );

  return {
    assignments,
    selectedRole,
    setSelectedRole: handleSetSelectedRole,
    addAssignment,
    removeAssignment,
    toggleDate,
    toggleTimeSlot,
    clearAll,
    isValid,
    selectedDateCount,
    selectedSlotCount,
    isSlotSelected,
    isDateFullySelected,
    isMaxReached,
  };
}

export default useAssignmentSelection;
