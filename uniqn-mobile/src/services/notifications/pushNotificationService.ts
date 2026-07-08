/**
 * UNIQN Mobile - Push Notification Service
 *
 * @description Expo Notifications + FCM 기반 푸시 알림 서비스 (공개 파사드)
 * @version 1.0.0
 *
 * 주요 기능:
 * - 푸시 알림 권한 요청/확인
 * - FCM 토큰 관리
 * - 포그라운드/백그라운드 알림 처리
 * - 알림 채널 설정 (Android)
 * - 로컬 알림 스케줄링
 *
 * 구현은 ./internal/* 모듈로 분리되어 있으며, 이 파일은 동일 경로에서 동일한
 * 명명 export 를 보존하는 얇은 파사드/배럴입니다. 모든 내부 모듈은
 * ./internal/pushNotificationState 의 단일 가변 상태 홀더를 공유합니다.
 *
 * 주의: 이 파일은 상단 부수효과(top-level side effect)가 없어야 합니다
 * (재export + 객체 리터럴만). notificationPushBridgeService 가
 * `import * as pushNotificationService` 로 순환 임포트하므로 안전 조건입니다.
 */

import { checkPermission, requestPermission } from './internal/pushPermissionService';
import {
  getTokenWithRecovery,
  registerToken,
  unregisterToken,
  getCurrentToken,
} from './internal/pushTokenService';
import {
  initialize,
  setBadge,
  clearBadge,
  getBadge,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  dismissAllNotifications,
  setNotificationReceivedHandler,
  setNotificationResponseHandler,
  cleanup,
} from './internal/pushNotificationHandlers';

// ============================================================================
// Types
// ============================================================================

export type {
  NotificationPermissionStatus,
  PushTokenResult,
  NotificationPayload,
  NotificationReceivedHandler,
  NotificationResponseHandler,
  NotificationChannel,
} from './internal/pushNotificationTypes';

// ============================================================================
// Constants
// ============================================================================

export { DEFAULT_CHANNELS } from './internal/pushNotificationConstants';

// ============================================================================
// Named exports (zero consumer edits)
// ============================================================================

export { checkPermission, requestPermission } from './internal/pushPermissionService';

export {
  getTokenWithRecovery,
  getToken,
  registerToken,
  unregisterToken,
  getCurrentToken,
} from './internal/pushTokenService';

export {
  initialize,
  setBadge,
  clearBadge,
  getBadge,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  dismissAllNotifications,
  setNotificationReceivedHandler,
  setNotificationResponseHandler,
  cleanup,
} from './internal/pushNotificationHandlers';

// ============================================================================
// Service object
// ============================================================================

export const pushNotificationService = {
  // 초기화
  initialize,
  cleanup,

  // 권한
  checkPermission,
  requestPermission,

  // 토큰
  getToken: getTokenWithRecovery,
  registerToken,
  unregisterToken,
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
};
