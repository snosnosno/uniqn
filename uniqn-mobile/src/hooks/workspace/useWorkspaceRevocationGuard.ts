/**
 * UNIQN Mobile - useWorkspaceRevocationGuard
 *
 * @description editor 가 활성 워크스페이스에서 회수당했을 때 onRevoked 콜백을 호출.
 *              두 채널을 결합해 실시간성과 회복력을 모두 확보:
 *
 *              1. **Realtime DELETE 우선** — Supabase postgres_changes 가
 *                 `workspace_members` row 의 DELETE 를 즉시 감지. user_id 가
 *                 currentUserId 와 일치할 때만 트리거.
 *
 *              2. **Fetch diff fallback** — Realtime 은 at-most-once 라 missed 가능.
 *                 useWorkspaceMembers query 의 fetched 결과를 wasMember diff 로 비교.
 *                 단 다음 가드를 모두 통과해야 비교:
 *                 - `isFetched=true && !isError` (네트워크 단절 false-positive 방지 — E5 보안)
 *                 - 같은 workspaceId 안에서만 (workspaceId 변경 시 wasMemberRef 리셋)
 *
 *              3. **owner 면 비활성** — 자기 자신을 회수할 수 없음.
 *
 *              (Phase 1A — workspace collaboration)
 * @version 1.0.0
 */

import { useEffect, useRef } from 'react';
import { createRealtimeSubscription } from '@/utils/supabase';

interface MemberLike {
  userId: string;
}

export interface UseWorkspaceRevocationGuardArgs<M extends MemberLike = MemberLike> {
  activeWorkspaceId: string | undefined;
  currentUserId: string | undefined;
  /** useWorkspaceMembers 의 결과 (또는 동일 shape) */
  members: M[];
  /** 활성 워크스페이스의 owner 인지. true 면 회수 불가 → 모든 감지 비활성. */
  isOwner: boolean;
  /** TanStack Query isFetched — 첫 로딩 / 백그라운드 fetch 중 false. false 면 비교 skip. */
  isFetched: boolean;
  /** TanStack Query isError — 네트워크 단절 등 fetch 실패. true 면 비교 skip. */
  isError: boolean;
  /** 회수 감지 시 호출. layout 등 상위 컴포넌트가 Modal 표시 + signOut 트리거. */
  onRevoked: () => void;
}

export function useWorkspaceRevocationGuard<M extends MemberLike>(
  args: UseWorkspaceRevocationGuardArgs<M>
): void {
  const { activeWorkspaceId, currentUserId, members, isOwner, isFetched, isError, onRevoked } =
    args;
  const wasMemberRef = useRef<boolean>(false);
  // onRevoked 변경으로 effect 재실행되지 않도록 ref 로 lock
  const onRevokedRef = useRef(onRevoked);
  onRevokedRef.current = onRevoked;

  // 1) Realtime DELETE 구독 — owner 가 아닐 때만
  useEffect(() => {
    if (!activeWorkspaceId || !currentUserId || isOwner) return undefined;

    const unsubscribe = createRealtimeSubscription(
      'workspace_members',
      `workspace_id=eq.${activeWorkspaceId}`,
      (payload) => {
        if (payload.eventType !== 'DELETE') return;
        const oldRow = payload.old as { user_id?: string } | undefined;
        if (oldRow?.user_id === currentUserId) {
          onRevokedRef.current();
        }
      }
    );

    return unsubscribe;
  }, [activeWorkspaceId, currentUserId, isOwner]);

  // 2) Fetch diff fallback — 가드 통과 시에만 비교
  useEffect(() => {
    // owner / 비로그인 / 활성 워크스페이스 없음 → 비활성 + ref 리셋
    if (!activeWorkspaceId || !currentUserId || isOwner) {
      wasMemberRef.current = false;
      return;
    }

    // false-positive 방지 가드 (E5 보안)
    if (!isFetched || isError) return;

    const isCurrentlyMember = members.some((m) => m.userId === currentUserId);

    if (wasMemberRef.current && !isCurrentlyMember) {
      onRevokedRef.current();
    }

    wasMemberRef.current = isCurrentlyMember;
  }, [activeWorkspaceId, currentUserId, members, isOwner, isFetched, isError]);

  // 3) workspaceId 전환 시 ref 강제 리셋 (Switcher 사용자 대응)
  useEffect(() => {
    return () => {
      wasMemberRef.current = false;
    };
  }, [activeWorkspaceId]);
}
