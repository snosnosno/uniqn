/**
 * DateFilterContext - 날짜 선택 상태 관리 Context
 *
 * 테이블 관리 및 참가자 관리 페이지에서 날짜별 토너먼트 필터링을 위한
 * 날짜 선택 상태를 페이지 간 공유하고 localStorage에 저장합니다.
 *
 * 주요 특징:
 * - 선택된 날짜 상태 관리
 * - localStorage 자동 저장/복원
 * - 기본 날짜 자동 선택 (오늘 → 가장 가까운 토너먼트)
 * - 빠른 이동 함수 제공
 *
 * @version 1.0
 * @since 2025-10-17
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTournamentData } from './TournamentDataContext';
import { logger } from '../utils/logger';

interface DateFilterContextType {
  selectedDate: string; // YYYY-MM-DD 형식
  setSelectedDate: (date: string) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
  availableDates: string[]; // 토너먼트가 있는 날짜 목록
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

const STORAGE_KEY = 'tournament_selected_date';

export const DateFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tournaments } = useTournamentData();
  const [selectedDate, setSelectedDateState] = useState<string>('');

  // 토너먼트가 있는 날짜 목록 생성 (dateKey 기준)
  const availableDates = React.useMemo(() => {
    const dates = tournaments
      .map(t => t.dateKey)
      .filter(dateKey => dateKey) // 빈 dateKey 제외
      .sort(); // 오름차순 정렬

    // 중복 제거
    return Array.from(new Set(dates));
  }, [tournaments]);

  // 초기 날짜 설정
  useEffect(() => {
    if (availableDates.length === 0) return;

    // localStorage에서 마지막 선택 날짜 복원 시도
    const savedDate = localStorage.getItem(STORAGE_KEY);
    if (savedDate && availableDates.includes(savedDate)) {
      setSelectedDateState(savedDate);
      logger.info('날짜 선택 복원됨', {
        component: 'DateFilterContext',
        data: { savedDate }
      });
      return;
    }

    // 복원 실패 시 기본 날짜 설정
    const today = new Date().toISOString().split('T')[0] || '';
    if (availableDates.includes(today)) {
      // 오늘 날짜에 토너먼트가 있으면 선택
      setSelectedDateState(today);
    } else {
      // 오늘 날짜에 토너먼트가 없으면 가장 가까운 미래 날짜 선택
      const futureDates = availableDates.filter(date => date >= today);
      const defaultDate = futureDates[0] || availableDates[availableDates.length - 1] || '';
      setSelectedDateState(defaultDate);
    }
  }, [availableDates]);

  // 날짜 변경 시 localStorage에 저장
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    localStorage.setItem(STORAGE_KEY, date);
    logger.info('날짜 선택 변경됨', {
      component: 'DateFilterContext',
      data: { selectedDate: date }
    });
  }, []);

  // 다음 날짜로 이동
  const goToNextDate = useCallback(() => {
    if (!selectedDate) return;

    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex === -1 || currentIndex === availableDates.length - 1) return;

    const nextDate = availableDates[currentIndex + 1];
    if (nextDate) {
      setSelectedDate(nextDate);
    }
  }, [selectedDate, availableDates, setSelectedDate]);

  // 이전 날짜로 이동
  const goToPreviousDate = useCallback(() => {
    if (!selectedDate) return;

    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex <= 0) return;

    const prevDate = availableDates[currentIndex - 1];
    if (prevDate) {
      setSelectedDate(prevDate);
    }
  }, [selectedDate, availableDates, setSelectedDate]);

  // 오늘 날짜로 이동
  const goToToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0] || '';
    if (availableDates.includes(today)) {
      setSelectedDate(today);
    } else {
      // 오늘 날짜에 토너먼트가 없으면 가장 가까운 미래 날짜로 이동
      const futureDates = availableDates.filter(date => date >= today);
      const nearestDate = futureDates[0] || availableDates[availableDates.length - 1];
      if (nearestDate) {
        setSelectedDate(nearestDate);
      }
    }
  }, [availableDates, setSelectedDate]);

  return (
    <DateFilterContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        goToNextDate,
        goToPreviousDate,
        goToToday,
        availableDates,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};

/**
 * Context Hook
 *
 * DateFilterProvider 내부에서만 사용 가능
 *
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 */
export const useDateFilter = (): DateFilterContextType => {
  const context = useContext(DateFilterContext);

  if (!context) {
    throw new Error(
      'useDateFilter must be used within DateFilterProvider. ' +
      'Make sure your component is wrapped with <DateFilterProvider>.'
    );
  }

  return context;
};

export { DateFilterContext };
export type { DateFilterContextType };
