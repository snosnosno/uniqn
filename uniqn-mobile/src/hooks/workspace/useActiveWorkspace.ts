/**
 * UNIQN Mobile - useActiveWorkspace Hook
 *
 * @description 다중 워크스페이스 — store 의 activeWorkspaceId 를 listForUser 결과와
 *              매칭하고 자동 자기-치유 (orphan id → 첫 번째로 fallback) 수행.
 *              (Phase 1B — workspace collaboration)
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useWorkspaces } from './useWorkspaces';
import {
  useActiveWorkspaceStore,
  selectActiveWorkspaceId,
  selectSetActiveWorkspaceId,
} from '@/stores/activeWorkspaceStore';
import type { Workspace } from '@/types/workspace';

export interface UseActiveWorkspaceResult {
  activeWorkspace: Workspace | undefined;
  /** 사용자가 속한 모든 워크스페이스 (소유 + 멤버) */
  workspaces: Workspace[];
  isLoading: boolean;
  /** 최초 로딩 이후 재조회 포함 진행 중 상태 (자동 생성 후 refetch 창 플래시 방지용). */
  isFetching: boolean;
  /** 워크스페이스 목록 조회 실패 여부 (성공-빈목록 vs 에러 구분용). */
  isError: boolean;
  /** 사용자가 활성 워크스페이스 변경 */
  setActiveWorkspaceId: (id: string | null) => void;
  /** 워크스페이스 목록 재조회 (조회 실패 시 수동 재시도용). */
  refetch: () => void;
}

/**
 * 활성 워크스페이스 selector hook.
 *
 * - store 에 activeWorkspaceId 가 없거나, 사용자가 더 이상 속하지 않는 워크스페이스를
 *   가리키면 자동으로 listForUser 의 첫 번째로 fallback (회수당한 후 재로그인 시나리오 대응).
 * - workspaces.length === 0 인 동안에는 activeWorkspace = undefined.
 */
export function useActiveWorkspace(): UseActiveWorkspaceResult {
  const { workspaces, isLoading, isFetching, error, refetch } = useWorkspaces();
  const activeId = useActiveWorkspaceStore(selectActiveWorkspaceId);
  const setActiveWorkspaceId = useActiveWorkspaceStore(selectSetActiveWorkspaceId);

  useEffect(() => {
    if (workspaces.length === 0) return;
    const isOrphan = !activeId || !workspaces.some((w) => w.id === activeId);
    if (isOrphan) {
      setActiveWorkspaceId(workspaces[0]!.id);
    }
  }, [workspaces, activeId, setActiveWorkspaceId]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeId) ??
    (workspaces.length > 0 ? workspaces[0] : undefined);

  return {
    activeWorkspace,
    workspaces,
    isLoading,
    isFetching,
    isError: !!error,
    setActiveWorkspaceId,
    refetch,
  };
}
