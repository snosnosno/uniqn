/**
 * useEnsureDefaultVenue — 운영처 0개 워크스페이스에 기본 운영처 자동 생성(P1-1, 체감 2계층).
 *
 * 1가게 사장은 "운영처" 개념을 만나지 않도록, 그리드 첫 진입 시 컨테이너가 0개면
 * 워크스페이스 이름으로 기본 운영처를 자동 생성한다. 안전 근거:
 * - get_or_create_venue_container 는 멱등(동명 재호출=기존 반환) — 중복 생성 불가.
 * - 워크스페이스명은 생성 시 동일 xssValidation(1~50자)을 통과했으므로 이름 검증 통과 보장.
 * 실패 시 재발사하지 않는다(무한루프 가드) — 화면은 기존 수동 EmptyState 폴백으로 내려간다.
 * 생성 성공 후 목록 반영/선택은 useCreateVenueContainer(캐시 시드+무효화)와 화면 자기-치유가 담당.
 */
import { useEffect, useRef } from 'react';
import { useCreateVenueContainer } from './useCreateVenueContainer';

export interface EnsureDefaultVenueInput {
  workspaceId?: string;
  workspaceName?: string;
  /** 컨테이너 조회가 성공적으로 끝났는가(로딩/에러 중 발사 금지). */
  isReady: boolean;
  /** 운영처가 0개인가. */
  isEmpty: boolean;
}

export function useEnsureDefaultVenue({
  workspaceId,
  workspaceName,
  isReady,
  isEmpty,
}: EnsureDefaultVenueInput): { isCreating: boolean } {
  const { mutate, isPending } = useCreateVenueContainer(workspaceId);
  // 워크스페이스별 1회 발사 가드 — 실패해도 재발사하지 않는다(수동 EmptyState 폴백).
  const firedWorkspacesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceId || !workspaceName) return;
    if (!isReady || !isEmpty) return;
    if (firedWorkspacesRef.current.has(workspaceId)) return;
    firedWorkspacesRef.current.add(workspaceId);
    mutate(workspaceName);
  }, [workspaceId, workspaceName, isReady, isEmpty, mutate]);

  return { isCreating: isPending };
}

export default useEnsureDefaultVenue;
