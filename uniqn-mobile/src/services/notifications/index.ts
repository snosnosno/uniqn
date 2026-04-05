/**
 * UNIQN Mobile - Notifications Domain Barrel
 *
 * @description 알림 관련 서비스 도메인 배럴 (notification, push, sync, inApp)
 * @version 1.0.0
 */

// ============================================================================
// Notification Service
// ============================================================================

export {
  notificationService,
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
  syncUnreadCounterFromServer,
  createNotificationFromFCM,
  getUnreadCounterFromCache,
  type NotificationPageCursor,
} from './notificationService';

// ============================================================================
// Push Notification Service
// ============================================================================

export {
  pushNotificationService,
  // 초기화/정리
  initialize as initializePushNotifications,
  cleanup as cleanupPushNotifications,
  // 권한
  checkPermission as checkPushPermission,
  requestPermission as requestPushPermission,
  // 토큰
  getTokenWithRecovery as getPushToken,
  registerToken as registerPushToken,
  unregisterToken as unregisterPushToken,
  getCurrentToken,
  // 뱃지
  setBadge,
  clearBadge,
  getBadge,
  // 로컬 알림
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  dismissAllNotifications,
  // 핸들러
  setNotificationReceivedHandler,
  setNotificationResponseHandler,
  // 상수
  DEFAULT_CHANNELS,
  // 타입
  type NotificationPermissionStatus as PushPermissionStatus,
  type NotificationPermissionStatus,
  type PushTokenResult,
  type NotificationPayload,
  type NotificationReceivedHandler,
  type NotificationResponseHandler,
  type NotificationChannel,
} from './pushNotificationService';

// ============================================================================
// Notification Sync Service
// ============================================================================

export { syncMissedNotifications, shouldSync, type SyncResult } from './notificationSyncService';
