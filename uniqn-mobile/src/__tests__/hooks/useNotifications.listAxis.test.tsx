/**
 * 알림 "목록 축" 배선 검증 — 렌더 소스(React Query 캐시)가 실제로 바뀌는지 잠근다.
 *
 * ⚠️ 이 파일이 존재하는 이유: 스토어 목 호출만 단언하는 테스트는 이 결함을 못 잡는다.
 *    삭제·전체 삭제·무한스크롤이 스토어에만 반영되던 시절에도 "removeNotification 이 호출됐다"는
 *    단언은 전부 green 이었고, 화면은 한 픽셀도 바뀌지 않았다.
 *    그래서 여기서는 실제 QueryClient + 실제 notificationStore 를 쓰고,
 *    훅이 돌려주는 `notifications`(= 화면이 그리는 배열) 를 직접 단언한다.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useNotificationList,
  useDeleteNotification,
  useDeleteAllNotifications,
} from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationType, type NotificationData } from '@/types/notification';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

// ============================================================================
// Mocks
// ============================================================================

const mockFetchNotifications = jest.fn();
const mockDeleteNotificationService = jest.fn();
const mockDeleteAllNotificationsService = jest.fn();

jest.mock('@/services/notifications/notificationService', () => ({
  fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: (...args: unknown[]) => mockDeleteNotificationService(...args),
  deleteAllNotifications: (...args: unknown[]) => mockDeleteAllNotificationsService(...args),
  // 구독 해제 함수를 돌려줘야 useEffect cleanup 이 성립한다
  subscribeToNotifications: jest.fn(() => jest.fn()),
  getNotificationSettings: jest.fn(),
  saveNotificationSettings: jest.fn(),
  checkNotificationPermission: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

jest.mock('@/services/notifications/notificationSyncService', () => ({
  syncMissedNotifications: jest.fn(),
  shouldSync: jest.fn(() => false),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: { user: { uid: string } }) => unknown) => {
    const state = { user: { uid: 'user-1' } };
    return selector ? selector(state) : state;
  },
}));

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector?: (s: { addToast: jest.Mock }) => unknown) => {
    const state = { addToast: mockAddToast };
    return selector ? selector(state) : state;
  },
}));

let mockIsOnline = true;
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline, isOffline: !mockIsOnline }),
}));

const mockRequireOnlineForMutation = jest.fn();
const mockShouldApplyOptimisticUpdate = jest.fn(() => true);
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: (...args: unknown[]) => mockRequireOnlineForMutation(...args),
  shouldApplyOptimisticUpdate: () => mockShouldApplyOptimisticUpdate(),
}));

jest.mock('@/lib/queryClient', () => ({
  cachingPolicies: { nearRealtime: 2 * 60 * 1000, stable: 60 * 60 * 1000 },
  queryKeys: {
    notifications: {
      all: ['notifications'],
      list: (filters: unknown) => ['notifications', 'list', filters],
      unread: () => ['notifications', 'unread'],
      unreadCount: () => ['notifications', 'unreadCount'],
      settings: () => ['notifications', 'settings'],
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/errors', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeNotification(id: string, isRead = false): NotificationData {
  return {
    id,
    recipientId: 'user-1',
    type: NotificationType.NEW_APPLICATION,
    title: `알림 ${id}`,
    body: '본문',
    isRead,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  } as NotificationData;
}

const PAGE_1 = [makeNotification('n-1'), makeNotification('n-2'), makeNotification('n-3', true)];
const PAGE_2 = [makeNotification('n-4'), makeNotification('n-5')];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      list: useNotificationList(),
      del: useDeleteNotification(),
      all: useDeleteAllNotifications(),
    }),
    { wrapper }
  );
  return { queryClient, ...view };
}

/**
 * TanStack Query 의 구독자 통지를 흘린다.
 *
 * `notifyManager` 의 기본 스케줄러는 `setTimeout(cb, 0)`(query-core 5.101.4
 * `defaultScheduler = systemSetTimeoutZero`)이라, `jest.useFakeTimers()` 아래에서는
 * 캐시가 갱신돼도 훅의 `result.current` 가 갱신되지 않는다.
 *
 * ⚠️ 이건 **테스트 하네스 사정이지 구현 결함이 아니다** — 실측으로 판정했다:
 *    fetchNextPage 직후 원시 캐시(`getQueryData`)에는 이미 2페이지가 정확히 들어가 있고
 *    (`pageParams: [null, <커서>]`), 타이머를 1ms 흘리면 훅 반환값이 따라온다.
 *    단언 자체는 그대로 두고 통지만 흘린다 — 이 헬퍼로 단언을 약화시키지 말 것.
 */
async function flushQueryNotifications() {
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
}

/** 되돌리기 토스트의 onPress 를 찾는다 (렌더된 계약 필드) */
function findUndo(notificationId: string): (() => void) | undefined {
  const call = [...mockAddToast.mock.calls]
    .reverse()
    .find((c) => c[0]?.action && c[0]?.message?.includes(`알림 ${notificationId}`));
  return call?.[0]?.action?.onPress;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockIsOnline = true;
  mockAddToast.mockClear();
  mockShouldApplyOptimisticUpdate.mockReturnValue(true);
  mockDeleteNotificationService.mockReset().mockResolvedValue(undefined);
  mockDeleteAllNotificationsService.mockReset().mockResolvedValue(3);
  mockFetchNotifications
    .mockReset()
    .mockResolvedValue({ notifications: PAGE_1, lastDoc: { cursor: 'p1' }, hasMore: true });
  act(() => {
    useNotificationStore.getState().reset();
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ============================================================================
// Tests
// ============================================================================

describe('알림 목록 축 = React Query 캐시', () => {
  it('무한스크롤: 다음 페이지가 화면이 그리는 배열에 붙는다', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    mockFetchNotifications.mockResolvedValueOnce({
      notifications: PAGE_2,
      lastDoc: { cursor: 'p2' },
      hasMore: false,
    });

    await act(async () => {
      await result.current.list.fetchNextPage();
    });
    await flushQueryNotifications();

    // 스토어가 아니라 훅 반환값(= 렌더 소스)이 늘어나야 한다.
    // 예전엔 스토어에만 append 해서 21번째 알림부터 영영 접근할 수 없었다.
    expect(result.current.list.notifications.map((n) => n.id)).toEqual([
      'n-1',
      'n-2',
      'n-3',
      'n-4',
      'n-5',
    ]);
  });

  it('무한스크롤: 같은 페이지를 두 번 받아도 중복되지 않는다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    mockFetchNotifications.mockResolvedValueOnce({
      notifications: [PAGE_1[2], ...PAGE_2],
      lastDoc: null,
      hasMore: false,
    });

    await act(async () => {
      await result.current.list.fetchNextPage();
    });
    await flushQueryNotifications();

    expect(result.current.list.notifications.map((n) => n.id)).toEqual([
      'n-1',
      'n-2',
      'n-3',
      'n-4',
      'n-5',
    ]);
  });

  it('무효화가 스크롤한 목록을 1페이지로 붕괴시키지 않는다', async () => {
    // 이 테스트가 useInfiniteQuery 이관의 존재 이유다.
    // 평범한 useQuery 시절에는 invalidate 한 방이면 queryFn 이 커서 없이 재실행돼
    // 3페이지 스크롤한 목록이 20건으로 점프했다 — 읽음 처리 1회, realtime 새 알림 1건,
    // 포그라운드 복귀, 재연결 동기화 전부가 이 붕괴를 일으켰다.
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    mockFetchNotifications.mockResolvedValueOnce({
      notifications: PAGE_2,
      lastDoc: null,
      hasMore: false,
    });
    await act(async () => {
      await result.current.list.fetchNextPage();
    });
    await flushQueryNotifications();
    expect(result.current.list.notifications).toHaveLength(5);

    // 이제 무효화 — 서버는 두 페이지를 그대로 돌려준다.
    mockFetchNotifications
      .mockResolvedValueOnce({ notifications: PAGE_1, lastDoc: { cursor: 'p1' }, hasMore: true })
      .mockResolvedValueOnce({ notifications: PAGE_2, lastDoc: null, hasMore: false });

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    await flushQueryNotifications();

    // 5건이 유지돼야 한다. 3건이면 1페이지 붕괴가 되살아난 것이다.
    expect(result.current.list.notifications.map((n) => n.id)).toEqual([
      'n-1',
      'n-2',
      'n-3',
      'n-4',
      'n-5',
    ]);
    // 무효화가 로드된 페이지 수만큼 순차 재조회했는지 (1페이지만 부르면 붕괴다)
    const cursors = mockFetchNotifications.mock.calls.slice(-2).map((c) => c[0]?.lastDoc);
    expect(cursors).toEqual([undefined, { cursor: 'p1' }]);
  });

  it('무한스크롤 결과는 오프라인 스냅샷(스토어)에도 되비친다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    mockFetchNotifications.mockResolvedValueOnce({
      notifications: PAGE_2,
      lastDoc: null,
      hasMore: false,
    });
    await act(async () => {
      await result.current.list.fetchNextPage();
    });
    await flushQueryNotifications();

    // 쿼리 → 스토어 한 방향 미러링. 이게 깨지면 "온라인 스크롤 후 오프라인 전환" 시
    // 보이던 2페이지가 조용히 사라진다.
    expect(useNotificationStore.getState().notifications).toHaveLength(5);
  });
});

describe('개별 알림 삭제 (낙관 갱신 + 되돌리기)', () => {
  it('누르는 즉시 렌더 소스에서 사라지고, 유예 뒤에 서버 DELETE 를 커밋한다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-1');
    });

    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-2', 'n-3']);
    // 미읽음 배지도 함께 내려간다 (n-1 은 미읽음)
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    // 유예 중에는 아직 서버를 건드리지 않는다
    expect(mockDeleteNotificationService).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockDeleteNotificationService).toHaveBeenCalledWith('n-1');
  });

  it('되돌리기: 원래 인덱스로 복원하고 서버 DELETE 를 취소한다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-2');
    });
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-3']);

    const undo = findUndo('n-2');
    expect(undo).toBeDefined();
    act(() => undo!());

    // 맨 앞이 아니라 원래 자리(index 1)로 돌아와야 한다
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-2', 'n-3']);
    expect(useNotificationStore.getState().unreadCount).toBe(2);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockDeleteNotificationService).not.toHaveBeenCalled();
  });

  it('연속 삭제 후 한 건을 복원해도 다른 대기 항목이 되살아나지 않는다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-1');
    });
    act(() => {
      result.current.del.deleteNotification('n-2');
    });
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-3']);

    const undo = findUndo('n-1');
    expect(undo).toBeDefined();
    act(() => undo!());

    // n-1 만 돌아오고 n-2 는 삭제 대기 유지 (전체 스냅샷 덮어쓰기였다면 n-2 도 부활한다)
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-3']);
  });

  it('언마운트 시 유예 중인 삭제를 즉시 커밋한다 (타이머 누수 방지)', async () => {
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-1');
    });
    expect(mockDeleteNotificationService).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(mockDeleteNotificationService).toHaveBeenCalledWith('n-1');
  });

  // ⚠️ 토스트는 앱 루트(app/_layout.tsx)에 단일 마운트라 화면을 떠나도 살아 있다.
  //    커밋이 끝난 뒤 '되돌리기'를 누르면 하드 DELETE 는 이미 나갔는데도 캐시가 되살아나
  //    "복원했습니다"라고 알린 뒤 다음 refetch 에 조용히 다시 사라진다 — 거짓 복원이다.
  it('유예가 끝나 삭제가 확정된 뒤에는 되돌리기를 눌러도 복원하지 않는다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-1');
    });
    const undo = findUndo('n-1');
    expect(undo).toBeDefined();

    // 커밋 이후 서버는 n-1 이 빠진 목록을 돌려준다(실제로 지워졌으므로)
    mockFetchNotifications.mockResolvedValue({
      notifications: PAGE_1.filter((n) => n.id !== 'n-1'),
      lastDoc: { cursor: 'p1' },
      hasMore: true,
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockDeleteNotificationService).toHaveBeenCalledWith('n-1');

    mockAddToast.mockClear();
    await act(async () => {
      undo!();
    });

    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-2', 'n-3']);
    expect(useNotificationStore.getState().notifications.map((n) => n.id)).not.toContain('n-1');
    expect(mockAddToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('복원했습니다') })
    );
  });

  it('화면을 떠나 삭제가 확정된 뒤에는 되돌리기를 눌러도 복원하지 않는다', async () => {
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-1');
    });
    const undo = findUndo('n-1');
    expect(undo).toBeDefined();

    await act(async () => {
      unmount();
    });
    expect(mockDeleteNotificationService).toHaveBeenCalledWith('n-1');

    mockAddToast.mockClear();
    act(() => undo!());

    // 훅은 언마운트됐지만 스토어는 살아 있다 — 여기에 되살아나면 배지까지 거짓말한다.
    expect(useNotificationStore.getState().notifications.map((n) => n.id)).not.toContain('n-1');
    expect(mockAddToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('복원했습니다') })
    );
  });

  it('서버 DELETE 가 실패하면 렌더 소스로 되돌린다', async () => {
    mockDeleteNotificationService.mockRejectedValue(new Error('삭제 실패'));
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    act(() => {
      result.current.del.deleteNotification('n-2');
    });
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-3']);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-2', 'n-3']);
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('낙관 갱신 비활성(오프라인)이면 선반영·Undo 없이 뮤테이션만 시도한다', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    mockShouldApplyOptimisticUpdate.mockReturnValue(false);
    mockAddToast.mockClear();

    await act(async () => {
      result.current.del.deleteNotification('n-1');
    });

    // 선반영하지 않는다 (어차피 실패할 요청의 깜빡임 방지)
    expect(result.current.list.notifications).toHaveLength(3);
    // 되돌리기 토스트도 없다
    expect(mockAddToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.anything() })
    );
    // 유예 없이 곧장 서버로 간다
    expect(mockDeleteNotificationService).toHaveBeenCalledWith('n-1');
  });
});

describe('전체 알림 삭제', () => {
  it('목록(렌더 소스)과 배지를 함께 비운다', async () => {
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    // TanStack 은 onMutate 를 mutationFn 보다 **먼저** 실행한다. 그래서 "서버를 부르는
    // 순간"의 렌더 소스를 붙잡으면 낙관 반영이 실제로 목록 캐시에 닿았는지 정확히 잠긴다.
    // 서버 응답 뒤에 단언하면 안 된다 — onSuccess 의 invalidateQueries 가 refetch 를
    // 돌려 목 데이터로 목록을 되채우므로, 구현이 아무것도 안 해도 통과해 버린다.
    // 목록 캐시는 이제 평면 배열이 아니라 {pages, pageParams} 다 — 평탄화해서 본다.
    const listsWhenServerCalled: unknown[][] = [];
    let unreadWhenServerCalled = -1;
    mockDeleteAllNotificationsService.mockImplementation(async () => {
      queryClient
        .getQueryCache()
        .getAll()
        .forEach((query) => {
          const data = query.state.data as { pages?: { notifications: unknown[] }[] } | undefined;
          if (!Array.isArray(data?.pages)) return;
          listsWhenServerCalled.push(data.pages.flatMap((page) => page.notifications));
        });
      unreadWhenServerCalled = useNotificationStore.getState().unreadCount;
      return 3;
    });

    await act(async () => {
      result.current.all.deleteAllNotifications();
    });

    // "배지는 0인데 목록은 그대로" 회귀 방지
    expect(mockDeleteAllNotificationsService).toHaveBeenCalledWith('user-1');
    expect(listsWhenServerCalled.length).toBeGreaterThan(0);
    listsWhenServerCalled.forEach((list) => expect(list).toEqual([]));
    expect(unreadWhenServerCalled).toBe(0);
  });

  it('실패하면 목록과 스토어를 함께 롤백한다', async () => {
    mockDeleteAllNotificationsService.mockRejectedValue(new Error('전체 삭제 실패'));
    const { result } = setup();
    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));

    await act(async () => {
      result.current.all.deleteAllNotifications();
    });

    await waitFor(() => expect(result.current.list.notifications).toHaveLength(3));
    expect(result.current.list.notifications.map((n) => n.id)).toEqual(['n-1', 'n-2', 'n-3']);
    expect(useNotificationStore.getState().notifications).toHaveLength(3);
  });
});
