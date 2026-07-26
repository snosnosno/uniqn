/**
 * UNIQN Mobile - 구인구직 브라우즈 필터 스토어
 *
 * @description 구인구직 탭의 지역/역할/급여 필터 선택 + 최근 지역을 MMKV 로 영속화한다.
 * 지역 선택 단위는 지역 토큰(RegionToken = slug | 'group:서울') — 모델은 utils/regionSelection.
 * 역할은 FILTERABLE_STAFF_ROLES(5종, 'other' 제외), 급여는 타입 + (최소금액 | 정렬) 조합.
 * 작성 폼 등 다른 접점도 최근 지역을 공유할 수 있도록 화면 상태가 아닌 스토어로 둔다.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { sanitizeRegionTokens, type RegionToken } from '@/utils/regionSelection';
import { isFilterableStaffRole, type StaffRole } from '@/types/role';
import type { FilterableSalaryType, SalarySortDirection } from '@/types/jobPosting';

const MAX_RECENT_REGIONS = 3;

const FILTERABLE_SALARY_TYPES: readonly FilterableSalaryType[] = ['hourly', 'daily', 'monthly'];

const SALARY_SORT_DIRECTIONS: readonly SalarySortDirection[] = ['high', 'low'];

export interface SalaryFilter {
  type: FilterableSalaryType;
  /** 최소 금액(원) — salary_*_max ≥ min 매칭. null 이면 금액 조건 없음(정렬만) */
  min: number | null;
  /** 정렬 방향 — null 이면 기본(work_date) 정렬 유지 */
  sort: SalarySortDirection | null;
}

interface JobFilterState {
  /** 적용 중인 지역 필터 토큰 (빈 배열 = 지역 전체) */
  regionTokens: RegionToken[];
  /** 최근 적용한 지역 토큰 — 시트 상단 바로가기 칩 (최대 3) */
  recentRegionTokens: RegionToken[];
  /** 적용 중인 역할 필터 (빈 배열 = 역할 전체, 'other' 비지원) */
  roleFilters: StaffRole[];
  /** 적용 중인 급여 필터 (null = 급여 전체) */
  salaryFilter: SalaryFilter | null;
  /** 지역 필터 적용 — 선택을 교체하고 최근 목록에 반영 */
  applyRegionTokens: (tokens: RegionToken[]) => void;
  clearRegionFilter: () => void;
  /** 역할 필터 적용 — 선택을 교체 (유효 역할만 반영) */
  applyRoleFilters: (roles: StaffRole[]) => void;
  clearRoleFilter: () => void;
  /** 급여 필터 적용 (null 전달 시 해제) */
  applySalaryFilter: (filter: SalaryFilter | null) => void;
  clearSalaryFilter: () => void;
  /** 모든 필터 해제 (최근 지역은 유지) */
  clearAllFilters: () => void;
}

function pushRecent(recent: RegionToken[], applied: RegionToken[]): RegionToken[] {
  if (applied.length === 0) return recent;
  const merged = [...applied, ...recent.filter((t) => !applied.includes(t))];
  return merged.slice(0, MAX_RECENT_REGIONS);
}

/** persist 복원/외부 입력 방어 — 유효 역할만 남기고 중복 제거 */
export function sanitizeRoleFilters(roles: unknown): StaffRole[] {
  if (!Array.isArray(roles)) return [];
  const seen = new Set<StaffRole>();
  const result: StaffRole[] = [];
  for (const role of roles) {
    if (isFilterableStaffRole(role) && !seen.has(role)) {
      seen.add(role);
      result.push(role);
    }
  }
  return result;
}

/**
 * persist 복원/외부 입력 방어 — 유효한 타입 + (금액 | 정렬) 중 최소 하나가 있어야 통과.
 * 금액·정렬이 모두 비면 "급여 조건 없음"과 동치라 null 로 접는다.
 */
export function sanitizeSalaryFilter(filter: unknown): SalaryFilter | null {
  if (typeof filter !== 'object' || filter === null) return null;
  const { type, min, sort } = filter as { type?: unknown; min?: unknown; sort?: unknown };
  if (!FILTERABLE_SALARY_TYPES.includes(type as FilterableSalaryType)) return null;
  const validMin =
    typeof min === 'number' && Number.isFinite(min) && min > 0 ? Math.floor(min) : null;
  const validSort = SALARY_SORT_DIRECTIONS.includes(sort as SalarySortDirection)
    ? (sort as SalarySortDirection)
    : null;
  if (validMin === null && validSort === null) return null;
  return { type: type as FilterableSalaryType, min: validMin, sort: validSort };
}

export const useJobFilterStore = create<JobFilterState>()(
  persist(
    (set, get) => ({
      regionTokens: [],
      recentRegionTokens: [],
      roleFilters: [],
      salaryFilter: null,

      applyRegionTokens: (tokens: RegionToken[]) => {
        const sanitized = sanitizeRegionTokens(tokens);
        set({
          regionTokens: sanitized,
          recentRegionTokens: pushRecent(get().recentRegionTokens, sanitized),
        });
      },

      clearRegionFilter: () => {
        set({ regionTokens: [] });
      },

      applyRoleFilters: (roles: StaffRole[]) => {
        set({ roleFilters: sanitizeRoleFilters(roles) });
      },

      clearRoleFilter: () => {
        set({ roleFilters: [] });
      },

      applySalaryFilter: (filter: SalaryFilter | null) => {
        set({ salaryFilter: sanitizeSalaryFilter(filter) });
      },

      clearSalaryFilter: () => {
        set({ salaryFilter: null });
      },

      clearAllFilters: () => {
        set({ regionTokens: [], roleFilters: [], salaryFilter: null });
      },
    }),
    {
      name: 'uniqn-job-filter',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        regionTokens: state.regionTokens,
        recentRegionTokens: state.recentRegionTokens,
        roleFilters: state.roleFilters,
        salaryFilter: state.salaryFilter,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 지역/역할 상수 개편·저장 손상 대비 — 복원 값은 항상 유효 값으로 정화.
        // ⚠️ queueMicrotask 는 필수: MMKV 동기 hydration 은 create() 반환 전에 이 콜백을
        // 실행하므로, 즉시 useJobFilterStore 를 참조하면 TDZ ReferenceError 로 크래시한다.
        queueMicrotask(() => {
          useJobFilterStore.setState({
            regionTokens: sanitizeRegionTokens(state.regionTokens),
            recentRegionTokens: sanitizeRegionTokens(state.recentRegionTokens),
            roleFilters: sanitizeRoleFilters(state.roleFilters),
            salaryFilter: sanitizeSalaryFilter(state.salaryFilter),
          });
        });
      },
    }
  )
);
