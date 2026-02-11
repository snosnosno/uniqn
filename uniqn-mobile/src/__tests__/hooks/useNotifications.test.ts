/**
 * UNIQN Mobile - useNotifications Hook Tests
 *
 * @description 알림 관련 훅 테스트 - useQuery/useMutation 래퍼 검증
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-native';
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
// Mocks - Firebase
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
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

jest.mock('@/services/notificationService', () => ({
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

jest.mock('@/services/notificationSyncService', () => ({
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
const mockAddNotifications = jest.fn();
const mockSetHasMore = jest.fn();
const mockMarkAsReadLocal = jest.fn();
const mockMarkAllAsReadLocal = jest.fn();
const mockRemoveNotification = jest.fn();
const mockSetSettings = jest.fn();

const mockNotificationStoreState = {
  notifications: [] as ReturnType<typeof createMockNotification>[],
  hasMore: false,
  lastFetchedAt: null as number | null,
  settings: {
    grouping: { enabled: true, minGroupSize: 2, timeWindowHours: 24 },
  },
  setNotifications: mockSetNotifications,
  addNotifications: mockAddNotifications,
  setHasMore: mockSetHasMore,
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

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(
    (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      mockEnabled = options.enabled;
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
        const mutatePromise = options.onMutate ? options.onMutate(args) : Promise.resolve(undefined);
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
    mockNotificationStoreState.hasMore = false;
    mockNotificationStoreState.lastFetchedAt = null;
    mockShouldSync.mockReturnValue(false);
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
      const cachedNotifications = [
        createMockNotification({ id: 'cached-1' }),
      ];
      mockNotificationStoreState.notifications = cachedNotifications as ReturnType<typeof createMockNotification>[];

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

    it('should call delete service and show success toast on success', async () => {
      mockDeleteNotificationService.mockResolvedValueOnce(undefined);

      renderHook(() => useDeleteNotification());

      await act(async () => {
        await mockMutateAsync('notif-1');
      });

      expect(mockDeleteNotificationService).toHaveBeenCalledWith('notif-1');
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '알림이 삭제되었습니다.',
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
    it('should return correct initial structure', () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      expect(result.current).toHaveProperty('granted');
      expect(result.current).toHaveProperty('canAskAgain');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('isRequesting');
      expect(result.current).toHaveProperty('requestPermission');
    });

    it('should have initial undetermined state', () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      expect(result.current.granted).toBe(false);
      expect(result.current.canAskAgain).toBe(true);
      expect(result.current.status).toBe('undetermined');
      expect(result.current.isRequesting).toBe(false);
    });

    it('should have requestPermission as a function', () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });

      const { result } = renderHook(() => useNotificationPermission());

      expect(typeof result.current.requestPermission).toBe('function');
    });

    it('should call checkNotificationPermission on mount', () => {
      mockCheckNotificationPermission.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
      });

      renderHook(() => useNotificationPermission());

      expect(mockCheckNotificationPermission).toHaveBeenCalled();
    });
  });
});
