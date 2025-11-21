/**
 * Zustand DateFilterStore
 *
 * DateFilterContext를 대체하는 날짜 필터 상태 관리 Store
 * - 선택된 날짜 관리 (selectedDate)
 * - 토너먼트 가능 날짜 목록 관리 (availableDates)
 * - localStorage 자동 persistence (Zustand persist middleware)
 * - immer 미들웨어로 불변성 자동 처리
 * - devtools 미들웨어로 Redux DevTools 연동
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { logger } from '../utils/logger';
import { toISODateString } from '../utils/dateUtils';

/**
 * DateFilterStore State
 */
interface DateFilterState {
  selectedDate: string;      // YYYY-MM-DD 형식, 빈 문자열 가능
  availableDates: string[];  // YYYY-MM-DD 목록, 정렬되어야 함
}

/**
 * DateFilterStore Actions
 */
interface DateFilterActions {
  setSelectedDate: (date: string) => void;
  setAvailableDates: (dates: string[]) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
}

/**
 * DateFilterStore 전체 타입
 */
export type DateFilterStore = DateFilterState & DateFilterActions;

/**
 * Zustand Store 생성
 *
 * Middleware 순서: devtools → persist → immer
 * - devtools: Redux DevTools 연동 (개발 환경에서만 활성화)
 * - persist: localStorage 자동 저장/복원 (selectedDate만 저장)
 * - immer: 불변성 자동 처리 (draft 상태 수정 가능)
 */
export const useDateFilterStore = create<DateFilterStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ========== 초기 상태 ==========
        selectedDate: '',
        availableDates: [],

        // ========== Actions ==========

        /**
         * 선택된 날짜 변경
         *
         * localStorage에 자동 저장됨 (persist middleware)
         *
         * @param date - YYYY-MM-DD 형식 문자열 또는 빈 문자열
         */
        setSelectedDate: (date: string) => {
          set({ selectedDate: date });
          logger.info('날짜 선택 변경됨', {
            component: 'DateFilterStore',
            data: { selectedDate: date },
          });
        },

        /**
         * 사용 가능한 날짜 목록 업데이트
         *
         * localStorage에는 저장되지 않음 (partialize 설정)
         * useDateFilter Hook에서 tournaments 변경 시 자동 호출
         *
         * @param dates - YYYY-MM-DD 형식 문자열 배열
         */
        setAvailableDates: (dates: string[]) => {
          set({ availableDates: dates });
        },

        /**
         * 다음 날짜로 이동
         *
         * availableDates 목록에서 다음 인덱스로 이동
         * 마지막 날짜거나 목록에 없으면 무시
         */
        goToNextDate: () => {
          const { selectedDate, availableDates } = get();
          if (!selectedDate) return;

          const currentIndex = availableDates.indexOf(selectedDate);
          if (currentIndex === -1 || currentIndex === availableDates.length - 1) {
            // 목록에 없거나 마지막 날짜면 무시
            return;
          }

          const nextDate = availableDates[currentIndex + 1];
          if (nextDate) {
            set({ selectedDate: nextDate });
            logger.info('날짜 선택 변경됨 (다음)', {
              component: 'DateFilterStore',
              data: { selectedDate: nextDate },
            });
          }
        },

        /**
         * 이전 날짜로 이동
         *
         * availableDates 목록에서 이전 인덱스로 이동
         * 첫 번째 날짜거나 목록에 없으면 무시
         */
        goToPreviousDate: () => {
          const { selectedDate, availableDates } = get();
          if (!selectedDate) return;

          const currentIndex = availableDates.indexOf(selectedDate);
          if (currentIndex <= 0) {
            // 목록에 없거나 첫 번째 날짜면 무시
            return;
          }

          const prevDate = availableDates[currentIndex - 1];
          if (prevDate) {
            set({ selectedDate: prevDate });
            logger.info('날짜 선택 변경됨 (이전)', {
              component: 'DateFilterStore',
              data: { selectedDate: prevDate },
            });
          }
        },

        /**
         * 오늘 날짜로 이동
         *
         * 오늘 날짜가 availableDates에 있으면 선택
         * 없으면 가장 가까운 미래 날짜 선택
         * 미래 날짜 없으면 마지막 날짜 선택
         */
        goToToday: () => {
          const { availableDates } = get();
          if (availableDates.length === 0) return;

          const today = toISODateString(new Date()) || '';

          if (availableDates.includes(today)) {
            // 오늘 날짜가 목록에 있으면 선택
            set({ selectedDate: today });
            logger.info('날짜 선택 변경됨 (오늘)', {
              component: 'DateFilterStore',
              data: { selectedDate: today },
            });
          } else {
            // 오늘 날짜가 없으면 가장 가까운 미래 날짜 선택
            const futureDates = availableDates.filter(date => date >= today);
            const nearestDate = futureDates[0] || availableDates[availableDates.length - 1];

            if (nearestDate) {
              set({ selectedDate: nearestDate });
              logger.info('날짜 선택 변경됨 (가장 가까운 날짜)', {
                component: 'DateFilterStore',
                data: { selectedDate: nearestDate },
              });
            }
          }
        },
      })),
      {
        name: 'date-filter-storage',        // localStorage 키
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          selectedDate: state.selectedDate  // selectedDate만 localStorage에 저장
        }),
      }
    ),
    {
      name: 'DateFilterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
