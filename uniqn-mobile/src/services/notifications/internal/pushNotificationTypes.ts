/**
 * UNIQN Mobile - Push Notification Types
 *
 * @description pushNotificationService 의 공개 타입 정의
 */

/**
 * 알림 권한 상태
 */
export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  ios?: {
    allowsAlert: boolean;
    allowsBadge: boolean;
    allowsSound: boolean;
  };
}

/**
 * 푸시 토큰 결과
 */
export interface PushTokenResult {
  token: string;
  type: 'expo' | 'fcm';
}

/**
 * 알림 데이터
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * 알림 수신 핸들러
 */
export type NotificationReceivedHandler = (notification: NotificationPayload) => void;

/**
 * 알림 응답 핸들러 (사용자가 알림 터치 시)
 */
export type NotificationResponseHandler = (
  notification: NotificationPayload,
  actionIdentifier: string
) => void;

/**
 * Android 알림 채널
 */
export interface NotificationChannel {
  id: string;
  name: string;
  description?: string;
  importance: 'default' | 'high' | 'low' | 'min' | 'max';
  sound?: string;
  vibrate?: boolean;
  badge?: boolean;
}
