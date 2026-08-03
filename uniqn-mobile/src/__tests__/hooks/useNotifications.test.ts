/**
 * UNIQN Mobile - useNotifications Hook Tests
 *
 * @description 알림 관련 훅 테스트 - useQuery/useMutation 래퍼 검증
 * @version 1.0.0
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { resetCounters, createMockNotification } from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import {
  useNotificationList,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
  useNotificationPermission,
} from '@/hooks/useNotifications';

// ============================================================================
// Mocks - Supabase
// ============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockFetchNotifications = jest.fn();
const mockMarkAsReadService = jest.fn();
const mockMarkAllAsReadService = jest.fn();
const mockDeleteNotificationService = jest.fn();
const mockSubscribeToNotifications = jest.fn();
const mockGetNotificationSettings = jest.fn();
const mockSaveNotificationSettings = jest.fn();
const mockCheckNotificationPermission = jest.fn();
const mockRequestNotificationPermission = jest.fn();

jest.mock('@/services/notifications/notificationService', () => ({
  fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
  markAsRead: (...args: unknown[]) => mockMarkAsReadService(...args),
  markAllAsRead: (...args: unknown[]) => mockMarkAllAsReadService(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotificationService(...args),
  subscribeToNotifications: (...args: unknown[]) => mockSubscribeToNotifications(...args),
  getNotificationSettings: (...args: unknown[]) => mockGetNotificationSettings(...args),
  saveNotificationSettings: (...args: unknown[]) => mockSaveNotificationSettings(...args),
  checkNotificationPermission: (...args: unknown[]) => mockCheckNotificationPermission(...args),
  requestNotificationPermission: (...args: unknown[]) => mockRequestNotificationPermission(...args),
}));

const mockSyncMissedNotifications = jest.fn();
const mockShouldSync = jest.fn();

jest.mock('@/services/notifications/notificationSyncService', () => ({
  syncMissedNotifications: (...args: unknown[]) => mockSyncMissedNotifications(...args),
  shouldSync: (...args: unknown[]) => mockShouldSync(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockAddToast = jest.fn();
const mockUser = { uid: 'user-1' };
const mockAuthState = { user: mockUser };
const mockToastState = { addToast: mockAddToast };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector?: (state: typeof mockToastState) => unknown) =>
    selector ? selector(mockToastState) : mockToastState,
}));

const mockSetNotifications = jest.fn();
const mockAddNotification = jest.fn();
const mockAddNotifications = jest.fn();
const mockMarkAsReadLocal = jest.fn();
const mockMarkAllAsReadLocal = jest.fn();
const mockRemoveNotification = jest.fn();
const mockSetSettings = jest.fn();

const mockNotificationStoreState = {
  notifications: [] as ReturnType<typeof createMockNotification>[],
  lastFetchedAt: null as number | null,
  settings: {
    grouping: { enabled: true, minGroupSize: 2, timeWindowHours: 24 },
  },
  setNotifications: mockSetNotifications,
  addNotification: mockAddNotification,
  addNotifications: mockAddNotifications,
  markAsRead: mockMarkAsReadLocal,
  markAllAsRead: mockMarkAllAsReadLocal,
  removeNotification: mockRemoveNotification,
  setSettings: mockSetSettings,
};

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: (selector?: (state: typeof mockNotificationStoreState) => unknown) =>
    selector ? selector(mockNotificationStoreState) : mockNotificationStoreState,
}));

// ============================================================================
// Mock Network Status
// ============================================================================

let mockIsOnline = true;

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: mockIsOnline,
    isOffline: !mockIsOnline,
  }),
}));

// ============================================================================
// Mock Logger & Errors
// ============================================================================

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

// ============================================================================
// Mock Offline Guard
// ============================================================================

const mockRequireOnlineForMutation = jest.fn();
const mockShouldApplyOptimisticUpdate = jest.fn(() => true);

jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: (...args: unknown[]) => mockRequireOnlineForMutation(...args),
  shouldApplyOptimisticUpdate: () => mockShouldApplyOptimisticUpdate(),
}));

// ============================================================================
// Mock Notification Grouping
// ============================================================================

jest.mock('@/utils/notificationGrouping', () => ({
  groupNotificationsWithCategoryFilter: jest.fn((notifications: unknown[]) => notifications),
  countUnreadInGroupedList: jest.fn(() => 0),
}));

// ============================================================================
// Mock React Query
// ============================================================================

const mockQueryClient = {
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
  // 목록 축(렌더 소스) 패치용 — 삭제·페이지네이션이 여기를 건드려야 화면이 바뀐다
  getQueriesData: jest.fn(() => [] as [unknown, unknown][]),
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
};

const mockRefetch = jest.fn().mockResolvedValue({ data: undefined });
const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();

let mockIsLoading = false;
let mockIsRefetching = false;
let mockIsError = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;
let mockIsPending = false;
let mockEnabled: boolean | undefined;
// queryFn 을 붙잡아 두면 첫 페이지 로드를 흉내 낼 수 있다
let mockCapturedQueryFn: ((ctx?: { pageParam?: unknown }) => Promise<unknown>) | undefined;
let mockCapturedQueryKey: unknown[] | undefined;
// 목록은 useInfiniteQuery 다 — 페이지 계약(getNextPageParam/select)도 함께 붙잡는다.
let mockCapturedGetNextPageParam: ((lastPage: unknown) => unknown) | undefined;
let mockCapturedSelect: ((data: unknown) => unknown) | undefined;
const mockFetchNextPage = jest.fn(() => Promise.resolve());
let mockHasNextPage = true;
let mockIsFetchingNextPage = false;

jest.mock('@tanstack/react-query', () => ({
  // 목록 축 전용 — `data` 는 select 가 이미 돈 뒤의 평면 배열로 흉내 낸다
  // (실제 훅은 `select: flattenNotificationPages` 로 같은 형태를 돌려준다).
  useInfiniteQuery: jest.fn(
    (options: {
      queryKey: unknown[];
      queryFn: (ctx?: { pageParam?: unknown }) => Promise<unknown>;
      enabled?: boolean;
      getNextPageParam?: (lastPage: unknown) => unknown;
      select?: (data: unknown) => unknown;
    }) => {
      mockEnabled = options.enabled;
      mockCapturedQueryFn = options.queryFn;
      mockCapturedQueryKey = options.queryKey;
      mockCapturedGetNextPageParam = options.getNextPageParam;
      mockCapturedSelect = options.select;

      const disabled = options.enabled === false;
      return {
        data: disabled ? undefined : mockData,
        isLoading: disabled ? false : mockIsLoading,
        isRefetching: disabled ? false : mockIsRefetching,
        isError: disabled ? false : mockIsError,
        error: disabled ? null : mockError,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: mockHasNextPage,
        isFetchingNextPage: mockIsFetchingNextPage,
      };
    }
  ),
  useQuery: jest.fn(
    (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      mockEnabled = options.enabled;
      mockCapturedQueryFn = options.queryFn;
      mockCapturedQueryKey = options.queryKey;
      if (options.enabled === false) {
        return {
          data: undefined,
          isLoading: false,
          isRefetching: false,
          isError: false,
          error: null,
          refetch: mockRefetch,
        };
      }
      return {
        data: mockData,
        isLoading: mockIsLoading,
        isRefetching: mockIsRefetching,
        isError: mockIsError,
        error: mockError,
        refetch: mockRefetch,
      };
    }
  ),
  useMutation: jest.fn(
    (options: {
      mutationFn: (...args: unknown[]) => Promise<unknown>;
      onMutate?: (variables: unknown) => Promise<unknown>;
      onSuccess?: (data: unknown, variables: unknown) => void;
      onError?: (error: Error, variables: unknown, context: unknown) => void;
    }) => {
      mockMutate.mockImplementation((args: unknown) => {
        mockIsPending = true;
        const mutatePromise = options.onMutate
          ? options.onMutate(args)
          : Promise.resolve(undefined);
        mutatePromise.then((context: unknown) => {
          return options
            .mutationFn(args)
            .then((result) => {
              options.onSuccess?.(result, args);
              mockIsPending = false;
            })
            .catch((error) => {
              options.onError?.(error as Error, args, context);
              mockIsPending = false;
            });
        });
      });

      mockMutateAsync.mockImplementation(async (args: unknown) => {
        try {
          mockIsPending = true;
          const result = await options.mutationFn(args);
          options.onSuccess?.(result, args);
          mockIsPending = false;
          return result;
        } catch (error) {
          options.onError?.(error as Error, args, undefined);
          mockIsPending = false;
          throw error;
        }
      });

      return {
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: mockIsPending,
        error: mockError,
      };
    }
  ),
  useQueryClient: () => mockQueryClient,
}));

// ============================================================================
// Mock Query Keys and Caching
// ============================================================================

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    notifications: {
      all: ['notifications'],
      lists: () => ['notifications', 'list'],
      list: (filters: Record<string, unknown>) => ['notifications', 'list', filters],
      unread: () => ['notifications', 'unread'],
      unreadCount: () => ['notifications', 'unreadCount'],
      settings: () => ['notifications', 'settings'],
      permission: () => ['notifications', 'permission'],
    },
  },
  cachingPolicies: {
    realtime: 30 * 1000,
    nearRealtime: 2 * 60 * 1000,
    frequent: 5 * 60 * 1000,
    standard: 10 * 60 * 1000,
    stable: 60 * 60 * 1000,
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('useNotifications Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsRefetching = false;
    mockIsError = false;
    mockData = undefined;
    mockError = null;
    mockIsPending = false;
    mockEnabled = undefined;
    mockIsOnline = true;
    mockNotificationStoreState.notifications = [];
    mockNotificationStoreState.lastFetchedAt = null;
    mockFetchNextPage.mockClear();
    mockHasNextPage = true;
    mockIsFetchingNextPage = false;
    mockShouldSync.mockReturnValue(false);
    mockSubscribeToNotifications.mockReturnValue(jest.fn());
    mockShouldApplyOptimisticUpdate.mockReturnValue(true);
    mockQueryClient.getQueriesData.mockReturnValue([]);
  });

  // ==========================================================================
  // useNotificationList
  // ==========================================================================

  describe('useNotificationList', () => {
    it('should return correct initial structure', () => {
      const { result } = renderHook(() => useNotificationList());

      expect(result.current).toHaveProperty('notifications');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isRefreshing');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('hasMore');
      expect(result.current).toHaveProperty('fetchNextPage');
      expect(result.current).toHaveProperty('isFetchingNextPage');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return empty array when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.notifications).toEqual([]);
    });

    it('should return notifications when data is available', () => {
      const mockNotifications = [
        createMockNotification({ id: 'notif-1', userId: 'user-1' }),
        createMockNotification({ id: 'notif-2', userId: 'user-1' }),
      ];
      mockData = mockNotifications;

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.notifications).toEqual(mockNotifications);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useNotificationList());

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });

    it('should disable query when enabled option is false', () => {
      renderHook(() => useNotificationList({ enabled: false }));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when offline', () => {
      mockIsOnline = false;

      renderHook(() => useNotificationList());

      expect(mockEnabled).toBe(false);
    });

    it('should return cached notifications when offline', () => {
      mockIsOnline = false;
      const cachedNotifications = [createMockNotification({ id: 'cached-1' })];
      mockNotificationStoreState.notifications = cachedNotifications as ReturnType<
        typeof createMockNotification
      >[];

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.notifications).toEqual(cachedNotifications);
    });

    it('should not show loading when offline', () => {
      mockIsOnline = false;
      mockIsLoading = true;

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.isLoading).toBe(false);
    });

    it('should return loading state when online', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.isLoading).toBe(true);
    });

    it('should subscribe to realtime updates for unfiltered notification list', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToNotifications.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useNotificationList());

      expect(mockSubscribeToNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.any(Function),
        expect.any(Function)
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should not subscribe to realtime updates when server-side filters are applied', () => {
      renderHook(() =>
        useNotificationList({
          filter: {
            isRead: false,
          },
        })
      );

      expect(mockSubscribeToNotifications).not.toHaveBeenCalled();
    });

    it('should invalidate the current list query when realtime updates arrive', async () => {
      renderHook(() => useNotificationList());

      const onNotifications = mockSubscribeToNotifications.mock.calls[0]?.[1] as
        | (() => void)
        | undefined;

      expect(onNotifications).toBeDefined();

      await act(async () => {
        onNotifications?.();
      });

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
    });

    it('should return error state', () => {
      mockIsError = true;
      mockError = new Error('알림 조회 실패');

      const { result } = renderHook(() => useNotificationList());

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(new Error('알림 조회 실패'));
    });

    it('should have refetch function that calls query refetch', async () => {
      const { result } = renderHook(() => useNotificationList());

      await result.current.refetch();

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should not refetch when offline', async () => {
      mockIsOnline = false;

      const { result } = renderHook(() => useNotificationList());

      await result.current.refetch();

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------
    // 무한 스크롤 — 목록 축(쿼리 캐시)에 append 해야 화면이 늘어난다
    // ------------------------------------------------------------------

    it('fetchNextPage는 infinite query 에 위임하고 캐시를 직접 쓰지 않는다', async () => {
      // 페이지 소유권이 쿼리로 넘어갔다 — 훅이 setQueryData 로 직접 append 하면
      // invalidate 한 방에 1페이지로 붕괴하던 구조가 되살아난다.
      mockData = [createMockNotification({ id: 'notif-1' })];
      mockHasNextPage = true;

      const { result } = renderHook(() => useNotificationList());

      await act(async () => {
        await result.current.fetchNextPage();
      });

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
      expect(mockQueryClient.setQueryData).not.toHaveBeenCalled();
      expect(mockAddNotifications).not.toHaveBeenCalled();
    });

    it('다음 페이지가 없으면 fetchNextPage 를 부르지 않는다', async () => {
      mockData = [createMockNotification({ id: 'notif-1' })];
      mockHasNextPage = false;

      const { result } = renderHook(() => useNotificationList());

      await act(async () => {
        await result.current.fetchNextPage();
      });

      expect(mockFetchNextPage).not.toHaveBeenCalled();
      expect(result.current.hasMore).toBe(false);
    });

    it('오프라인이면 fetchNextPage 를 부르지 않는다', async () => {
      mockIsOnline = false;
      mockHasNextPage = true;

      const { result } = renderHook(() => useNotificationList());

      await act(async () => {
        await result.current.fetchNextPage();
      });

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it('페이지 계약: 마지막 페이지에 다음이 있을 때만 커서를 넘긴다', () => {
      renderHook(() => useNotificationList());

      // hasMore=false 면 커서가 있어도 멈춘다 (무한 루프 방지)
      expect(
        mockCapturedGetNextPageParam?.({ lastDoc: { cursor: 'p1' }, hasMore: false })
      ).toBeUndefined();
      // lastDoc 이 없으면 더 못 간다 (keyset 커서라 null 이면 처음부터가 된다)
      expect(mockCapturedGetNextPageParam?.({ lastDoc: null, hasMore: true })).toBeUndefined();
      // 둘 다 있어야 다음 커서
      expect(mockCapturedGetNextPageParam?.({ lastDoc: { cursor: 'p1' }, hasMore: true })).toEqual({
        cursor: 'p1',
      });
    });

    it('select 는 페이지를 평탄화하면서 id 중복을 접는다', () => {
      // 중복 접기가 빠지면 refetch 중 새 알림이 유입될 때 페이지 경계에서
      // 같은 알림이 두 번 나와 FlashList keyExtractor 가 중복 키를 만든다.
      renderHook(() => useNotificationList());

      const a = createMockNotification({ id: 'notif-1' });
      const b = createMockNotification({ id: 'notif-2' });
      const flattened = mockCapturedSelect?.({
        pages: [
          { notifications: [a, b], lastDoc: null, hasMore: true },
          { notifications: [b], lastDoc: null, hasMore: false },
        ],
        pageParams: [null, null],
      });

      expect(flattened).toEqual([a, b]);
    });

    it('queryFn 은 첫 페이지에 커서를 넘기지 않는다', async () => {
      mockFetchNotifications.mockResolvedValue({
        notifications: [],
        lastDoc: null,
        hasMore: false,
      });
      renderHook(() => useNotificationList());

      // 쿼리키는 필터 변형별로 갈려야 한다 (필터 탭이 서로의 캐시를 덮어쓰지 않도록)
      expect(mockCapturedQueryKey).toEqual(['notifications', 'list', {}]);

      await act(async () => {
        await mockCapturedQueryFn?.({ pageParam: null });
      });
      expect(mockFetchNotifications).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ lastDoc: expect.anything() })
      );

      await act(async () => {
        await mockCapturedQueryFn?.({ pageParam: { cursor: 'p1' } });
      });
      expect(mockFetchNotifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ lastDoc: { cursor: 'p1' } })
      );
    });
  });

  // ==========================================================================
  // useMarkAsRead
  // ==========================================================================

  describe('useMarkAsRead', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useMarkAsRead());

      expect(result.current).toHaveProperty('markAsRead');
      expect(result.current).toHaveProperty('isMarking');
      expect(result.current).toHaveProperty('error');
    });

    it('should have markAsRead as a function', () => {
      const { result } = renderHook(() => useMarkAsRead());

      expect(typeof result.current.markAsRead).toBe('function');
    });

    it('should call markAsRead service on mutation', async () => {
      mockMarkAsReadService.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMarkAsRead());

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(mockMutate).toHaveBeenCalledWith('notif-1');
    });

    it('should call service and update local store on success', async () => {
      mockMarkAsReadService.mockResolvedValueOnce(undefined);

      renderHook(() => useMarkAsRead());

      // Trigger mutation through mutateAsync (which goes through onSuccess)
      await act(async () => {
        await mockMutateAsync('notif-1');
      });

      expect(mockMarkAsReadLocal).toHaveBeenCalledWith('notif-1');
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
    });

    it('should show error toast on failure', async () => {
      mockMarkAsReadService.mockRejectedValueOnce(new Error('읽음 처리 실패'));

      renderHook(() => useMarkAsRead());

      await act(async () => {
        try {
          await mockMutateAsync('notif-1');
        } catch {
          // Expected
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '알림 읽음 처리에 실패했습니다.',
      });
    });
  });

  // ==========================================================================
  // useMarkAllAsRead
  // ==========================================================================

  describe('useMarkAllAsRead', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useMarkAllAsRead());

      expect(result.current).toHaveProperty('markAllAsRead');
      expect(result.current).toHaveProperty('isMarking');
      expect(result.current).toHaveProperty('error');
    });

    it('should have markAllAsRead as a function', () => {
      const { result } = renderHook(() => useMarkAllAsRead());

      expect(typeof result.current.markAllAsRead).toBe('function');
    });

    it('should call markAllAsRead service on success', async () => {
      mockMarkAllAsReadService.mockResolvedValueOnce(undefined);

      renderHook(() => useMarkAllAsRead());

      await act(async () => {
        await mockMutateAsync(undefined);
      });

      expect(mockMarkAllAsReadService).toHaveBeenCalledWith('user-1');
      expect(mockMarkAllAsReadLocal).toHaveBeenCalled();
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '모든 알림을 읽음 처리했습니다.',
      });
    });

    it('should show error toast on failure', async () => {
      mockMarkAllAsReadService.mockRejectedValueOnce(new Error('읽음 처리 실패'));

      renderHook(() => useMarkAllAsRead());

      await act(async () => {
        try {
          await mockMutateAsync(undefined);
        } catch {
          // Expected
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '알림 읽음 처리에 실패했습니다.',
      });
    });
  });

  // ==========================================================================
  // useDeleteNotification
  // ==========================================================================

  describe('useDeleteNotification', () => {
    const LIST_KEY = ['notifications', 'list', {}];

    /** 목록 캐시를 useInfiniteQuery 모양({pages, pageParams})으로 감싼다 */
    function asListCache(notifications: unknown[], hasMore = false) {
      return {
        pages: [{ notifications, lastDoc: null, hasMore }],
        pageParams: [null],
      };
    }

    /** 목록 캐시에 알림 3건이 들어 있는 상태를 흉내 낸다 */
    function seedListCache() {
      const list = [
        createMockNotification({ id: 'notif-1' }),
        createMockNotification({ id: 'notif-2' }),
        createMockNotification({ id: 'notif-3' }),
      ];
      mockQueryClient.getQueriesData.mockReturnValue([
        [LIST_KEY, asListCache(list)],
        // 목록이 아닌 캐시(설정)는 건드리면 안 된다
        [['notifications', 'settings'], { enabled: true }],
      ]);
      return list;
    }

    it('should return correct structure', () => {
      const { result } = renderHook(() => useDeleteNotification());

      expect(result.current).toHaveProperty('deleteNotification');
      expect(result.current).toHaveProperty('isDeleting');
      expect(result.current).toHaveProperty('error');
    });

    it('should have deleteNotification as a function', () => {
      const { result } = renderHook(() => useDeleteNotification());

      expect(typeof result.current.deleteNotification).toBe('function');
    });

    it('삭제를 누르면 목록 캐시(렌더 소스)에서 제거하고 되돌리기 토스트를 띄운다', () => {
      jest.useFakeTimers();
      const list = seedListCache();

      const { result } = renderHook(() => useDeleteNotification());

      act(() => {
        result.current.deleteNotification('notif-2');
      });

      // 목록 캐시만 패치 (설정 캐시는 그대로)
      expect(mockQueryClient.setQueryData).toHaveBeenCalledTimes(1);
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        LIST_KEY,
        asListCache([list[0], list[2]])
      );
      // 스냅샷 축(스토어)도 함께 맞춘다
      expect(mockRemoveNotification).toHaveBeenCalledWith('notif-2');
      // 되돌리기 액션이 있는 토스트
      const undoToast = mockAddToast.mock.calls.find((c) => c[0]?.action);
      expect(undoToast?.[0]?.action?.label).toBe('되돌리기');
      // 유예 중에는 서버 삭제를 시작하지 않는다
      expect(mockMutate).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('유예가 끝나면 실제 삭제 뮤테이션을 커밋한다', () => {
      jest.useFakeTimers();
      seedListCache();

      const { result } = renderHook(() => useDeleteNotification());

      act(() => {
        result.current.deleteNotification('notif-2');
      });
      expect(mockMutate).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockMutate).toHaveBeenCalledWith('notif-2');
      jest.useRealTimers();
    });

    it('되돌리기를 누르면 원래 인덱스로 복원하고 커밋하지 않는다', () => {
      jest.useFakeTimers();
      const list = seedListCache();
      // 복원 시점의 "지금 캐시" (이미 notif-2 가 빠진 상태)
      mockQueryClient.getQueryData.mockReturnValue(asListCache([list[0], list[2]]));

      const { result } = renderHook(() => useDeleteNotification());

      act(() => {
        result.current.deleteNotification('notif-2');
      });

      const undo = mockAddToast.mock.calls.find((c) => c[0]?.action)?.[0]?.action?.onPress as
        | (() => void)
        | undefined;
      expect(undo).toBeDefined();

      act(() => undo?.());

      // 맨 앞이 아니라 원래 자리(page 0 의 index 1)로 splice 재삽입
      expect(mockQueryClient.setQueryData).toHaveBeenLastCalledWith(
        LIST_KEY,
        asListCache([list[0], list[1], list[2]])
      );

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockMutate).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('낙관 갱신 비활성(오프라인)이면 선반영 없이 곧장 뮤테이션을 실행한다', () => {
      mockShouldApplyOptimisticUpdate.mockReturnValue(false);
      seedListCache();

      const { result } = renderHook(() => useDeleteNotification());

      act(() => {
        result.current.deleteNotification('notif-2');
      });

      expect(mockQueryClient.setQueryData).not.toHaveBeenCalled();
      expect(mockRemoveNotification).not.toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalledWith('notif-2');
    });

    it('서버 삭제가 성공하면 알림 쿼리를 무효화한다', async () => {
      mockDeleteNotificationService.mockResolvedValueOnce(undefined);

      renderHook(() => useDeleteNotification());

      await act(async () => {
        await mockMutateAsync('notif-1');
      });

      expect(mockDeleteNotificationService).toHaveBeenCalledWith('notif-1');
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
    });

    it('should show error toast and restore state on failure', async () => {
      mockDeleteNotificationService.mockRejectedValueOnce(new Error('삭제 실패'));

      renderHook(() => useDeleteNotification());

      await act(async () => {
        try {
          await mockMutateAsync('notif-1');
        } catch {
          // Expected
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '알림 삭제에 실패했습니다.',
      });
    });
  });

  // ==========================================================================
  // useNotificationSettingsQuery
  // ==========================================================================

  describe('useNotificationSettingsQuery', () => {
    it('should return query result structure', () => {
      const { result } = renderHook(() => useNotificationSettingsQuery());

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useNotificationSettingsQuery());

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });

    it('should return settings data when available', () => {
      const mockSettings = {
        pushEnabled: true,
        categories: { application: true, schedule: true },
      };
      mockData = mockSettings;

      const { result } = renderHook(() => useNotificationSettingsQuery());

      expect(result.current.data).toEqual(mockSettings);
    });
  });

  // ==========================================================================
  // useSaveNotificationSettings
  // ==========================================================================

  describe('useSaveNotificationSettings', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useSaveNotificationSettings());

      expect(result.current).toHaveProperty('saveSettings');
      expect(result.current).toHaveProperty('isSaving');
      expect(result.current).toHaveProperty('error');
    });

    it('should have saveSettings as a function', () => {
      const { result } = renderHook(() => useSaveNotificationSettings());

      expect(typeof result.current.saveSettings).toBe('function');
    });

    it('should call save service and update store on success', async () => {
      const mockSettings = {
        pushEnabled: true,
        categories: { application: true, schedule: false },
      };
      mockSaveNotificationSettings.mockResolvedValueOnce(undefined);

      renderHook(() => useSaveNotificationSettings());

      await act(async () => {
        await mockMutateAsync(mockSettings);
      });

      expect(mockSaveNotificationSettings).toHaveBeenCalledWith('user-1', mockSettings);
      expect(mockSetSettings).toHaveBeenCalledWith(mockSettings);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications', 'settings'],
      });
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '알림 설정이 저장되었습니다.',
      });
    });

    it('should show error toast on failure', async () => {
      mockSaveNotificationSettings.mockRejectedValueOnce(new Error('저장 실패'));

      renderHook(() => useSaveNotificationSettings());

      await act(async () => {
        try {
          await mockMutateAsync({ pushEnabled: true });
        } catch {
          // Expected
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '알림 설정 저장에 실패했습니다.',
      });
    });
  });

  // ==========================================================================
  // useNotificationPermission
  // ==========================================================================

  describe('useNotificationPermission', () => {
    it('should return correct initial structure', async () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      await waitFor(() => {
        expect(mockCheckNotificationPermission).toHaveBeenCalledTimes(1);
      });

      expect(result.current).toHaveProperty('granted');
      expect(result.current).toHaveProperty('canAskAgain');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('isRequesting');
      expect(result.current).toHaveProperty('requestPermission');
    });

    it('should have initial undetermined state', async () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      await waitFor(() => {
        expect(mockCheckNotificationPermission).toHaveBeenCalledTimes(1);
      });

      expect(result.current.granted).toBe(false);
      expect(result.current.canAskAgain).toBe(true);
      expect(result.current.status).toBe('undetermined');
      expect(result.current.isRequesting).toBe(false);
    });

    it('should have requestPermission as a function', async () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      await waitFor(() => {
        expect(mockCheckNotificationPermission).toHaveBeenCalledTimes(1);
      });

      expect(typeof result.current.requestPermission).toBe('function');
    });

    it('should call checkNotificationPermission on mount', async () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
      });

      const { result } = renderHook(() => useNotificationPermission());

      await waitFor(() => {
        expect(mockCheckNotificationPermission).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('granted');
      });
    });

    it('should update permission state after requestPermission resolves', async () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });
      mockRequestNotificationPermission.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
      });

      const { result } = renderHook(() => useNotificationPermission());

      await waitFor(() => {
        expect(mockCheckNotificationPermission).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
      expect(result.current.granted).toBe(true);
      expect(result.current.canAskAgain).toBe(false);
      expect(result.current.status).toBe('granted');
      expect(result.current.isRequesting).toBe(false);
    });
  });
});
