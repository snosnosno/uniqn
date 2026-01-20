/**
 * Services Barrel Export
 *
 * @description
 * 모든 서비스 모듈을 통합 export합니다.
 * 이 파일을 통해 깔끔한 import 경로를 제공합니다.
 *
 * @version 2.0.0 - 토너먼트 전용 리팩토링
 * @since 2025-01-19
 * @author T-HOLDEM Development Team
 */

// =============================================================================
// Notification Services
// =============================================================================

/** 푸시 알림 서비스 */
export {
  initializePushNotifications,
  cleanupPushNotifications,
  getCurrentPushToken,
  checkPushPermission,
} from './notifications';
export type { PushNotificationToken } from './notifications';

/** 로컬 알림 서비스 */
export {
  initializeLocalNotifications,
  showNotification,
  scheduleNotification,
  notifyApprovalRequest,
  notifyScheduleReminder,
  notifySalaryPayment,
  notifyAttendanceReminder,
  cancelAllNotifications,
  cancelNotification,
  getPendingNotifications,
  checkLocalNotificationPermission,
} from './localNotifications';
export type { NotificationData } from './localNotifications';

// =============================================================================
// UI Services
// =============================================================================

/** 상태바 서비스 */
export { initializeStatusBar, hideStatusBar, showStatusBar, getStatusBarInfo } from './statusBar';
export type { StatusBarConfig } from './statusBar';

/** 키보드 서비스 */
export { keyboardService, initializeKeyboard, useKeyboard } from './keyboard';
export type { KeyboardEventHandler } from './keyboard';

// =============================================================================
// User & Account Services
// =============================================================================

/** 동의 서비스 */
export {
  createConsent,
  getConsent,
  updateConsent,
  hasRequiredConsents,
  consentExists,
} from './consentService';

/** 계정 삭제 서비스 */
export {
  requestAccountDeletion,
  getDeletionRequest,
  cancelDeletionRequest,
  getExpiredDeletionRequests,
  completeAccountDeletion,
  isPendingDeletion,
} from './accountDeletionService';
