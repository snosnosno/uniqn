/**
 * UNIQN Mobile - Notification Service Tests
 *
 * @description 알림 서비스 테스트
 * @version 1.0.0
 */

import { Platform } from 'react-native';

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

jest.mock('@/repositories', () => ({
  notificationRepository: {
    getById: jest.fn(),
    getByUserId: jest.fn(),
    getUnreadCount: jest.fn(),
    getUnreadCounterFromCache: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    deleteOlderThan: jest.fn(),
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
    registerFCMToken: jest.fn(),
    unregisterFCMToken: jest.fn(),
    unregisterAllFCMTokens: jest.fn(),
    subscribeToNotifications: jest.fn(),
    subscribeToUnreadCount: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/services/pushNotificationService', () => ({
  checkPermission: jest.fn(),
  requestPermission: jest.fn(),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  fetchNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  cleanupOldNotifications,
  subscribeToNotifications,
  subscribeToUnreadCount,
  getNotificationSettings,
  saveNotificationSettings,
  checkNotificationPermission,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
} from '../notificationService';
import { notificationRepository } from '@/repositories';
import * as pushNotificationService from '@/services/pushNotificationService';

// Get typed mock references
const mockRepo = notificationRepository as jest.Mocked<typeof notificationRepository>;
const mockPushService = pushNotificationService as jest.Mocked<typeof pushNotificationService>;

// ============================================================================
// Test Data Helpers
// ============================================================================

function createMockNotificationData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    recipientId: 'user-1',
    type: 'new_application',
    title: '새로운 지원자',
    body: '홍길동님이 지원했습니다.',
    isRead: false,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  };
}

function createMockSettings() {
  return {
    enabled: true,
    pushEnabled: true,
    categories: {
      application: { enabled: true, pushEnabled: true },
      attendance: { enabled: true, pushEnabled: true },
      settlement: { enabled: true, pushEnabled: true },
      job: { enabled: true, pushEnabled: true },
      system: { enabled: true, pushEnabled: true },
      admin: { enabled: true, pushEnabled: true },
    },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // fetchNotifications
  // ==========================================================================
  describe('fetchNotifications', () => {
    it('should return notifications, lastDoc, and hasMore from repository', async () => {
      const mockNotifications = [
        createMockNotificationData({ id: 'n-1' }),
        createMockNotificationData({ id: 'n-2' }),
      ];
      const mockLastDoc = { id: 'n-2' };

      mockRepo.getByUserId.mockResolvedValue({
        items: mockNotifications as any,
        lastDoc: mockLastDoc as any,
        hasMore: true,
      });

      const result = await fetchNotifications({ userId: 'user-1' });

      expect(mockRepo.getByUserId).toHaveBeenCalledWith('user-1', {
        filter: undefined,
        pageSize: 20,
        lastDoc: undefined,
      });
      expect(result.notifications).toHaveLength(2);
      expect(result.lastDoc).toBe(mockLastDoc);
      expect(result.hasMore).toBe(true);
    });

    it('should return empty list when no notifications', async () => {
      mockRepo.getByUserId.mockResolvedValue({
        items: [],
        lastDoc: null as any,
        hasMore: false,
      });

      const result = await fetchNotifications({ userId: 'user-1' });

      expect(result.notifications).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('should pass filter and pageSize options to repository', async () => {
      mockRepo.getByUserId.mockResolvedValue({
        items: [],
        lastDoc: null as any,
        hasMore: false,
      });

      await fetchNotifications({
        userId: 'user-1',
        filter: { isRead: false },
        pageSize: 10,
      });

      expect(mockRepo.getByUserId).toHaveBeenCalledWith('user-1', {
        filter: { isRead: false },
        pageSize: 10,
        lastDoc: undefined,
      });
    });

    it('should pass lastDoc for pagination cursor', async () => {
      const cursorDoc = { id: 'cursor-doc' } as any;
      mockRepo.getByUserId.mockResolvedValue({
        items: [],
        lastDoc: null as any,
        hasMore: false,
      });

      await fetchNotifications({
        userId: 'user-1',
        lastDoc: cursorDoc,
      });

      expect(mockRepo.getByUserId).toHaveBeenCalledWith('user-1', {
        filter: undefined,
        pageSize: 20,
        lastDoc: cursorDoc,
      });
    });

    it('should propagate repository errors', async () => {
      mockRepo.getByUserId.mockRejectedValue(new Error('Firestore error'));

      await expect(fetchNotifications({ userId: 'user-1' })).rejects.toThrow('Firestore error');
    });
  });

  // ==========================================================================
  // getUnreadCount
  // ==========================================================================
  describe('getUnreadCount', () => {
    it('should return unread count from repository', async () => {
      mockRepo.getUnreadCount.mockResolvedValue(5);

      const result = await getUnreadCount('user-1');

      expect(mockRepo.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      mockRepo.getUnreadCount.mockResolvedValue(0);

      const result = await getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('should propagate repository errors', async () => {
      mockRepo.getUnreadCount.mockRejectedValue(new Error('Count failed'));

      await expect(getUnreadCount('user-1')).rejects.toThrow('Count failed');
    });
  });

  // ==========================================================================
  // getNotification
  // ==========================================================================
  describe('getNotification', () => {
    it('should return notification by id', async () => {
      const mockNotification = createMockNotificationData();
      mockRepo.getById.mockResolvedValue(mockNotification as any);

      const result = await getNotification('notification-1');

      expect(mockRepo.getById).toHaveBeenCalledWith('notification-1');
      expect(result).toEqual(mockNotification);
    });

    it('should return null when notification not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      const result = await getNotification('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate repository errors', async () => {
      mockRepo.getById.mockRejectedValue(new Error('Not found'));

      await expect(getNotification('bad-id')).rejects.toThrow('Not found');
    });
  });

  // ==========================================================================
  // markAsRead
  // ==========================================================================
  describe('markAsRead', () => {
    it('should mark notification as read via repository', async () => {
      mockRepo.markAsRead.mockResolvedValue(undefined);

      await markAsRead('notification-1');

      expect(mockRepo.markAsRead).toHaveBeenCalledWith('notification-1');
    });

    it('should propagate repository errors', async () => {
      mockRepo.markAsRead.mockRejectedValue(new Error('Update failed'));

      await expect(markAsRead('notification-1')).rejects.toThrow('Update failed');
    });
  });

  // ==========================================================================
  // markAllAsRead
  // ==========================================================================
  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockRepo.markAllAsRead.mockResolvedValue({ updatedIds: [] });

      await markAllAsRead('user-1');

      expect(mockRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });

    it('should propagate repository errors', async () => {
      mockRepo.markAllAsRead.mockRejectedValue(new Error('Batch failed'));

      await expect(markAllAsRead('user-1')).rejects.toThrow('Batch failed');
    });
  });

  // ==========================================================================
  // deleteNotification
  // ==========================================================================
  describe('deleteNotification', () => {
    it('should delete a notification via repository', async () => {
      mockRepo.delete.mockResolvedValue({ wasUnread: false });

      await deleteNotification('notification-1');

      expect(mockRepo.delete).toHaveBeenCalledWith('notification-1');
    });

    it('should propagate repository errors', async () => {
      mockRepo.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteNotification('notification-1')).rejects.toThrow('Delete failed');
    });
  });

  // ==========================================================================
  // deleteNotifications (batch)
  // ==========================================================================
  describe('deleteNotifications', () => {
    it('should delete multiple notifications via repository', async () => {
      mockRepo.deleteMany.mockResolvedValue({ deletedUnreadCount: 0 });

      const ids = ['n-1', 'n-2', 'n-3'];
      await deleteNotifications(ids);

      expect(mockRepo.deleteMany).toHaveBeenCalledWith(ids);
    });

    it('should handle empty array', async () => {
      mockRepo.deleteMany.mockResolvedValue({ deletedUnreadCount: 0 });

      await deleteNotifications([]);

      expect(mockRepo.deleteMany).toHaveBeenCalledWith([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.deleteMany.mockRejectedValue(new Error('Batch delete failed'));

      await expect(deleteNotifications(['n-1'])).rejects.toThrow('Batch delete failed');
    });
  });

  // ==========================================================================
  // cleanupOldNotifications
  // ==========================================================================
  describe('cleanupOldNotifications', () => {
    it('should cleanup old notifications with default 30 days', async () => {
      mockRepo.deleteOlderThan.mockResolvedValue(10);

      const result = await cleanupOldNotifications('user-1');

      expect(mockRepo.deleteOlderThan).toHaveBeenCalledWith('user-1', 30);
      expect(result).toBe(10);
    });

    it('should cleanup with custom days parameter', async () => {
      mockRepo.deleteOlderThan.mockResolvedValue(5);

      const result = await cleanupOldNotifications('user-1', 7);

      expect(mockRepo.deleteOlderThan).toHaveBeenCalledWith('user-1', 7);
      expect(result).toBe(5);
    });

    it('should return 0 when no old notifications to clean', async () => {
      mockRepo.deleteOlderThan.mockResolvedValue(0);

      const result = await cleanupOldNotifications('user-1');

      expect(result).toBe(0);
    });

    it('should propagate repository errors', async () => {
      mockRepo.deleteOlderThan.mockRejectedValue(new Error('Cleanup failed'));

      await expect(cleanupOldNotifications('user-1')).rejects.toThrow('Cleanup failed');
    });
  });

  // ==========================================================================
  // subscribeToNotifications
  // ==========================================================================
  describe('subscribeToNotifications', () => {
    it('should subscribe to notifications via repository', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeToNotifications.mockReturnValue(mockUnsubscribe);
      const onNotifications = jest.fn();
      const onError = jest.fn();

      const unsubscribe = subscribeToNotifications('user-1', onNotifications, onError);

      expect(mockRepo.subscribeToNotifications).toHaveBeenCalledWith(
        'user-1',
        onNotifications,
        onError
      );
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should return unsubscribe function that can be called', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeToNotifications.mockReturnValue(mockUnsubscribe);

      const unsubscribe = subscribeToNotifications('user-1', jest.fn());

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // subscribeToUnreadCount
  // ==========================================================================
  describe('subscribeToUnreadCount', () => {
    it('should subscribe to unread count via repository', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeToUnreadCount.mockReturnValue(mockUnsubscribe);
      const onCount = jest.fn();
      const onError = jest.fn();

      const unsubscribe = subscribeToUnreadCount('user-1', onCount, onError);

      expect(mockRepo.subscribeToUnreadCount).toHaveBeenCalledWith('user-1', onCount, onError);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  // ==========================================================================
  // getNotificationSettings
  // ==========================================================================
  describe('getNotificationSettings', () => {
    it('should return notification settings from repository', async () => {
      const mockSettings = createMockSettings();
      mockRepo.getSettings.mockResolvedValue(mockSettings as any);

      const result = await getNotificationSettings('user-1');

      expect(mockRepo.getSettings).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockSettings);
      expect(result.enabled).toBe(true);
      expect(result.categories.application.enabled).toBe(true);
    });

    it('should propagate repository errors', async () => {
      mockRepo.getSettings.mockRejectedValue(new Error('Settings fetch failed'));

      await expect(getNotificationSettings('user-1')).rejects.toThrow('Settings fetch failed');
    });
  });

  // ==========================================================================
  // saveNotificationSettings
  // ==========================================================================
  describe('saveNotificationSettings', () => {
    it('should save notification settings via repository', async () => {
      mockRepo.saveSettings.mockResolvedValue(undefined);
      const settings = createMockSettings();

      await saveNotificationSettings('user-1', settings as any);

      expect(mockRepo.saveSettings).toHaveBeenCalledWith('user-1', settings);
    });

    it('should save settings with disabled notifications', async () => {
      mockRepo.saveSettings.mockResolvedValue(undefined);
      const settings = {
        ...createMockSettings(),
        enabled: false,
      };

      await saveNotificationSettings('user-1', settings as any);

      expect(mockRepo.saveSettings).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it('should propagate repository errors', async () => {
      mockRepo.saveSettings.mockRejectedValue(new Error('Save failed'));

      await expect(saveNotificationSettings('user-1', createMockSettings() as any)).rejects.toThrow(
        'Save failed'
      );
    });
  });

  // ==========================================================================
  // registerFCMToken
  // ==========================================================================
  describe('registerFCMToken', () => {
    it('should register FCM token via repository', async () => {
      mockRepo.registerFCMToken.mockResolvedValue(undefined);
      const metadata = { type: 'expo' as const, platform: 'ios' as const };

      await registerFCMToken('user-1', 'mock-fcm-token', metadata);

      expect(mockRepo.registerFCMToken).toHaveBeenCalledWith('user-1', 'mock-fcm-token', metadata);
    });

    it('should handle Android platform token', async () => {
      mockRepo.registerFCMToken.mockResolvedValue(undefined);
      const metadata = { type: 'fcm' as const, platform: 'android' as const };

      await registerFCMToken('user-1', 'android-token', metadata);

      expect(mockRepo.registerFCMToken).toHaveBeenCalledWith('user-1', 'android-token', metadata);
    });

    it('should propagate repository errors', async () => {
      mockRepo.registerFCMToken.mockRejectedValue(new Error('Token registration failed'));

      await expect(
        registerFCMToken('user-1', 'token', { type: 'expo', platform: 'ios' })
      ).rejects.toThrow('Token registration failed');
    });
  });

  // ==========================================================================
  // unregisterFCMToken
  // ==========================================================================
  describe('unregisterFCMToken', () => {
    it('should unregister FCM token via repository', async () => {
      mockRepo.unregisterFCMToken.mockResolvedValue(undefined);

      await unregisterFCMToken('user-1', 'mock-fcm-token');

      expect(mockRepo.unregisterFCMToken).toHaveBeenCalledWith('user-1', 'mock-fcm-token');
    });

    it('should propagate repository errors', async () => {
      mockRepo.unregisterFCMToken.mockRejectedValue(new Error('Token unregister failed'));

      await expect(unregisterFCMToken('user-1', 'token')).rejects.toThrow(
        'Token unregister failed'
      );
    });
  });

  // ==========================================================================
  // unregisterAllFCMTokens
  // ==========================================================================
  describe('unregisterAllFCMTokens', () => {
    it('should unregister all FCM tokens via repository', async () => {
      mockRepo.unregisterAllFCMTokens.mockResolvedValue(undefined);

      await unregisterAllFCMTokens('user-1');

      expect(mockRepo.unregisterAllFCMTokens).toHaveBeenCalledWith('user-1');
    });

    it('should propagate repository errors', async () => {
      mockRepo.unregisterAllFCMTokens.mockRejectedValue(new Error('Unregister all failed'));

      await expect(unregisterAllFCMTokens('user-1')).rejects.toThrow('Unregister all failed');
    });
  });

  // ==========================================================================
  // checkNotificationPermission (Platform-dependent)
  // ==========================================================================
  describe('checkNotificationPermission', () => {
    it('should return denied status on web platform', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await checkNotificationPermission();

      expect(result).toEqual({
        granted: false,
        canAskAgain: false,
        status: 'denied',
      });

      Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
    });

    it('should delegate to pushNotificationService on native platform', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      mockPushService.checkPermission.mockResolvedValue({
        granted: true,
        canAskAgain: true,
        status: 'granted',
      });

      const result = await checkNotificationPermission();

      expect(mockPushService.checkPermission).toHaveBeenCalled();
      expect(result.granted).toBe(true);

      Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
    });
  });

  // ==========================================================================
  // requestNotificationPermission (Platform-dependent)
  // ==========================================================================
  describe('requestNotificationPermission', () => {
    it('should return denied status on web platform', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const result = await requestNotificationPermission();

      expect(result).toEqual({
        granted: false,
        canAskAgain: false,
        status: 'denied',
      });

      Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
    });

    it('should delegate to pushNotificationService on native platform', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      mockPushService.requestPermission.mockResolvedValue({
        granted: true,
        canAskAgain: false,
        status: 'granted',
      });

      const result = await requestNotificationPermission();

      expect(mockPushService.requestPermission).toHaveBeenCalled();
      expect(result.granted).toBe(true);

      Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
    });
  });
});
