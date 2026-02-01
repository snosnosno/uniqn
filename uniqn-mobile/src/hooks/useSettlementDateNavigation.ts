/**
 * UNIQN Mobile - 정산 날짜 네비게이션 훅
 *
 * @description SettlementDetailModal에서 그룹화된 정산의 날짜 이동 로직
 * @version 1.0.0
 */

import { useMemo, useCallback } from 'react';
import type { WorkLog, GroupedSettlement } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UseSettlementDateNavigationResult {
  /** 그룹 모드 여부 (2일 이상일 때 true) */
  isGroupMode: boolean;
  /** 현재 날짜 인덱스 (0-based) */
  currentDateIndex: number;
  /** 총 날짜 수 */
  totalDays: number;
  /** 이전 날짜 이동 가능 여부 */
  canGoPrev: boolean;
  /** 다음 날짜 이동 가능 여부 */
  canGoNext: boolean;
  /** 이전 날짜로 이동 */
  handlePrevDate: () => void;
  /** 다음 날짜로 이동 */
  handleNextDate: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 정산 상세 모달의 날짜 네비게이션 훅
 *
 * @description
 * - 그룹화된 정산에서 날짜 간 이동 로직 제공
 * - 2일 이상인 경우에만 그룹 모드 활성화
 * - 이전/다음 날짜로 이동 핸들러 제공
 *
 * @param workLog - 현재 표시 중인 근무 기록
 * @param groupedSettlement - 그룹화된 정산 정보
 * @param onDateChange - 날짜 변경 콜백
 * @returns 날짜 네비게이션 상태 및 핸들러
 *
 * @example
 * const {
 *   isGroupMode,
 *   currentDateIndex,
 *   totalDays,
 *   handlePrevDate,
 *   handleNextDate
 * } = useSettlementDateNavigation(workLog, groupedSettlement, onDateChange);
 */
export function useSettlementDateNavigation(
  workLog: WorkLog | null,
  groupedSettlement: GroupedSettlement | undefined,
  onDateChange?: (workLog: WorkLog) => void
): UseSettlementDateNavigationResult {
  // 그룹 모드 여부 (2일 이상일 때 활성화)
  const isGroupMode = !!groupedSettlement && groupedSettlement.dateRange.totalDays > 1;

  // 총 날짜 수
  const totalDays = groupedSettlement?.dateRange.totalDays ?? 1;

  // 현재 날짜 인덱스 계산
  const currentDateIndex = useMemo(() => {
    if (!isGroupMode || !workLog) return 0;
    const index = groupedSettlement!.dateRange.dates.indexOf(workLog.date);
    return index >= 0 ? index : 0;
  }, [isGroupMode, groupedSettlement, workLog]);

  // 이전/다음 이동 가능 여부
  const canGoPrev = isGroupMode && currentDateIndex > 0;
  const canGoNext = isGroupMode && currentDateIndex < totalDays - 1;

  // 이전 날짜로 이동
  const handlePrevDate = useCallback(() => {
    if (!canGoPrev || !groupedSettlement) return;

    const prevDate = groupedSettlement.dateRange.dates[currentDateIndex - 1];
    const prevWorkLog = groupedSettlement.originalWorkLogs.find((wl) => wl.date === prevDate);

    if (prevWorkLog && onDateChange) {
      onDateChange(prevWorkLog);
    }
  }, [canGoPrev, currentDateIndex, groupedSettlement, onDateChange]);

  // 다음 날짜로 이동
  const handleNextDate = useCallback(() => {
    if (!canGoNext || !groupedSettlement) return;

    const nextDate = groupedSettlement.dateRange.dates[currentDateIndex + 1];
    const nextWorkLog = groupedSettlement.originalWorkLogs.find((wl) => wl.date === nextDate);

    if (nextWorkLog && onDateChange) {
      onDateChange(nextWorkLog);
    }
  }, [canGoNext, currentDateIndex, groupedSettlement, onDateChange]);

  return {
    isGroupMode,
    currentDateIndex,
    totalDays,
    canGoPrev,
    canGoNext,
    handlePrevDate,
    handleNextDate,
  };
}
