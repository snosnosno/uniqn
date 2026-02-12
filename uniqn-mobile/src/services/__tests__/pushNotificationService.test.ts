/**
 * UNIQN Mobile - Push Notification Service 테스트
 *
 * @description pushNotificationService.ts의 전체 기능 테스트
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ============================================================================
// Mocks - 반드시 import 전에 선언
// ============================================================================

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockGetBadgeCountAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockCancelAllScheduledNotificationsAsync = jest.fn();
const mockDismissAllNotificationsAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockRegisterFCMToken = jest.fn();
const mockUnregisterFCMToken = jest.fn();
const mockRecordError = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  setBadgeCountAsync: (...args: unknown[]) => mockSetBadgeCountAsync(...args),
  getBadgeCountAsync: (...args: unknown[]) => mockGetBadgeCountAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => mockCancelAllScheduledNotificationsAsync(...args),
  dismissAllNotificationsAsync: (...args: unknown[]) => mockDismissAllNotificationsAsync(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockAddNotificationResponseReceivedListener(...args),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
  },
}));

jest.mock('@/repositories', () => ({
  notificationRepository: {
    registerFCMToken: (...args: unknown[]) => mockRegisterFCMToken(...args),
    unregisterFCMToken: (...args: unknown[]) => mockUnregisterFCMToken(...args),
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

jest.mock('../crashlyticsService', () => ({
  crashlyticsService: {
    recordError: (...args: unknown[]) => mockRecordError(...args),
  },
}));

// Import after mocks
import { pushNotificationService } from '../pushNotificationService';
import { logger } from '@/utils/logger';

// ============================================================================
// Test Suites
// ============================================================================

describe('pushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pushNotificationService.cleanup(); // 상태 초기화
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    Object.defineProperty(Device, 'isDevice', { value: true, writable: true });
    Object.defineProperty(Constants, 'expoConfig', {
      value: { extra: { eas: { projectId: 'test-project-id' } } },
      writable: true,
      configurable: true,
    });
  });

  // ==========================================================================
  // Initialization Tests (6 tests)
  // ==========================================================================

  describe('initialize', () => {
    it('웹 플랫폼에서는 경고 로그를 남기고 true를 반환해야 함', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await pushNotificationService.initialize();

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('푸시 알림은 웹에서 지원되지 않습니다');
    });

    it('시뮬레이터에서는 경고 로그를 남기고 true를 반환해야 함', async () => {
      Object.defineProperty(Device, 'isDevice', { value: false, writable: true });

      const result = await pushNotificationService.initialize();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('푸시 알림은 실제 디바이스에서만 작동합니다');
    });

    it('Android에서 성공적으로 초기화하고 채널을 설정해야 함', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
      mockSetNotificationChannelAsync.mockResolvedValue(undefined);

      const result = await pushNotificationService.initialize();

      expect(result).toBe(true);
      expect(mockSetNotificationChannelAsync).toHaveBeenCalled();
      expect(mockSetNotificationHandler).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('푸시 알림 서비스 초기화 완료'));
    });

    it('iOS에서 성공적으로 초기화하고 채널 설정을 건너뛰어야 함', async () => {
      const result = await pushNotificationService.initialize();

      expect(result).toBe(true);
      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
      expect(mockSetNotificationHandler).toHaveBeenCalled();
    });

    it('초기화 실패 시 에러를 기록하고 false를 반환해야 함', async () => {
      const mockError = new Error('초기화 실패');
      mockSetNotificationHandler.mockImplementation(() => {
        throw mockError;
      });

      const result = await pushNotificationService.initialize();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
      expect(mockRecordError).toHaveBeenCalled();

      // 상태 복구
      mockSetNotificationHandler.mockClear();
    });

    it('중복 초기화 시 바로 true를 반환해야 함', async () => {
      await pushNotificationService.initialize();
      jest.clearAllMocks();

      const result = await pushNotificationService.initialize();

      expect(result).toBe(true);
      expect(mockSetNotificationHandler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Permission Tests (7 tests)
  // ==========================================================================

  describe('checkPermission / requestPermission', () => {
    beforeEach(async () => {
      await pushNotificationService.initialize();
    });

    it('웹에서는 denied 상태를 반환해야 함', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await pushNotificationService.checkPermission();

      expect(result).toEqual({
        granted: false,
        canAskAgain: false,
        status: 'denied',
      });
    });

    it('권한이 허용된 경우 granted를 반환해야 함', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        ios: {
          allowsAlert: true,
          allowsBadge: true,
          allowsSound: true,
        },
      });

      const result = await pushNotificationService.checkPermission();

      expect(result.granted).toBe(true);
      expect(result.status).toBe('granted');
    });

    it('권한이 거부된 경우 denied를 반환해야 함', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });

      const result = await pushNotificationService.checkPermission();

      expect(result.granted).toBe(false);
      expect(result.status).toBe('denied');
    });

    it('권한 요청이 허용되면 granted를 반환해야 함', async () => {
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      const result = await pushNotificationService.requestPermission();

      expect(result.granted).toBe(true);
      expect(result.status).toBe('granted');
    });

    it('iOS에서 모든 권한을 요청해야 함', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      await pushNotificationService.requestPermission();

      expect(mockRequestPermissionsAsync).toHaveBeenCalledWith({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    });

    it('권한 확인 실패 시 undetermined 상태를 반환해야 함', async () => {
      mockGetPermissionsAsync.mockRejectedValue(new Error('권한 확인 실패'));

      const result = await pushNotificationService.checkPermission();

      expect(result).toMatchObject({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });
    });

    it('권한 요청 실패 시 undetermined 상태를 반환해야 함', async () => {
      mockRequestPermissionsAsync.mockRejectedValue(new Error('권한 요청 실패'));

      const result = await pushNotificationService.requestPermission();

      expect(result).toMatchObject({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      });
    });
  });

  // ==========================================================================
  // Token Management Tests (8 tests)
  // ==========================================================================

  describe('Token Management', () => {
    beforeEach(async () => {
      await pushNotificationService.initialize();
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });
    });

    it('성공적으로 Expo Push Token을 발급받아야 함', async () => {
      const mockToken = 'ExponentPushToken[test]';
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: mockToken });

      const result = await pushNotificationService.getToken();

      expect(result).toEqual({
        token: mockToken,
        type: 'expo',
      });
    });

    it('권한이 없으면 null을 반환해야 함', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });

      const result = await pushNotificationService.getToken();

      expect(result).toBeNull();
    });

    it('projectId가 없으면 null을 반환해야 함', async () => {
      Object.defineProperty(Constants, 'expoConfig', {
        value: { extra: { eas: {} } },
        writable: true,
        configurable: true,
      });

      const result = await pushNotificationService.getToken();

      expect(result).toBeNull();
    });

    it('토큰을 성공적으로 등록해야 함', async () => {
      const mockToken = 'ExponentPushToken[test]';
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: mockToken });
      mockRegisterFCMToken.mockResolvedValue(undefined);

      const result = await pushNotificationService.registerToken('user123');

      expect(result).toBe(true);
      expect(mockRegisterFCMToken).toHaveBeenCalledWith(
        'user123',
        mockToken,
        expect.objectContaining({
          type: 'expo',
        })
      );
    });

    it('토큰이 없으면 등록을 건너뛰어야 함', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });

      const result = await pushNotificationService.registerToken('user123');

      expect(result).toBe(false);
      expect(mockRegisterFCMToken).not.toHaveBeenCalled();
    });

    it('등록된 토큰을 해제해야 함', async () => {
      // 먼저 토큰 등록
      const mockToken = 'ExponentPushToken[test]';
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: mockToken });
      await pushNotificationService.registerToken('user123');

      mockUnregisterFCMToken.mockResolvedValue(undefined);

      const result = await pushNotificationService.unregisterToken('user123');

      expect(result).toBe(true);
      expect(mockUnregisterFCMToken).toHaveBeenCalledWith('user123', mockToken);
    });

    it('등록된 토큰을 반환해야 함', async () => {
      const mockToken = 'ExponentPushToken[test]';
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: mockToken });
      await pushNotificationService.registerToken('user123');

      const result = pushNotificationService.getCurrentToken();

      expect(result).toBe(mockToken);
    });

    it('등록된 토큰이 없으면 null을 반환해야 함', () => {
      const result = pushNotificationService.getCurrentToken();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Badge Management Tests (5 tests)
  // ==========================================================================

  describe('Badge Management', () => {
    beforeEach(async () => {
      await pushNotificationService.initialize();
    });

    it('뱃지 수를 설정해야 함', async () => {
      mockSetBadgeCountAsync.mockResolvedValue(undefined);

      await pushNotificationService.setBadge(5);

      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(5);
    });

    it('뱃지를 0으로 초기화해야 함', async () => {
      mockSetBadgeCountAsync.mockResolvedValue(undefined);

      await pushNotificationService.clearBadge();

      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    it('현재 뱃지 수를 반환해야 함', async () => {
      mockGetBadgeCountAsync.mockResolvedValue(3);

      const result = await pushNotificationService.getBadge();

      expect(result).toBe(3);
    });

    it('웹에서는 뱃지 조작이 무시되어야 함', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await pushNotificationService.setBadge(5);
      const result = await pushNotificationService.getBadge();

      expect(result).toBe(0);
      expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
    });

    it('조회 실패 시 0을 반환해야 함', async () => {
      mockGetBadgeCountAsync.mockRejectedValue(new Error('조회 실패'));

      const result = await pushNotificationService.getBadge();

      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // Local Notification Tests (6 tests)
  // ==========================================================================

  describe('Local Notifications', () => {
    beforeEach(async () => {
      await pushNotificationService.initialize();
    });

    const mockPayload = {
      title: '테스트 알림',
      body: '테스트 내용',
      data: { testKey: 'testValue' },
    };

    it('즉시 알림을 스케줄링해야 함', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id-1');

      const result = await pushNotificationService.scheduleLocalNotification(mockPayload);

      expect(result).toBe('notification-id-1');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: mockPayload.title,
          body: mockPayload.body,
        }),
        trigger: null,
      });
    });

    it('초 단위 트리거로 알림을 스케줄링해야 함', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id-2');

      const result = await pushNotificationService.scheduleLocalNotification(mockPayload, {
        trigger: { seconds: 60 },
      });

      expect(result).toBe('notification-id-2');
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('날짜 트리거로 알림을 스케줄링해야 함', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id-3');
      const targetDate = new Date('2026-03-01T09:00:00');

      const result = await pushNotificationService.scheduleLocalNotification(mockPayload, {
        trigger: { date: targetDate },
      });

      expect(result).toBe('notification-id-3');
    });

    it('스케줄된 알림을 취소해야 함', async () => {
      mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);

      await pushNotificationService.cancelScheduledNotification('notification-id-1');

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id-1');
    });

    it('모든 스케줄된 알림을 취소해야 함', async () => {
      mockCancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);

      await pushNotificationService.cancelAllScheduledNotifications();

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('모든 알림을 닫아야 함', async () => {
      mockDismissAllNotificationsAsync.mockResolvedValue(undefined);

      await pushNotificationService.dismissAllNotifications();

      expect(mockDismissAllNotificationsAsync).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Handler Tests (4 tests)
  // ==========================================================================

  describe('Event Handlers', () => {
    it('수신 핸들러를 설정할 수 있어야 함', () => {
      const mockHandler = jest.fn();
      pushNotificationService.setNotificationReceivedHandler(mockHandler);
      expect(true).toBe(true); // 에러 없으면 성공
    });

    it('수신 핸들러를 제거할 수 있어야 함', () => {
      pushNotificationService.setNotificationReceivedHandler(null);
      expect(true).toBe(true);
    });

    it('응답 핸들러를 설정할 수 있어야 함', () => {
      const mockHandler = jest.fn();
      pushNotificationService.setNotificationResponseHandler(mockHandler);
      expect(true).toBe(true);
    });

    it('응답 핸들러를 제거할 수 있어야 함', () => {
      pushNotificationService.setNotificationResponseHandler(null);
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Cleanup Test (1 test)
  // ==========================================================================

  describe('cleanup', () => {
    it('모든 상태를 정리해야 함', () => {
      pushNotificationService.cleanup();

      expect(pushNotificationService.getCurrentToken()).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('푸시 알림 서비스 정리 완료'));
    });
  });
});

// Total: 37 tests
