/**
 * useDateFilter Hook
 *
 * DateFilterContext를 대체하는 호환성 레이어
 * - DateFilterStore (Zustand)와 TournamentDataContext 연동
 * - 기존 Context API와 100% 동일한 인터페이스 제공
 * - availableDates 자동 계산 (tournaments 변경 시)
 * - 기본 날짜 선택 로직 (초기 로드 시)
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import { useEffect } from 'react';
import { useDateFilterStore } from '../stores/dateFilterStore';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { logger } from '../utils/logger';
import { toISODateString } from '../utils/dateUtils';

/**
 * DateFilter Context API 호환 타입
 *
 * 기존 DateFilterContext.tsx와 동일한 인터페이스
 */
export interface DateFilterContextType {
  selectedDate: string; // YYYY-MM-DD 형식
  setSelectedDate: (date: string) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
  availableDates: string[]; // 토너먼트가 있는 날짜 목록 (정렬됨)
}

/**
 * DateFilter Hook
 *
 * DateFilterStore와 TournamentDataContext를 연동하여
 * 기존 Context API와 동일한 인터페이스를 제공합니다.
 *
 * @returns DateFilterContextType - 기존 Context API와 동일한 인터페이스
 *
 * @example
 * ```typescript
 * const { selectedDate, setSelectedDate, goToNextDate } = useDateFilter();
 * ```
 */
export const useDateFilter = (): DateFilterContextType => {
  const { tournaments } = useTournamentData();

  // Zustand selector 패턴: 개별 값/함수를 추출하여 안정적인 참조 유지
  const selectedDate = useDateFilterStore((state) => state.selectedDate);
  const availableDates = useDateFilterStore((state) => state.availableDates);
  const setSelectedDate = useDateFilterStore((state) => state.setSelectedDate);
  const setAvailableDates = useDateFilterStore((state) => state.setAvailableDates);
  const goToNextDate = useDateFilterStore((state) => state.goToNextDate);
  const goToPreviousDate = useDateFilterStore((state) => state.goToPreviousDate);
  const goToToday = useDateFilterStore((state) => state.goToToday);

  /**
   * availableDates 자동 계산
   *
   * tournaments 변경 시 dateKey 목록을 추출하여
   * 정렬 및 중복 제거 후 store에 저장
   */
  useEffect(() => {
    const dates = tournaments
      .map((t) => t.dateKey)
      .filter((dateKey) => dateKey) // 빈 dateKey 제외
      .sort(); // 오름차순 정렬

    // 중복 제거
    const uniqueDates = Array.from(new Set(dates));

    // 배열 내용이 동일하면 업데이트 스킵 (무한 루프 방지)
    const currentDates = useDateFilterStore.getState().availableDates;
    if (JSON.stringify(uniqueDates) === JSON.stringify(currentDates)) {
      return;
    }

    setAvailableDates(uniqueDates);
  }, [tournaments, setAvailableDates]);

  /**
   * 기본 날짜 선택 로직
   *
   * availableDates 변경 시 실행:
   * 1. localStorage 복원 (Zustand persist가 자동 처리)
   * 2. 복원 실패 시 기본 날짜 선택
   *    - 오늘 날짜가 목록에 있으면 선택
   *    - 없으면 가장 가까운 미래 날짜
   *    - 미래 날짜 없으면 마지막 날짜
   *
   * ⚠️ 무한루프 방지: selectedDate를 의존성에서 제거하고 getState()로 현재 값 확인
   */
  useEffect(() => {
    if (availableDates.length === 0) return;

    // getState()로 현재 selectedDate 확인 (의존성 배열에서 제거하여 무한루프 방지)
    const currentSelectedDate = useDateFilterStore.getState().selectedDate;

    // localStorage에서 복원된 날짜가 목록에 있으면 유지
    if (currentSelectedDate && availableDates.includes(currentSelectedDate)) {
      logger.info('날짜 선택 유지됨 (localStorage 복원)', {
        component: 'useDateFilter',
        data: { selectedDate: currentSelectedDate },
      });
      return;
    }

    // 복원 실패 또는 목록에 없으면 기본 날짜 선택
    const today = toISODateString(new Date()) || '';

    if (availableDates.includes(today)) {
      // 오늘 날짜가 목록에 있으면 선택
      setSelectedDate(today);
      logger.info('날짜 선택 초기화 (오늘)', {
        component: 'useDateFilter',
        data: { selectedDate: today },
      });
    } else {
      // 오늘 날짜가 없으면 가장 가까운 미래 날짜 선택
      const futureDates = availableDates.filter((date) => date >= today);
      const defaultDate = futureDates[0] || availableDates[availableDates.length - 1] || '';

      if (defaultDate) {
        setSelectedDate(defaultDate);
        logger.info('날짜 선택 초기화 (기본 날짜)', {
          component: 'useDateFilter',
          data: { selectedDate: defaultDate },
        });
      }
    }
  }, [availableDates, setSelectedDate]); // ✅ selectedDate 제거 - 무한루프 방지

  /**
   * Context API와 동일한 인터페이스 반환
   *
   * 기존 코드에서 import만 변경하면 동작
   */
  return {
    selectedDate,
    setSelectedDate,
    goToNextDate,
    goToPreviousDate,
    goToToday,
    availableDates,
  };
};

// DateFilterContextType은 위에서 이미 export됨 (line 25)
