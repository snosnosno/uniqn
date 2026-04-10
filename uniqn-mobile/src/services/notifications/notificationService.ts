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
  syncUnreadCounterFromServer,
  getUnreadCounterFromCache,
} from './internal/notificationReadStateService';
import {
  getNotificationSettings,
  saveNotificationSettings,
} from './internal/notificationSettingsService';
import {
  createNotificationFromFCM,
  checkNotificationPermission,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
} from './internal/notificationPushBridgeService';

/**
 * UNIQN Mobile - Notification Service
 *
 * Public entrypoint for notification reads, settings, and push bridges.
 */

export type { NotificationPageCursor } from './internal/notificationServiceTypes';

export {
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
  syncUnreadCounterFromServer,
  getUnreadCounterFromCache,
} from './internal/notificationReadStateService';

export {
  getNotificationSettings,
  saveNotificationSettings,
} from './internal/notificationSettingsService';

export {
  createNotificationFromFCM,
  checkNotificationPermission,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
} from './internal/notificationPushBridgeService';

export const notificationService = {
  fetchNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  cleanupOldNotifications,
  syncUnreadCounterFromServer,
  getUnreadCounterFromCache,
  createNotificationFromFCM,
  subscribeToNotifications,
  subscribeToUnreadCount,
  getNotificationSettings,
  saveNotificationSettings,
  checkNotificationPermission,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
};

export default notificationService;
