import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useNotificationHandler } from '../useNotificationHandler';

const mockInitialize = jest.fn();
const mockCheckPermission = jest.fn();
const mockSetNotificationReceivedHandler = jest.fn();
const mockSetNotificationResponseHandler = jest.fn();
const mockRegisterToken = jest.fn();
const mockUnregisterToken = jest.fn();
const mockSetBadge = jest.fn();
const mockClearBadge = jest.fn();
const mockTokenRefreshStart = jest.fn();
const mockTokenRefreshStop = jest.fn();
const mockShouldRefreshOnForeground = jest.fn();
const mockTriggerRefresh = jest.fn();
const mockSubscribeToUnreadCount = jest.fn();
const mockSyncUnreadCounterFromServer = jest.fn();
const mockAddToast = jest.fn();

let mockAppStateChangeListener: ((state: AppStateStatus) => void | Promise<void>) | null = null;
const originalPlatformOS = Platform.OS;
const originalAppStateCurrentState = AppState.currentState;

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { uid: 'user-1' },
    status: 'authenticated',
  }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    addToast: mockAddToast,
  }),
}));

const mockNotificationStoreState = {
  addNotification: jest.fn(),
  setUnreadCount: jest.fn(),
  lastCounterLocalUpdate: 0,
  needsServerSync: false,
  setNeedsServerSync: jest.fn(),
};

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: {
    getState: () => mockNotificationStoreState,
  },
}));

jest.mock('@/services/notifications/pushNotificationService', () => ({
  pushNotificationService: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
    setNotificationReceivedHandler: (...args: unknown[]) =>
      mockSetNotificationReceivedHandler(...args),
    setNotificationResponseHandler: (...args: unknown[]) =>
      mockSetNotificationResponseHandler(...args),
    registerToken: (...args: unknown[]) => mockRegisterToken(...args),
    unregisterToken: (...args: unknown[]) => mockUnregisterToken(...args),
    setBadge: (...args: unknown[]) => mockSetBadge(...args),
    clearBadge: (...args: unknown[]) => mockClearBadge(...args),
  },
}));

jest.mock('@/services/notifications/notificationService', () => ({
  createNotificationFromFCM: jest.fn(() => null),
  subscribeToUnreadCount: (...args: unknown[]) => mockSubscribeToUnreadCount(...args),
  syncUnreadCounterFromServer: (...args: unknown[]) => mockSyncUnreadCounterFromServer(...args),
}));

jest.mock('@/services/observability', () => ({
  navigateFromNotification: jest.fn().mockResolvedValue(true),
  waitForNavigationReadyAsync: jest.fn().mockResolvedValue(undefined),
  trackEvent: jest.fn(),
}));

jest.mock('@/services/observability/tokenRefreshService', () => ({
  start: (...args: unknown[]) => mockTokenRefreshStart(...args),
  stop: (...args: unknown[]) => mockTokenRefreshStop(...args),
  shouldRefreshOnForeground: (...args: unknown[]) => mockShouldRefreshOnForeground(...args),
  triggerRefresh: (...args: unknown[]) => mockTriggerRefresh(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('useNotificationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateChangeListener = null;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        (_type: string, listener: (state: AppStateStatus) => void | Promise<void>) => {
          mockAppStateChangeListener = listener;

          return {
            remove: jest.fn(() => {
              mockAppStateChangeListener = null;
            }),
          } as ReturnType<typeof AppState.addEventListener>;
        }
      );
    mockNotificationStoreState.lastCounterLocalUpdate = 0;
    mockNotificationStoreState.needsServerSync = false;
    mockInitialize.mockResolvedValue(undefined);
    mockCheckPermission
      .mockResolvedValueOnce({
        granted: false,
        canAskAgain: false,
        status: 'denied',
      })
      .mockResolvedValueOnce({
        granted: true,
        canAskAgain: false,
        status: 'granted',
      });
    mockRegisterToken.mockResolvedValue(true);
    mockUnregisterToken.mockResolvedValue(true);
    mockSetBadge.mockResolvedValue(undefined);
    mockClearBadge.mockResolvedValue(undefined);
    mockSubscribeToUnreadCount.mockReturnValue(jest.fn());
    mockSyncUnreadCounterFromServer.mockResolvedValue(null);
    mockShouldRefreshOnForeground.mockReturnValue(false);
    mockTriggerRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: originalAppStateCurrentState,
    });
  });

  it('refreshes permission status when the app returns from settings', async () => {
    const { result } = renderHook(() => useNotificationHandler());

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe('denied');
    });

    expect(mockAppStateChangeListener).not.toBeNull();

    await act(async () => {
      await mockAppStateChangeListener?.('background');
      await mockAppStateChangeListener?.('active');
    });

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe('granted');
    });

    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledTimes(1);
    });
  });
});
