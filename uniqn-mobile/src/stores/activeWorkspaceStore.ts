/**
 * UNIQN Mobile - Active Workspace Store
 *
 * @description 다중 워크스페이스 사용자가 현재 활성으로 보고 있는 워크스페이스 ID 를
 *              추적. zustand persist + mmkvStorage 로 앱 재시작 후에도 유지.
 *              (Phase 1B — workspace collaboration)
 *
 *              자동 자기-치유 (selectedId 가 listForUser 에 없으면 첫 번째로 fallback)
 *              은 useActiveWorkspace selector hook 에서 처리.
 * @version 1.0.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';

interface ActiveWorkspaceState {
  /** 사용자가 마지막으로 선택한 워크스페이스 ID. 미선택 또는 비로그인 시 null. */
  activeWorkspaceId: string | null;
  /** Hydration 완료 여부 */
  _hasHydrated: boolean;
}

interface ActiveWorkspaceActions {
  setActiveWorkspaceId: (id: string | null) => void;
  clear: () => void;
  setHasHydrated: (state: boolean) => void;
}

type ActiveWorkspaceStore = ActiveWorkspaceState & ActiveWorkspaceActions;

export const useActiveWorkspaceStore = create<ActiveWorkspaceStore>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      _hasHydrated: false,
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      clear: () => set({ activeWorkspaceId: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'uniqn-active-workspace',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        logger.debug('활성 워크스페이스 스토어 복원 완료', {
          activeWorkspaceId: state?.activeWorkspaceId ?? null,
        });
      },
    }
  )
);

export const selectActiveWorkspaceId = (state: ActiveWorkspaceStore) => state.activeWorkspaceId;
export const selectSetActiveWorkspaceId = (state: ActiveWorkspaceStore) =>
  state.setActiveWorkspaceId;
