import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { useFCMTokenManager } from '../useFCMTokenManager';

const mockRegisterToken = jest.fn();
const mockUnregisterToken = jest.fn();
const mockSetBadge = jest.fn();
const mockClearBadge = jest.fn();
const mockTokenRefreshStart = jest.fn();
const mockTokenRefreshStop = jest.fn();

const originalPlatformOS = Platform.OS;
const originalAppStateCurrentState = AppState.currentState;

jest.mock('@/services/notifications/pushNotificationService', () => ({
  pushNotificationService: {
    registerToken: (...args: unknown[]) => mockRegisterToken(...args),
    unregisterToken: (...args: unknown[]) => mockUnregisterToken(...args),
    setBadge: (...args: unknown[]) => mockSetBadge(...args),
    clearBadge: (...args: unknown[]) => mockClearBadge(...args),
  },
}));

jest.mock('@/services/observability/tokenRefreshService', () => ({
  start: (...args: unknown[]) => mockTokenRefreshStart(...args),
  stop: (...args: unknown[]) => mockTokenRefreshStop(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useFCMTokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });

    mockRegisterToken.mockResolvedValue(true);
    mockUnregisterToken.mockResolvedValue(true);
    mockSetBadge.mockResolvedValue(undefined);
    mockClearBadge.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: originalAppStateCurrentState,
    });
  });

  it('schedules one active follow-up retry after an initial registration failure', async () => {
    mockRegisterToken.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    renderHook(() =>
      useFCMTokenManager({
        userId: 'user-1',
        isInitialized: true,
        permissionStatus: 'granted',
      })
    );

    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledTimes(1);
    });

    await flushAsyncWork();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledTimes(2);
    });
  });

  it('does not start a follow-up retry while the initial registration is still in flight', async () => {
    const deferred = createDeferred<boolean>();
    mockRegisterToken.mockReturnValueOnce(deferred.promise);

    renderHook(() =>
      useFCMTokenManager({
        userId: 'user-1',
        isInitialized: true,
        permissionStatus: 'granted',
      })
    );

    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });

    expect(mockRegisterToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(false);
    });

    await flushAsyncWork();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledTimes(2);
    });
  });
});
