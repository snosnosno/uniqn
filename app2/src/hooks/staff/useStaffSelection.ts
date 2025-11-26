/**
 * useStaffSelection.ts
 * 스태프 다중 선택 모드 관리 커스텀 훅 (SSOT)
 *
 * @description 스태프 다중 선택 기능의 표준 구현입니다.
 * 이 훅은 프로젝트 내 스태프 선택 관련 기능의 단일 진실 소스(SSOT)입니다.
 *
 * @version 2.0
 * @since 2025-02-04
 *
 * @example
 * ```typescript
 * import { useStaffSelection } from '@/hooks/staff/useStaffSelection';
 *
 * function StaffList() {
 *   const {
 *     multiSelectMode,
 *     selectedStaff,
 *     toggleMultiSelectMode,
 *     toggleStaffSelection,
 *     selectAll,
 *     deselectAll,
 *   } = useStaffSelection();
 *
 *   return (
 *     <div>
 *       <button onClick={toggleMultiSelectMode}>
 *         {multiSelectMode ? '선택 취소' : '다중 선택'}
 *       </button>
 *       {staffList.map(staff => (
 *         <div
 *           key={staff.id}
 *           onClick={() => multiSelectMode && toggleStaffSelection(staff.id)}
 *         >
 *           {staff.name}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';

export interface UseStaffSelectionReturn {
  multiSelectMode: boolean;
  selectedStaff: Set<string>;
  toggleMultiSelectMode: () => void;
  toggleStaffSelection: (staffId: string) => void;
  selectAll: (staffIds: string[]) => void;
  deselectAll: () => void;
  resetSelection: () => void;
  isAllSelected: (staffIds: string[]) => boolean;
}

/**
 * 스태프 다중 선택 모드 관리
 *
 * @returns 선택 모드 상태 및 관리 함수들
 */
export function useStaffSelection(): UseStaffSelectionReturn {
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());

  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode((prev) => {
      if (prev) {
        // 선택 모드 해제시 선택된 항목도 초기화
        setSelectedStaff(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaff((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((staffIds: string[]) => {
    setSelectedStaff(new Set(staffIds));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedStaff(new Set());
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedStaff(new Set());
    setMultiSelectMode(false);
  }, []);

  const isAllSelected = useCallback(
    (staffIds: string[]) => {
      return staffIds.length > 0 && staffIds.every((id) => selectedStaff.has(id));
    },
    [selectedStaff]
  );

  return {
    multiSelectMode,
    selectedStaff,
    toggleMultiSelectMode,
    toggleStaffSelection,
    selectAll,
    deselectAll,
    resetSelection,
    isAllSelected,
  };
}
