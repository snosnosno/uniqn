/**
 * UNIQN Mobile - useWorkspaceRevocationGuard Tests
 *
 * @description Phase 1A — editor 가 회수당했을 때 onRevoked 콜백 호출.
 *              false-positive 방지 가드 (isFetched / isError / workspaceId 변경 시 ref 리셋)
 *              모두 검증.
 */

import { renderHook } from '@testing-library/react-native';

import { useWorkspaceRevocationGuard } from '../useWorkspaceRevocationGuard';

const mockCreateRealtimeSubscription = jest.fn();

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...args: unknown[]) => mockCreateRealtimeSubscription(...args),
}));

interface Member {
  userId: string;
}

const m = (userId: string): Member => ({ userId });

describe('useWorkspaceRevocationGuard', () => {
  beforeEach(() => {
    mockCreateRealtimeSubscription.mockReset();
    mockCreateRealtimeSubscription.mockReturnValue(() => {
      /* unsubscribe noop */
    });
  });

  describe('fetch fallback diff', () => {
    it('현재 활성 워크스페이스에서 회수되면 onRevoked 콜백 호출', () => {
      const onRevoked = jest.fn();
      const { rerender } = renderHook(
        ({ members }: { members: Member[] }) =>
          useWorkspaceRevocationGuard({
            activeWorkspaceId: 'ws-1',
            currentUserId: 'editor-1',
            members,
            isOwner: false,
            isFetched: true,
            isError: false,
            onRevoked,
          }),
        {
          initialProps: { members: [m('editor-1')] },
        }
      );

      rerender({ members: [] });

      expect(onRevoked).toHaveBeenCalledTimes(1);
    });

    it('처음부터 멤버가 아니면 onRevoked 호출 안 함', () => {
      const onRevoked = jest.fn();
      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('other')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );
      expect(onRevoked).not.toHaveBeenCalled();
    });

    it('owner 본인은 onRevoked 호출 안 함', () => {
      const onRevoked = jest.fn();
      const { rerender } = renderHook(
        ({ members }: { members: Member[] }) =>
          useWorkspaceRevocationGuard({
            activeWorkspaceId: 'ws-1',
            currentUserId: 'owner-1',
            members,
            isOwner: true,
            isFetched: true,
            isError: false,
            onRevoked,
          }),
        { initialProps: { members: [m('owner-1')] } }
      );

      rerender({ members: [] });

      expect(onRevoked).not.toHaveBeenCalled();
    });
  });

  describe('false-positive 가드 (E5)', () => {
    it('isError=true 면 비교 건너뛰기 (네트워크 단절 false-positive 방지)', () => {
      const onRevoked = jest.fn();
      const { rerender } = renderHook(
        ({ members, isError }: { members: Member[]; isError: boolean }) =>
          useWorkspaceRevocationGuard({
            activeWorkspaceId: 'ws-1',
            currentUserId: 'editor-1',
            members,
            isOwner: false,
            isFetched: true,
            isError,
            onRevoked,
          }),
        {
          initialProps: { members: [m('editor-1')], isError: false },
        }
      );

      // 네트워크 에러 발생 → members 가 빈 배열이지만 isError=true
      rerender({ members: [], isError: true });

      expect(onRevoked).not.toHaveBeenCalled();
    });

    it('isFetched=false 면 비교 건너뛰기 (첫 로딩 false-positive 방지)', () => {
      const onRevoked = jest.fn();
      const { rerender } = renderHook(
        ({ members, isFetched }: { members: Member[]; isFetched: boolean }) =>
          useWorkspaceRevocationGuard({
            activeWorkspaceId: 'ws-1',
            currentUserId: 'editor-1',
            members,
            isOwner: false,
            isFetched,
            isError: false,
            onRevoked,
          }),
        {
          initialProps: { members: [], isFetched: false },
        }
      );

      // 로딩 중 빈 배열이 도착하더라도 비교 안 함
      rerender({ members: [], isFetched: false });

      expect(onRevoked).not.toHaveBeenCalled();
    });

    it('workspaceId 가 바뀌면 ref 리셋 — 새 워크스페이스에서 빈 멤버 시 false-positive 방지', () => {
      const onRevoked = jest.fn();
      const { rerender } = renderHook(
        ({ workspaceId, members }: { workspaceId: string; members: Member[] }) =>
          useWorkspaceRevocationGuard({
            activeWorkspaceId: workspaceId,
            currentUserId: 'editor-1',
            members,
            isOwner: false,
            isFetched: true,
            isError: false,
            onRevoked,
          }),
        {
          initialProps: { workspaceId: 'ws-1', members: [m('editor-1')] },
        }
      );

      // 워크스페이스 전환 — wasMemberRef 리셋되어야 함
      rerender({ workspaceId: 'ws-2', members: [] });

      // 새 워크스페이스 ws-2 에서는 처음부터 멤버 아님 → false-positive 발생하면 안 됨
      expect(onRevoked).not.toHaveBeenCalled();
    });
  });

  describe('realtime DELETE 구독', () => {
    it('owner 가 아니면 realtime 구독 시작', () => {
      const onRevoked = jest.fn();
      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('editor-1')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );

      expect(mockCreateRealtimeSubscription).toHaveBeenCalledWith(
        'workspace_members',
        'workspace_id=eq.ws-1',
        expect.any(Function)
      );
    });

    it('owner 면 realtime 구독 시작 안 함', () => {
      const onRevoked = jest.fn();
      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'owner-1',
          members: [m('owner-1')],
          isOwner: true,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );

      expect(mockCreateRealtimeSubscription).not.toHaveBeenCalled();
    });

    it('realtime DELETE 페이로드의 user_id 가 currentUserId 와 같으면 onRevoked 호출', () => {
      const onRevoked = jest.fn();
      let capturedCallback:
        | ((payload: { eventType: string; old?: { user_id?: string } }) => void)
        | undefined;
      mockCreateRealtimeSubscription.mockImplementation(
        (_table: string, _filter: string, cb: typeof capturedCallback) => {
          capturedCallback = cb;
          return () => {
            /* unsubscribe noop */
          };
        }
      );

      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('editor-1')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );

      capturedCallback?.({ eventType: 'DELETE', old: { user_id: 'editor-1' } });
      expect(onRevoked).toHaveBeenCalledTimes(1);
    });

    it('realtime DELETE 페이로드의 user_id 가 다른 사용자면 onRevoked 호출 안 함', () => {
      const onRevoked = jest.fn();
      let capturedCallback:
        | ((payload: { eventType: string; old?: { user_id?: string } }) => void)
        | undefined;
      mockCreateRealtimeSubscription.mockImplementation(
        (_table: string, _filter: string, cb: typeof capturedCallback) => {
          capturedCallback = cb;
          return () => {
            /* unsubscribe noop */
          };
        }
      );

      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('editor-1')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );

      capturedCallback?.({ eventType: 'DELETE', old: { user_id: 'other-editor' } });
      expect(onRevoked).not.toHaveBeenCalled();
    });

    it('realtime UPDATE 이벤트는 무시 (DELETE 만 트리거)', () => {
      const onRevoked = jest.fn();
      let capturedCallback:
        | ((payload: { eventType: string; old?: { user_id?: string } }) => void)
        | undefined;
      mockCreateRealtimeSubscription.mockImplementation(
        (_table: string, _filter: string, cb: typeof capturedCallback) => {
          capturedCallback = cb;
          return () => {
            /* unsubscribe noop */
          };
        }
      );

      renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('editor-1')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked,
        })
      );

      capturedCallback?.({ eventType: 'UPDATE', old: { user_id: 'editor-1' } });
      expect(onRevoked).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('unmount 시 unsubscribe 호출', () => {
      const unsubscribe = jest.fn();
      mockCreateRealtimeSubscription.mockReturnValue(unsubscribe);
      const { unmount } = renderHook(() =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: 'ws-1',
          currentUserId: 'editor-1',
          members: [m('editor-1')],
          isOwner: false,
          isFetched: true,
          isError: false,
          onRevoked: jest.fn(),
        })
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
