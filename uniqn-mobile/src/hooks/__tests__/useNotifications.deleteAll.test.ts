/**
 * UNIQN Mobile - useDeleteAllNotifications Hook Tests
 *
 * @description 모든 알림 삭제 훅 — 낙관적 초기화·롤백·캐시 무효화 검증
 *
 * ⚠️ 단언 기준이 "스토어 호출"이 아니라 **목록 캐시(setQueryData)** 다.
 *    화면이 그리는 것은 React Query 캐시이므로, 스토어만 비우면 "배지는 0인데 목록은 그대로"가 된다.
 *    (렌더 소스까지 실제로 바뀌는지는 `src/__tests__/hooks/useNotifications.listAxis.test.tsx` 가 잠근다)
 */

import { renderHook } from '@testing-library/react-native';
import { useDeleteAllNotifications } from '../useNotifications';

const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockCancelQueries = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockGetQueriesData = jest.fn();
const mockSetQueryData = jest.fn();
const mockGetQueryData = jest.fn();
const mockClearNotifications = jest.fn();
const mockSetNotifications = jest.fn();
const mockAddToast = jest.fn();
const mockDeleteAllNotificationsService = jest.fn();
const mockRequireOnlineForMutation = jest.fn();
const mockShouldApplyOptimisticUpdate = jest.fn(() => true);

const LIST_KEY = ['notifications', 'list', {}];
const SETTINGS_KEY = ['notifications', 'settings'];
// 목록 캐시는 useInfiniteQuery 라 평면 배열이 아니라 {pages, pageParams} 다.
const CACHED_LIST = {
  pages: [
    {
      notifications: [
        { id: 'n-1', isRead: false },
        { id: 'n-2', isRead: true },
      ],
      lastDoc: null,
      hasMore: false,
    },
  ],
  pageParams: [null],
};
/** onMutate 가 써 넣어야 하는 "비운 상태" — 페이지 0장이면 getNextPageParam 이 흔들린다. */
const EMPTIED_LIST = {
  pages: [{ notifications: [], lastDoc: null, hasMore: false }],
  pageParams: [null],
};

const mockStoreState = {
  notifications: [
    { id: 'n-1', isRead: false },
    { id: 'n-2', isRead: true },
  ],
  setNotifications: mockSetNotifications,
  clearNotifications: mockClearNotifications,
  addNotification: jest.fn(),
  addNotifications: jest.fn(),
  lastFetchedAt: null,
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  removeNotification: jest.fn(),
  setSettings: jest.fn(),
  settings: null,
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  useInfiniteQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    cancelQueries: (...args: unknown[]) => mockCancelQueries(...args),
    getQueriesData: (...args: unknown[]) => mockGetQueriesData(...args),
    setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
    getQueryData: (...args: unknown[]) => mockGetQueryData(...args),
  }),
}));

jest.mock('@/services/notifications/notificationService', () => ({
  fetchNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  deleteAllNotifications: (...args: unknown[]) => mockDeleteAllNotificationsService(...args),
  subscribeToNotifications: jest.fn(),
  getNotificationSettings: jest.fn(),
  saveNotificationSettings: jest.fn(),
  checkNotificationPermission: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

jest.mock('@/services/notifications/notificationSyncService', () => ({
  syncMissedNotifications: jest.fn(),
  shouldSync: jest.fn(() => false),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: jest.fn((selector?: (state: unknown) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState
  ),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: (state: { user: { uid: string } }) => unknown) =>
    selector({ user: { uid: 'user-1' } })
  ),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: jest.fn((selector?: (state: { addToast: jest.Mock }) => unknown) => {
    const state = { addToast: mockAddToast };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true, isOffline: false })),
}));

jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: (...args: unknown[]) => mockRequireOnlineForMutation(...args),
  shouldApplyOptimisticUpdate: () => mockShouldApplyOptimisticUpdate(),
}));

jest.mock('@/lib/queryClient', () => ({
  cachingPolicies: { nearRealtime: 120000, stable: 3600000 },
  queryKeys: {
    notifications: {
      all: ['notifications'],
      lists: () => ['notifications', 'list'],
      list: (filters: unknown) => ['notifications', 'list', filters],
      unread: () => ['notifications', 'unread'],
      unreadCount: () => ['notifications', 'unreadCount'],
      settings: () => ['notifications', 'settings'],
    },
  },
}));

jest.mock('@/utils/notificationGrouping', () => ({
  groupNotificationsWithCategoryFilter: jest.fn(() => []),
  countUnreadInGroupedList: jest.fn(() => 0),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

type DeleteAllContext = {
  previousLists?: [unknown, unknown[]][];
  previousNotifications?: unknown[];
};

type MutationOptions = {
  mutationFn: () => Promise<number>;
  onMutate: () => DeleteAllContext | Promise<DeleteAllContext>;
  onSuccess: () => void;
  onError: (error: Error, variables: unknown, context?: DeleteAllContext) => void;
};

function renderAndCaptureOptions(): MutationOptions {
  mockUseMutation.mockImplementation((options: MutationOptions) => ({
    mutate: jest.fn(),
    isPending: false,
    error: null,
    options,
  }));

  renderHook(() => useDeleteAllNotifications());

  expect(mockUseMutation).toHaveBeenCalledTimes(1);
  return mockUseMutation.mock.calls[0][0] as MutationOptions;
}

describe('useDeleteAllNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldApplyOptimisticUpdate.mockReturnValue(true);
    // 목록 캐시(pages 형) + 목록이 아닌 캐시(설정)를 함께 돌려줘 "설정 캐시는 안 건드린다"를 검증한다
    mockGetQueriesData.mockReturnValue([
      [LIST_KEY, CACHED_LIST],
      [SETTINGS_KEY, { enabled: true }],
    ]);
  });

  it('onMutate는 진행 중인 조회를 먼저 취소한다 (되채움 → 롤백 덮어쓰기 차단)', async () => {
    const options = renderAndCaptureOptions();

    await options.onMutate();

    // 취소하지 않으면 in-flight refetch 가 비운 목록을 되채우고,
    // 뒤이은 onError 롤백이 그 stale 스냅샷을 덮어쓴다.
    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('onMutate 의 취소는 낙관 갱신을 건너뛰는 경로(오프라인)에서도 먼저 일어난다', async () => {
    mockShouldApplyOptimisticUpdate.mockReturnValue(false);
    const options = renderAndCaptureOptions();

    await options.onMutate();

    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('mutationFn은 온라인 가드 후 서비스에 사용자 ID를 전달한다', async () => {
    mockDeleteAllNotificationsService.mockResolvedValue(5);
    const options = renderAndCaptureOptions();

    const result = await options.mutationFn();

    expect(mockRequireOnlineForMutation).toHaveBeenCalledWith(
      'useNotifications.deleteAllNotifications'
    );
    expect(mockDeleteAllNotificationsService).toHaveBeenCalledWith('user-1');
    expect(result).toBe(5);
  });

  it('onMutate는 목록 캐시(렌더 소스)를 비우고 스토어도 초기화한다', async () => {
    const options = renderAndCaptureOptions();

    const context = await options.onMutate();

    // 렌더 소스인 목록 캐시가 실제로 비워져야 한다 (스토어만 비우면 화면은 그대로다)
    expect(mockSetQueryData).toHaveBeenCalledWith(LIST_KEY, EMPTIED_LIST);
    // 목록이 아닌 캐시(설정)는 건드리지 않는다
    expect(mockSetQueryData).toHaveBeenCalledTimes(1);
    expect(mockSetQueryData).not.toHaveBeenCalledWith(SETTINGS_KEY, expect.anything());

    // 스냅샷 축(스토어)도 함께 비운다
    expect(mockClearNotifications).toHaveBeenCalledTimes(1);

    expect(context.previousLists).toEqual([[LIST_KEY, CACHED_LIST]]);
    expect(context.previousNotifications).toEqual(mockStoreState.notifications);
  });

  it('낙관적 업데이트 비활성 시 onMutate는 캐시도 스토어도 건드리지 않는다', async () => {
    mockShouldApplyOptimisticUpdate.mockReturnValue(false);
    const options = renderAndCaptureOptions();

    const context = await options.onMutate();

    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(mockClearNotifications).not.toHaveBeenCalled();
    expect(context.previousLists).toBeUndefined();
    expect(context.previousNotifications).toBeUndefined();
  });

  it('onError는 목록 캐시와 스토어를 함께 롤백하고 에러 토스트를 띄운다', () => {
    const options = renderAndCaptureOptions();
    const previous = [{ id: 'n-1' }];

    options.onError(new Error('삭제 실패'), undefined, {
      previousLists: [[LIST_KEY, previous]],
      previousNotifications: previous,
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(LIST_KEY, previous);
    expect(mockSetNotifications).toHaveBeenCalledWith(previous);
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('onSuccess는 알림 쿼리 전체를 무효화하고 성공 토스트를 띄운다', () => {
    const options = renderAndCaptureOptions();

    options.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications'],
    });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });
});
