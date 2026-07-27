/**
 * useEnsureDefaultWorkspace — 워크스페이스 0개 신규 employer에게 기본 워크스페이스 자동 보장.
 *
 * 배경: 운영처(venue) 생성·근무표는 workspace_id 를 전제한다. 공고 작성 경로엔
 * 안전망(workspaceService.getDefaultWorkspaceIdForOwner — 0개면 자동 생성)이 있으나,
 * 그리드 경로엔 없어 워크스페이스가 0개인 신규 employer 는 "운영처 만들기" 데드엔드
 * (workspaceId undefined → 생성 버튼 영구 비활성)에 빠진다. 이 훅이 그 안전망을 미러링한다.
 *
 * 안전 근거:
 * - 워크스페이스 조회가 "성공적으로 끝났고(로딩/에러 아님) 0개"일 때만 발사(isReady/isEmpty).
 *   → 로딩 실패로 인한 오탐 생성 차단(있는데 못 불러온 것을 "없음"으로 오인해 중복 생성 금지).
 * - 훅 인스턴스당 1회 발사 가드(Ref) → create_workspace RPC 는 멱등이 아니므로 중복 생성 방지.
 * - 성공 시 useCreateWorkspace 가 listForUser 무효화 → 목록 재조회 → activeWorkspace 채워짐.
 * 실패 시 재발사하지 않는다(무한루프 가드) — 화면은 명시적 "다시 시도" 폴백으로 내려간다.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useCreateWorkspace } from './useWorkspaces';

/** 신규 employer 기본 워크스페이스 이름 — 공고 경로 안전망(getDefaultWorkspaceIdForOwner)과 동일. */
const DEFAULT_WORKSPACE_NAME = '내 팀';

export interface EnsureDefaultWorkspaceInput {
  /** 워크스페이스 조회가 성공적으로 끝났는가(로딩/에러 중 발사 금지) + 상위 게이트(기능 플래그 등). */
  isReady: boolean;
  /** 사용자가 속한 워크스페이스가 0개인가. */
  isEmpty: boolean;
}

export interface EnsureDefaultWorkspaceResult {
  /** 자동/수동 생성 진행 중. */
  isCreating: boolean;
  /**
   * 수동 재생성 — 자동 생성이 실패해 워크스페이스가 여전히 0개일 때 사용자가 명시적으로 재시도.
   * 조회 실패(에러) 경로에는 사용 금지(있는데 못 불러온 경우 중복 생성 위험) — 그 경로는 refetch 를 쓴다.
   */
  retry: () => void;
}

export function useEnsureDefaultWorkspace({
  isReady,
  isEmpty,
}: EnsureDefaultWorkspaceInput): EnsureDefaultWorkspaceResult {
  const { mutate, isPending } = useCreateWorkspace();
  // 1회 발사 가드 — 실패해도 자동 재발사하지 않는다(수동 retry 폴백). create_workspace 는 멱등이 아니다.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isReady || !isEmpty) return;
    if (firedRef.current) return;
    firedRef.current = true;
    mutate(DEFAULT_WORKSPACE_NAME);
  }, [isReady, isEmpty, mutate]);

  const retry = useCallback(() => {
    firedRef.current = true; // 자동 발사 가드 유지(수동 트리거만 허용)
    mutate(DEFAULT_WORKSPACE_NAME);
  }, [mutate]);

  return { isCreating: isPending, retry };
}

export default useEnsureDefaultWorkspace;
