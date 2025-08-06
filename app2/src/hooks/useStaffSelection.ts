import { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

interface UseStaffSelectionProps {
  totalStaffCount: number;
  onSelectionChange?: (selectedCount: number) => void;
}

interface UseStaffSelectionReturn {
  multiSelectMode: boolean;
  selectedStaff: Set<string>;
  toggleMultiSelectMode: () => void;
  toggleStaffSelection: (staffId: string) => void;
  selectAll: (staffIds: string[]) => void;
  deselectAll: () => void;
  isSelected: (staffId: string) => boolean;
  selectedCount: number;
  isAllSelected: (staffIds: string[]) => boolean;
  resetSelection: () => void;
}

/**
 * 스태프 선택 관리를 위한 커스텀 훅
 */
export const useStaffSelection = ({
  totalStaffCount,
  onSelectionChange
}: UseStaffSelectionProps): UseStaffSelectionReturn => {
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());

  // 선택 모드 토글
  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode(prev => {
      if (prev) {
        // 선택 모드 종료 시 선택 초기화
        setSelectedStaff(new Set());
        logger.debug('선택 모드 종료, 선택 초기화', { component: 'useStaffSelection' });
      }
      return !prev;
    });
  }, []);

  // 개별 스태프 선택/해제
  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
        logger.debug('스태프 선택 해제', { component: 'useStaffSelection', data: { staffId } });
      } else {
        // 대량 선택 경고
        if (newSet.size >= 100) {
          logger.warn('대량 선택 경고: 100명 이상 선택', { 
            component: 'useStaffSelection',
            data: { currentCount: newSet.size }
          });
        }
        newSet.add(staffId);
        logger.debug('스태프 선택', { component: 'useStaffSelection', data: { staffId } });
      }
      return newSet;
    });
  }, []);

  // 전체 선택
  const selectAll = useCallback((staffIds: string[]) => {
    if (staffIds.length > 100) {
      const confirmed = window.confirm(
        `${staffIds.length}명을 모두 선택하시겠습니까?\n대량 선택은 성능에 영향을 줄 수 있습니다.`
      );
      if (!confirmed) return;
    }
    
    setSelectedStaff(new Set(staffIds));
    logger.debug('전체 선택', { 
      component: 'useStaffSelection',
      data: { count: staffIds.length }
    });
  }, []);

  // 전체 해제
  const deselectAll = useCallback(() => {
    setSelectedStaff(new Set());
    logger.debug('전체 선택 해제', { component: 'useStaffSelection' });
  }, []);

  // 선택 여부 확인
  const isSelected = useCallback((staffId: string) => {
    return selectedStaff.has(staffId);
  }, [selectedStaff]);

  // 전체 선택 여부 확인
  const isAllSelected = useCallback((staffIds: string[]) => {
    if (staffIds.length === 0) return false;
    return staffIds.every(id => selectedStaff.has(id));
  }, [selectedStaff]);

  // 선택 초기화 (필터 변경 등에 사용)
  const resetSelection = useCallback(() => {
    setSelectedStaff(new Set());
    setMultiSelectMode(false);
    logger.debug('선택 상태 초기화', { component: 'useStaffSelection' });
  }, []);

  // 선택 변경 시 콜백 호출
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedStaff.size);
    }
  }, [selectedStaff.size, onSelectionChange]);

  // 선택 상태 LocalStorage 저장 (페이지 새로고침 대응)
  useEffect(() => {
    if (multiSelectMode && selectedStaff.size > 0) {
      try {
        localStorage.setItem('staffSelection', JSON.stringify(Array.from(selectedStaff)));
      } catch (error) {
        logger.error('선택 상태 저장 실패', error instanceof Error ? error : new Error(String(error)), {
          component: 'useStaffSelection'
        });
      }
    } else {
      localStorage.removeItem('staffSelection');
    }
  }, [multiSelectMode, selectedStaff]);

  // 컴포넌트 마운트 시 저장된 선택 상태 복원
  useEffect(() => {
    try {
      const savedSelection = localStorage.getItem('staffSelection');
      if (savedSelection) {
        const staffIds = JSON.parse(savedSelection);
        if (Array.isArray(staffIds) && staffIds.length > 0) {
          setSelectedStaff(new Set(staffIds));
          setMultiSelectMode(true);
          logger.debug('저장된 선택 상태 복원', {
            component: 'useStaffSelection',
            data: { count: staffIds.length }
          });
        }
      }
    } catch (error) {
      logger.error('선택 상태 복원 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useStaffSelection'
      });
      localStorage.removeItem('staffSelection');
    }
  }, []);

  return {
    multiSelectMode,
    selectedStaff,
    toggleMultiSelectMode,
    toggleStaffSelection,
    selectAll,
    deselectAll,
    isSelected,
    selectedCount: selectedStaff.size,
    isAllSelected,
    resetSelection
  };
};