/**
 * Services Barrel Export
 *
 * @description
 * 모든 서비스 모듈을 통합 export합니다.
 * 이 파일을 통해 깔끔한 import 경로를 제공합니다.
 *
 * @version 1.0.0
 * @since 2025-11-25
 * @author T-HOLDEM Development Team
 *
 * @example
 * ```typescript
 * // 개별 import
 * import { EventService } from '@/services';
 *
 * // 여러 서비스 import
 * import {
 *   initializePushNotifications,
 *   BulkOperationService
 * } from '@/services';
 * ```
 */

// =============================================================================
// Job Posting Services
// =============================================================================

/** 고정공고 조회수 서비스 */
export { incrementViewCount, viewCountService } from './fixedJobPosting';

// =============================================================================
// Application Services
// =============================================================================

/** 지원자 전환 서비스 */
export {
  ApplicantConversionService,
  applicantConversionService,
} from './applicantConversionService';

/** 지원 이력 서비스 */
export { ApplicationHistoryService } from './ApplicationHistoryService';
export type { ApplicationStateInfo } from './ApplicationHistoryService';

// =============================================================================
// Staff & QR Services
// =============================================================================

/** 스태프 QR 서비스 */
export {
  getOrCreateStaffQR,
  regenerateStaffQR,
  generateDynamicQRPayload,
  validateQRPayload,
} from './StaffQRService';

/** 스태프 QR 출석 서비스 */
export {
  checkStaffConfirmed,
  checkScanCooldown,
  findWorkLog,
  saveScanHistory,
  handleCheckIn,
  handleCheckOut,
} from './StaffQRAttendanceService';

// =============================================================================
// Data Services
// =============================================================================

/** 대량 작업 서비스 */
export { BulkOperationService } from './BulkOperationService';

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
