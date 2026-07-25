/**
 * UNIQN Mobile - useDeleteAllNotifications Hook Tests
 *
 * @description 모든 알림 삭제 훅 — 낙관적 초기화·롤백·캐시 무효화 검증
 */

import { renderHook } from '@testing-library/react-native';
import { useDeleteAllNotifications } from '../useNotifications';

const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockClearNotifications = jest.fn();
const mockSetNotifications = jest.fn();
const mockAddToast = jest.fn();
const mockDeleteAllNotificationsService = jest.fn();
const mockRequireOnlineForMutation = jest.fn();
const mockShouldApplyOptimisticUpdate = jest.fn(() => true);

const mockStoreState = {
  notifications: [
    { id: 'n-1', isRead: false },
    { id: 'n-2', isRead: true },
  ],
  setNotifications: mockSetNotifications,
  clearNotifications: mockClearNotifications,
  addNotifications: jest.fn(),
  setHasMore: jest.fn(),
  lastFetchedAt: null,
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  removeNotification: jest.fn(),
  setSettings: jest.fn(),
  settings: null,
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
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

type MutationOptions = {
  mutationFn: () => Promise<number>;
  onMutate: () =>
    | { previousNotifications?: unknown[] }
    | Promise<{ previousNotifications?: unknown[] }>;
  onSuccess: () => void;
  onError: (
    error: Error,
    variables: unknown,
    context?: { previousNotifications?: unknown[] }
  ) => void;
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

  it('onMutate는 목록 스냅샷을 남기고 스토어를 즉시 초기화한다', async () => {
    const options = renderAndCaptureOptions();

    const context = await options.onMutate();

    expect(mockClearNotifications).toHaveBeenCalledTimes(1);
    expect(context.previousNotifications).toEqual(mockStoreState.notifications);
  });

  it('낙관적 업데이트 비활성 시 onMutate는 스토어를 건드리지 않는다', async () => {
    mockShouldApplyOptimisticUpdate.mockReturnValue(false);
    const options = renderAndCaptureOptions();

    const context = await options.onMutate();

    expect(mockClearNotifications).not.toHaveBeenCalled();
    expect(context.previousNotifications).toBeUndefined();
  });

  it('onError는 스냅샷으로 롤백하고 에러 토스트를 띄운다', () => {
    const options = renderAndCaptureOptions();
    const previous = [{ id: 'n-1' }];

    options.onError(new Error('삭제 실패'), undefined, {
      previousNotifications: previous,
    });

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
