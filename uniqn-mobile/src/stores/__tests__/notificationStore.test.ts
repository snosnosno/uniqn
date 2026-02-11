/**
 * UNIQN Mobile - Notification Store Tests
 *
 * @description Tests for notification state management (Zustand)
 */

import { act } from '@testing-library/react-native';
import {
  useNotificationStore,
  selectNotifications,
  selectUnreadCount,
  selectHasMore,
  selectSettings,
  selectFilter,
  selectUnreadByCategory,
} from '../notificationStore';
import {
  NotificationType,
  NotificationCategory,
  type NotificationData,
  type NotificationSettings,
} from '@/types/notification';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    recipientId: 'user-1',
    type: NotificationType.NEW_APPLICATION,
    title: '새로운 지원자',
    body: '홍길동님이 지원했습니다.',
    isRead: false,
    createdAt: Timestamp.now(),
    ...overrides,
  } as NotificationData;
}

describe('NotificationStore', () => {
  beforeEach(() => {
    act(() => {
      useNotificationStore.getState().reset();
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useNotificationStore.getState();

      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.hasMore).toBe(true);
      expect(state.lastFetchedAt).toBeNull();
      expect(state.settings.enabled).toBe(true);
      expect(state.filter).toEqual({});
    });

    it('should have empty unreadByCategory for all categories', () => {
      const state = useNotificationStore.getState();
      const categories = Object.values(NotificationCategory);

      categories.forEach((category) => {
        expect(state.unreadByCategory[category]).toBe(0);
      });
    });
  });

  // ============================================================================
  // setNotifications
  // ============================================================================

  describe('setNotifications', () => {
    it('should set notifications and calculate unread count', () => {
      const notifications = [
        createMockNotification({ id: 'n1', isRead: false }),
        createMockNotification({ id: 'n2', isRead: true }),
        createMockNotification({ id: 'n3', isRead: false }),
      ];

      act(() => {
        useNotificationStore.getState().setNotifications(notifications);
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(3);
      expect(state.unreadCount).toBe(2);
      expect(state.lastFetchedAt).not.toBeNull();
    });

    it('should calculate unreadByCategory correctly', () => {
      const notifications = [
        createMockNotification({
          id: 'n1',
          type: NotificationType.NEW_APPLICATION,
          isRead: false,
        }),
        createMockNotification({
          id: 'n2',
          type: NotificationType.STAFF_CHECKED_IN,
          isRead: false,
        }),
        createMockNotification({
          id: 'n3',
          type: NotificationType.NEW_APPLICATION,
          isRead: true,
        }),
      ];

      act(() => {
        useNotificationStore.getState().setNotifications(notifications);
      });

      const state = useNotificationStore.getState();
      expect(state.unreadByCategory[NotificationCategory.APPLICATION]).toBe(1);
      expect(state.unreadByCategory[NotificationCategory.ATTENDANCE]).toBe(1);
    });

    it('should replace existing notifications', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'old1' }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'new1' }),
          createMockNotification({ id: 'new2' }),
        ]);
      });

      expect(useNotificationStore.getState().notifications).toHaveLength(2);
      expect(useNotificationStore.getState().notifications[0].id).toBe('new1');
    });
  });

  // ============================================================================
  // addNotification
  // ============================================================================

  describe('addNotification', () => {
    it('should add notification to the beginning', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'existing' }),
        ]);
      });

      const newNotif = createMockNotification({ id: 'new' });
      act(() => {
        useNotificationStore.getState().addNotification(newNotif);
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].id).toBe('new');
    });

    it('should increment unread count for unread notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([]);
      });

      act(() => {
        useNotificationStore.getState().addNotification(
          createMockNotification({ id: 'n1', isRead: false })
        );
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should not increment unread count for read notification', () => {
      act(() => {
        useNotificationStore.getState().addNotification(
          createMockNotification({ id: 'n1', isRead: true })
        );
      });

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('should not add duplicate notification', () => {
      const notif = createMockNotification({ id: 'dup1' });

      act(() => {
        useNotificationStore.getState().addNotification(notif);
      });
      act(() => {
        useNotificationStore.getState().addNotification(notif);
      });

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it('should increment unreadByCategory correctly', () => {
      act(() => {
        useNotificationStore.getState().addNotification(
          createMockNotification({
            id: 'n1',
            type: NotificationType.SETTLEMENT_COMPLETED,
            isRead: false,
          })
        );
      });

      expect(
        useNotificationStore.getState().unreadByCategory[NotificationCategory.SETTLEMENT]
      ).toBe(1);
    });
  });

  // ============================================================================
  // addNotifications (batch)
  // ============================================================================

  describe('addNotifications', () => {
    it('should add multiple notifications without duplicates', () => {
      const existing = createMockNotification({ id: 'existing' });

      act(() => {
        useNotificationStore.getState().setNotifications([existing]);
      });

      act(() => {
        useNotificationStore.getState().addNotifications([
          existing, // duplicate - should be skipped
          createMockNotification({ id: 'new1' }),
          createMockNotification({ id: 'new2' }),
        ]);
      });

      expect(useNotificationStore.getState().notifications).toHaveLength(3);
    });

    it('should recalculate unread counts', () => {
      act(() => {
        useNotificationStore.getState().addNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
          createMockNotification({ id: 'n2', isRead: false }),
          createMockNotification({ id: 'n3', isRead: true }),
        ]);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });
  });

  // ============================================================================
  // updateNotification
  // ============================================================================

  describe('updateNotification', () => {
    it('should update notification fields', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', title: 'Old Title' }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().updateNotification('n1', { title: 'New Title' });
      });

      expect(useNotificationStore.getState().notifications[0].title).toBe('New Title');
    });

    it('should decrement unread when marking as read', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
          createMockNotification({ id: 'n2', isRead: false }),
        ]);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(2);

      act(() => {
        useNotificationStore.getState().updateNotification('n1', { isRead: true });
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should increment unread when marking as unread', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: true }),
        ]);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(0);

      act(() => {
        useNotificationStore.getState().updateNotification('n1', { isRead: false });
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should not change count for non-existent notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().updateNotification('non-existent', { isRead: true });
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });

  // ============================================================================
  // removeNotification
  // ============================================================================

  describe('removeNotification', () => {
    it('should remove notification by id', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1' }),
          createMockNotification({ id: 'n2' }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().removeNotification('n1');
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n2');
    });

    it('should decrement unread count for unread notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().removeNotification('n1');
      });

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('should not decrement unread count for read notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: true }),
          createMockNotification({ id: 'n2', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().removeNotification('n1');
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should do nothing for non-existent notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1' }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().removeNotification('non-existent');
      });

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  // ============================================================================
  // clearNotifications
  // ============================================================================

  describe('clearNotifications', () => {
    it('should clear all notifications and reset counts', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
          createMockNotification({ id: 'n2', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().clearNotifications();
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });
  });

  // ============================================================================
  // markAsRead
  // ============================================================================

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().markAsRead('n1');
      });

      expect(useNotificationStore.getState().notifications[0].isRead).toBe(true);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('should not change already-read notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: true }),
        ]);
      });

      const stateBefore = useNotificationStore.getState();

      act(() => {
        useNotificationStore.getState().markAsRead('n1');
      });

      // Should return same state reference when no changes
      expect(useNotificationStore.getState().unreadCount).toBe(stateBefore.unreadCount);
    });

    it('should do nothing for non-existent notification', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().markAsRead('non-existent');
      });

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });

  // ============================================================================
  // markAllAsRead
  // ============================================================================

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
          createMockNotification({ id: 'n2', isRead: false }),
          createMockNotification({ id: 'n3', isRead: true }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().markAllAsRead();
      });

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should reset all category counts to zero', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({
            id: 'n1',
            type: NotificationType.NEW_APPLICATION,
            isRead: false,
          }),
          createMockNotification({
            id: 'n2',
            type: NotificationType.STAFF_CHECKED_IN,
            isRead: false,
          }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().markAllAsRead();
      });

      const { unreadByCategory } = useNotificationStore.getState();
      Object.values(NotificationCategory).forEach((cat) => {
        expect(unreadByCategory[cat]).toBe(0);
      });
    });
  });

  // ============================================================================
  // markCategoryAsRead
  // ============================================================================

  describe('markCategoryAsRead', () => {
    it('should mark only notifications of specified category as read', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({
            id: 'n1',
            type: NotificationType.NEW_APPLICATION,
            isRead: false,
          }),
          createMockNotification({
            id: 'n2',
            type: NotificationType.STAFF_CHECKED_IN,
            isRead: false,
          }),
          createMockNotification({
            id: 'n3',
            type: NotificationType.APPLICATION_CONFIRMED,
            isRead: false,
          }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().markCategoryAsRead(NotificationCategory.APPLICATION);
      });

      const state = useNotificationStore.getState();
      // Application notifications should be read
      expect(state.notifications.find((n) => n.id === 'n1')?.isRead).toBe(true);
      expect(state.notifications.find((n) => n.id === 'n3')?.isRead).toBe(true);
      // Attendance notification should still be unread
      expect(state.notifications.find((n) => n.id === 'n2')?.isRead).toBe(false);

      expect(state.unreadByCategory[NotificationCategory.APPLICATION]).toBe(0);
      expect(state.unreadByCategory[NotificationCategory.ATTENDANCE]).toBe(1);
    });
  });

  // ============================================================================
  // Settings
  // ============================================================================

  describe('Settings', () => {
    it('should set settings', () => {
      const newSettings: NotificationSettings = {
        enabled: false,
        categories: {} as NotificationSettings['categories'],
      };

      act(() => {
        useNotificationStore.getState().setSettings(newSettings);
      });

      expect(useNotificationStore.getState().settings.enabled).toBe(false);
    });

    it('should update category setting', () => {
      act(() => {
        useNotificationStore.getState().updateCategorySetting(
          NotificationCategory.APPLICATION,
          { enabled: false, pushEnabled: false }
        );
      });

      const { settings } = useNotificationStore.getState();
      expect(settings.categories[NotificationCategory.APPLICATION].enabled).toBe(false);
      expect(settings.categories[NotificationCategory.APPLICATION].pushEnabled).toBe(false);
    });

    it('should toggle notifications', () => {
      act(() => {
        useNotificationStore.getState().toggleNotifications(false);
      });

      expect(useNotificationStore.getState().settings.enabled).toBe(false);

      act(() => {
        useNotificationStore.getState().toggleNotifications(true);
      });

      expect(useNotificationStore.getState().settings.enabled).toBe(true);
    });
  });

  // ============================================================================
  // Filter
  // ============================================================================

  describe('Filter', () => {
    it('should set filter', () => {
      act(() => {
        useNotificationStore.getState().setFilter({
          isRead: false,
          types: [NotificationType.NEW_APPLICATION],
        });
      });

      const { filter } = useNotificationStore.getState();
      expect(filter.isRead).toBe(false);
      expect(filter.types).toEqual([NotificationType.NEW_APPLICATION]);
    });

    it('should clear filter', () => {
      act(() => {
        useNotificationStore.getState().setFilter({ isRead: true });
      });

      act(() => {
        useNotificationStore.getState().clearFilter();
      });

      expect(useNotificationStore.getState().filter).toEqual({});
    });
  });

  // ============================================================================
  // getFilteredNotifications
  // ============================================================================

  describe('getFilteredNotifications', () => {
    it('should filter by isRead', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
          createMockNotification({ id: 'n2', isRead: true }),
          createMockNotification({ id: 'n3', isRead: false }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().setFilter({ isRead: false });
      });

      const filtered = useNotificationStore.getState().getFilteredNotifications();
      expect(filtered).toHaveLength(2);
      expect(filtered.every((n) => !n.isRead)).toBe(true);
    });

    it('should filter by types', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({
            id: 'n1',
            type: NotificationType.NEW_APPLICATION,
          }),
          createMockNotification({
            id: 'n2',
            type: NotificationType.ANNOUNCEMENT,
          }),
          createMockNotification({
            id: 'n3',
            type: NotificationType.NEW_APPLICATION,
          }),
        ]);
      });

      act(() => {
        useNotificationStore.getState().setFilter({
          types: [NotificationType.NEW_APPLICATION],
        });
      });

      const filtered = useNotificationStore.getState().getFilteredNotifications();
      expect(filtered).toHaveLength(2);
    });

    it('should return all notifications with empty filter', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1' }),
          createMockNotification({ id: 'n2' }),
        ]);
      });

      const filtered = useNotificationStore.getState().getFilteredNotifications();
      expect(filtered).toHaveLength(2);
    });
  });

  // ============================================================================
  // State Management Actions
  // ============================================================================

  describe('State Management', () => {
    it('should set hasMore', () => {
      act(() => {
        useNotificationStore.getState().setHasMore(false);
      });

      expect(useNotificationStore.getState().hasMore).toBe(false);
    });

    it('should set lastFetchedAt', () => {
      const timestamp = Date.now();

      act(() => {
        useNotificationStore.getState().setLastFetchedAt(timestamp);
      });

      expect(useNotificationStore.getState().lastFetchedAt).toBe(timestamp);
    });

    it('should set unreadCount directly', () => {
      act(() => {
        useNotificationStore.getState().setUnreadCount(42);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(42);
    });

    it('should decrement unread count', () => {
      act(() => {
        useNotificationStore.getState().setUnreadCount(5);
      });

      act(() => {
        useNotificationStore.getState().decrementUnreadCount(2);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(3);
    });

    it('should not allow negative unread count', () => {
      act(() => {
        useNotificationStore.getState().setUnreadCount(1);
      });

      act(() => {
        useNotificationStore.getState().decrementUnreadCount(5);
      });

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('should decrement by 1 by default', () => {
      act(() => {
        useNotificationStore.getState().setUnreadCount(3);
      });

      act(() => {
        useNotificationStore.getState().decrementUnreadCount();
      });

      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });
  });

  // ============================================================================
  // reset
  // ============================================================================

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useNotificationStore.getState().setNotifications([
          createMockNotification({ id: 'n1', isRead: false }),
        ]);
        useNotificationStore.getState().setHasMore(false);
        useNotificationStore.getState().setFilter({ isRead: true });
      });

      act(() => {
        useNotificationStore.getState().reset();
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.hasMore).toBe(true);
      expect(state.lastFetchedAt).toBeNull();
      expect(state.filter).toEqual({});
    });
  });

  // ============================================================================
  // Selectors
  // ============================================================================

  describe('Selectors', () => {
    it('should select notifications', () => {
      const notifications = [createMockNotification({ id: 'n1' })];

      act(() => {
        useNotificationStore.getState().setNotifications(notifications);
      });

      const state = useNotificationStore.getState();
      expect(selectNotifications(state)).toEqual(notifications);
    });

    it('should select unread count', () => {
      act(() => {
        useNotificationStore.getState().setUnreadCount(10);
      });

      expect(selectUnreadCount(useNotificationStore.getState())).toBe(10);
    });

    it('should select hasMore', () => {
      act(() => {
        useNotificationStore.getState().setHasMore(false);
      });

      expect(selectHasMore(useNotificationStore.getState())).toBe(false);
    });

    it('should select settings', () => {
      const state = useNotificationStore.getState();
      expect(selectSettings(state)).toBe(state.settings);
    });

    it('should select filter', () => {
      act(() => {
        useNotificationStore.getState().setFilter({ isRead: false });
      });

      const state = useNotificationStore.getState();
      expect(selectFilter(state)).toEqual({ isRead: false });
    });

    it('should select unreadByCategory', () => {
      const state = useNotificationStore.getState();
      expect(selectUnreadByCategory(state)).toBe(state.unreadByCategory);
    });
  });
});
