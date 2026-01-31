/**
 * UNIQN Mobile - Tab Filters Store
 *
 * @description 탭별 필터 상태 관리 (탭 전환 시 필터 유지)
 * @version 1.0.0
 *
 * @example
 * ```tsx
 * // 구인구직 탭에서 필터 사용
 * const { jobFilters, setJobFilter, resetJobFilters } = useTabFiltersStore();
 *
 * // 필터 변경
 * setJobFilter('postingType', 'tournament');
 * setJobFilter('region', '서울');
 *
 * // 필터 초기화
 * resetJobFilters();
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type { PostingType, ApplicationStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 구인구직 탭 필터 상태
 */
export interface JobTabFilters {
  /** 공고 타입 (전체/일반/대회/고정) */
  postingType: PostingType | 'all';
  /** 지역 필터 */
  region: string | null;
  /** 역할 필터 */
  role: string | null;
  /** 검색어 */
  searchQuery: string;
  /** 정렬 기준 */
  sortBy: 'newest' | 'deadline' | 'salary';
}

/**
 * 내 공고 탭 필터 상태 (구인자용)
 */
export interface EmployerTabFilters {
  /** 공고 상태 (전체/모집중/마감) */
  status: 'all' | 'active' | 'closed';
}

/**
 * 스케줄 탭 필터 상태
 */
export interface ScheduleTabFilters {
  /** 보기 모드 */
  viewMode: 'calendar' | 'list';
  /** 상태 필터 */
  status: ApplicationStatus | 'all';
}

interface TabFiltersState {
  // 필터 상태
  jobFilters: JobTabFilters;
  employerFilters: EmployerTabFilters;
  scheduleFilters: ScheduleTabFilters;

  // 구인구직 탭 액션
  setJobFilter: <K extends keyof JobTabFilters>(key: K, value: JobTabFilters[K]) => void;
  setJobFilters: (filters: Partial<JobTabFilters>) => void;
  resetJobFilters: () => void;

  // 내 공고 탭 액션
  setEmployerFilter: <K extends keyof EmployerTabFilters>(key: K, value: EmployerTabFilters[K]) => void;
  resetEmployerFilters: () => void;

  // 스케줄 탭 액션
  setScheduleFilter: <K extends keyof ScheduleTabFilters>(key: K, value: ScheduleTabFilters[K]) => void;
  resetScheduleFilters: () => void;

  // 전체 초기화
  resetAllFilters: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_JOB_FILTERS: JobTabFilters = {
  postingType: 'all',
  region: null,
  role: null,
  searchQuery: '',
  sortBy: 'newest',
};

const DEFAULT_EMPLOYER_FILTERS: EmployerTabFilters = {
  status: 'all',
};

const DEFAULT_SCHEDULE_FILTERS: ScheduleTabFilters = {
  viewMode: 'calendar',
  status: 'all',
};

// ============================================================================
// Store
// ============================================================================

export const useTabFiltersStore = create<TabFiltersState>()(
  persist(
    (set, _get) => ({
      // 초기 상태
      jobFilters: { ...DEFAULT_JOB_FILTERS },
      employerFilters: { ...DEFAULT_EMPLOYER_FILTERS },
      scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS },

      // 구인구직 탭 액션
      setJobFilter: (key, value) => {
        set((state) => ({
          jobFilters: { ...state.jobFilters, [key]: value },
        }));
      },

      setJobFilters: (filters) => {
        set((state) => ({
          jobFilters: { ...state.jobFilters, ...filters },
        }));
      },

      resetJobFilters: () => {
        set({ jobFilters: { ...DEFAULT_JOB_FILTERS } });
      },

      // 내 공고 탭 액션
      setEmployerFilter: (key, value) => {
        set((state) => ({
          employerFilters: { ...state.employerFilters, [key]: value },
        }));
      },

      resetEmployerFilters: () => {
        set({ employerFilters: { ...DEFAULT_EMPLOYER_FILTERS } });
      },

      // 스케줄 탭 액션
      setScheduleFilter: (key, value) => {
        set((state) => ({
          scheduleFilters: { ...state.scheduleFilters, [key]: value },
        }));
      },

      resetScheduleFilters: () => {
        set({ scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS } });
      },

      // 전체 초기화
      resetAllFilters: () => {
        set({
          jobFilters: { ...DEFAULT_JOB_FILTERS },
          employerFilters: { ...DEFAULT_EMPLOYER_FILTERS },
          scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS },
        });
      },
    }),
    {
      name: 'uniqn-tab-filters',
      storage: createJSONStorage(() => mmkvStorage),
      // 검색어는 저장하지 않음 (세션별 초기화)
      partialize: (state) => ({
        jobFilters: {
          ...state.jobFilters,
          searchQuery: '', // 검색어는 저장 제외
        },
        employerFilters: state.employerFilters,
        scheduleFilters: state.scheduleFilters,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * 구인구직 탭 필터만 선택
 */
export const useJobFilters = () => useTabFiltersStore((state) => state.jobFilters);

/**
 * 내 공고 탭 필터만 선택
 */
export const useEmployerFilters = () => useTabFiltersStore((state) => state.employerFilters);

/**
 * 스케줄 탭 필터만 선택
 */
export const useScheduleFilters = () => useTabFiltersStore((state) => state.scheduleFilters);

export default useTabFiltersStore;
