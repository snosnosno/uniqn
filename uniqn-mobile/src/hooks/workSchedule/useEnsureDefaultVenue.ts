/**
 * useEnsureDefaultVenue — 운영처 0개 워크스페이스에 기본 운영처 자동 생성(P1-1, 체감 2계층).
 *
 * 1가게 사장은 "운영처" 개념을 만나지 않도록, 그리드 첫 진입 시 컨테이너가 0개면
 * 기본 운영처를 자동 생성한다. 안전 근거:
 * - get_or_create_venue_container 는 멱등(동명 재호출=기존 반환) — 중복 생성 불가.
 * - 생성명은 defaultVenueName 이 만들며 RPC 와 동일한 1~50자 제약 안에 든다.
 * 실패 시 재발사하지 않는다(무한루프 가드) — 화면은 기존 수동 EmptyState 폴백으로 내려간다.
 * 생성 성공 후 목록 반영/선택은 useCreateVenueContainer(캐시 시드+무효화)와 화면 자기-치유가 담당.
 *
 * 2026-07-31(S1): **워크스페이스 이름 복사를 중단**했다. 기본 워크스페이스가 '내 팀' 이면
 * 지점도 '내 팀' 이 되어, 팀과 지점이 같은 이름으로 화면에 나란히 뜨는 상태였다. 둘은 다른
 * 축이므로 지점은 `{닉네임}의 지점` 으로 따로 짓는다(constants/defaultNames SSOT).
 */
import { useEffect, useRef } from 'react';
import { defaultVenueName } from '@/constants/defaultNames';
import { useCreateVenueContainer } from './useCreateVenueContainer';

export interface EnsureDefaultVenueInput {
  workspaceId?: string;
  /** 기본 지점명에 쓸 사용자 표시 이름(닉네임). 없으면 '내 지점' 으로 폴백한다. */
  displayName?: string | null;
  /** 컨테이너 조회가 성공적으로 끝났는가(로딩/에러 중 발사 금지). */
  isReady: boolean;
  /** 운영처가 0개인가. */
  isEmpty: boolean;
}

export function useEnsureDefaultVenue({
  workspaceId,
  displayName,
  isReady,
  isEmpty,
}: EnsureDefaultVenueInput): { isCreating: boolean } {
  const { mutate, isPending } = useCreateVenueContainer(workspaceId);
  // 워크스페이스별 1회 발사 가드 — 실패해도 재발사하지 않는다(수동 EmptyState 폴백).
  const firedWorkspacesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceId) return;
    if (!isReady || !isEmpty) return;
    if (firedWorkspacesRef.current.has(workspaceId)) return;
    firedWorkspacesRef.current.add(workspaceId);
    mutate(defaultVenueName(displayName));
  }, [workspaceId, displayName, isReady, isEmpty, mutate]);

  return { isCreating: isPending };
}

export default useEnsureDefaultVenue;
