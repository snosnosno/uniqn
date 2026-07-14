/**
 * UNIQN Mobile - 구인구직 브라우즈 필터 스토어
 *
 * @description 구인구직 탭의 지역 필터 선택 + 최근 지역을 MMKV 로 영속화한다.
 * 선택 단위는 지역 토큰(RegionToken = slug | 'group:서울') — 모델은 utils/regionSelection.
 * 작성 폼 등 다른 접점도 최근 지역을 공유할 수 있도록 화면 상태가 아닌 스토어로 둔다.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { sanitizeRegionTokens, type RegionToken } from '@/utils/regionSelection';

const MAX_RECENT_REGIONS = 3;

interface JobFilterState {
  /** 적용 중인 지역 필터 토큰 (빈 배열 = 지역 전체) */
  regionTokens: RegionToken[];
  /** 최근 적용한 지역 토큰 — 시트 상단 바로가기 칩 (최대 3) */
  recentRegionTokens: RegionToken[];
  /** 지역 필터 적용 — 선택을 교체하고 최근 목록에 반영 */
  applyRegionTokens: (tokens: RegionToken[]) => void;
  clearRegionFilter: () => void;
}

function pushRecent(recent: RegionToken[], applied: RegionToken[]): RegionToken[] {
  if (applied.length === 0) return recent;
  const merged = [...applied, ...recent.filter((t) => !applied.includes(t))];
  return merged.slice(0, MAX_RECENT_REGIONS);
}

export const useJobFilterStore = create<JobFilterState>()(
  persist(
    (set, get) => ({
      regionTokens: [],
      recentRegionTokens: [],

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
    }),
    {
      name: 'uniqn-job-filter',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        regionTokens: state.regionTokens,
        recentRegionTokens: state.recentRegionTokens,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 지역 상수 개편/손상 대비 — 복원 값은 항상 유효 토큰으로 정화
        queueMicrotask(() => {
          useJobFilterStore.setState({
            regionTokens: sanitizeRegionTokens(state.regionTokens),
            recentRegionTokens: sanitizeRegionTokens(state.recentRegionTokens),
          });
        });
      },
    }
  )
);
