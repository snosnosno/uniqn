import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { getToken, pushNotificationService } from '../pushNotificationService';
import { logger } from '@/utils/logger';

const mockGetPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockLeaveBreadcrumb = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
}));

jest.mock('@/repositories', () => ({
  notificationRepository: {
    registerFCMToken: jest.fn(),
    unregisterFCMToken: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/observability', () => ({
  crashlyticsService: {
    recordError: jest.fn(),
    leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  },
}));

describe('pushNotificationService transient Expo token handling', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    pushNotificationService.cleanup();

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    Object.defineProperty(Device, 'isDevice', { configurable: true, value: true });
    Object.defineProperty(Constants, 'expoConfig', {
      configurable: true,
      value: { extra: { eas: { projectId: 'test-project-id' } } },
    });

    mockSetNotificationHandler.mockImplementation(() => undefined);
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
    mockGetPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });

    await pushNotificationService.initialize();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries transient Expo 503 failures and downgrades observability to warn', async () => {
    const transientError = new Error(
      'Error encountered while fetching Expo token, expected an OK response, received: 503 (body: "{\"errors\":[{\"message\":\"The Expo API server is temporarily unavailable due to high load. Try again in a moment.\",\"code\":\"SERVICE_UNAVAILABLE\",\"isTransient\":true,\"extensions\":{\"code\":\"SERVICE_UNAVAILABLE\",\"isTransient\":true,\"requestId\":\"req-503\"}}]}").'
    );
    mockGetExpoPushTokenAsync.mockRejectedValue(transientError);

    const resultPromise = getToken();
    await jest.advanceTimersByTimeAsync(2750);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'Expo Push Token fetch temporarily unavailable',
      expect.objectContaining({
        action: 'getToken',
        requestId: 'req-503',
        statusCode: 503,
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith(
      'expo_push_token_temporarily_unavailable',
      expect.objectContaining({
        isTransient: true,
        requestId: 'req-503',
        statusCode: 503,
      })
    );
  });
});
