/**
 * UNIQN Mobile - Push Notification Service
 *
 * @description Expo Notifications + FCM 기반 푸시 알림 서비스
 * @version 1.0.0
 *
 * 주요 기능:
 * - 푸시 알림 권한 요청/확인
 * - FCM 토큰 관리
 * - 포그라운드/백그라운드 알림 처리
 * - 알림 채널 설정 (Android)
 * - 로컬 알림 스케줄링
 */

import { Platform, AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsTypes from 'expo-notifications';
import { logger } from '@/utils/logger';
import { crashlyticsService } from './crashlyticsService';
import { registerFCMToken, unregisterFCMToken } from './notificationService';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

/**
 * 기본 알림 채널 (Android)
 */
export const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: 'schedule',
    name: '스케줄 알림',
    description: '스케줄 변경, 확정, 취소 관련 알림',
    importance: 'high',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'job',
    name: '구인 알림',
    description: '새 공고, 지원 결과 관련 알림',
    importance: 'high',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'worklog',
    name: '근무 알림',
    description: '출퇴근, 정산 관련 알림',
    importance: 'default',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'system',
    name: '시스템 알림',
    description: '공지사항, 업데이트 알림',
    importance: 'default',
    sound: 'default',
    vibrate: false,
    badge: false,
  },
];

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let currentToken: string | null = null;
let notificationReceivedHandler: NotificationReceivedHandler | null = null;
let notificationResponseHandler: NotificationResponseHandler | null = null;
let appStateSubscription: { remove: () => void } | null = null;

// Expo Notifications 모듈 (동적 로드)
let Notifications: typeof import('expo-notifications') | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * 푸시 알림 서비스 초기화
 */
export async function initialize(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    // 웹에서는 지원하지 않음
    if (Platform.OS === 'web') {
      logger.info('푸시 알림은 웹에서 지원되지 않습니다');
      isInitialized = true;
      return true;
    }

    // 실제 디바이스 확인
    if (!Device.isDevice) {
      logger.warn('푸시 알림은 실제 디바이스에서만 작동합니다');
      isInitialized = true;
      return true;
    }

    // expo-notifications 동적 로드
    try {
      Notifications = await import('expo-notifications');
    } catch {
      logger.warn('expo-notifications 모듈 로드 실패 - 설치 필요');
      isInitialized = true;
      return true;
    }

    // Android 알림 채널 설정
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    // 알림 핸들러 설정
    setupNotificationHandlers();

    // 앱 상태 리스너 설정
    setupAppStateListener();

    isInitialized = true;
    logger.info('푸시 알림 서비스 초기화 완료');
    return true;
  } catch (error) {
    logger.error('푸시 알림 서비스 초기화 실패', error as Error);
    crashlyticsService.recordError(error as Error, {
      component: 'pushNotificationService',
      action: 'initialize',
    });
    return false;
  }
}

/**
 * Android 알림 채널 설정
 */
async function setupAndroidChannels(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;

  try {
    for (const channel of DEFAULT_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: mapImportance(channel.importance),
        sound: channel.sound,
        vibrationPattern: channel.vibrate ? [0, 250, 250, 250] : undefined,
        enableVibrate: channel.vibrate,
      });
    }
    logger.info('Android 알림 채널 설정 완료', { channels: DEFAULT_CHANNELS.length });
  } catch (error) {
    logger.error('Android 알림 채널 설정 실패', error as Error);
  }
}

/**
 * importance 문자열을 expo-notifications 값으로 변환
 */
function mapImportance(importance: NotificationChannel['importance']): number {
  // AndroidImportance enum 값
  const importanceMap: Record<string, number> = {
    min: 1,
    low: 2,
    default: 3,
    high: 4,
    max: 5,
  };
  return importanceMap[importance] ?? 3;
}

/**
 * 알림 핸들러 설정
 */
function setupNotificationHandlers(): void {
  if (!Notifications) return;

  // 포그라운드 알림 수신 핸들러
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const payload = extractPayload(notification);

      // 커스텀 핸들러 호출
      if (notificationReceivedHandler) {
        notificationReceivedHandler(payload);
      }

      // 포그라운드에서 알림 표시 여부
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  // 알림 터치 응답 리스너
  Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = extractPayload(response.notification);
    const actionId = response.actionIdentifier;

    logger.info('알림 응답 수신', { actionId, data: payload.data });

    if (notificationResponseHandler) {
      notificationResponseHandler(payload, actionId);
    }
  });

  logger.info('알림 핸들러 설정 완료');
}

/**
 * 앱 상태 리스너 설정
 */
function setupAppStateListener(): void {
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // 앱이 포그라운드로 돌아올 때 뱃지 초기화
      await clearBadge();
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

/**
 * 알림에서 페이로드 추출
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPayload(notification: any): NotificationPayload {
  const content = notification.request?.content || notification.content || {};
  return {
    title: content.title || '',
    body: content.body || '',
    data: content.data || {},
  };
}

// ============================================================================
// Permission Management
// ============================================================================

/**
 * 푸시 알림 권한 확인
 */
export async function checkPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web' || !Notifications) {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  try {
    const { status, canAskAgain, ios } = await Notifications.getPermissionsAsync();

    return {
      granted: status === 'granted',
      canAskAgain: canAskAgain ?? false,
      status: status as NotificationPermissionStatus['status'],
      ios: ios ? {
        allowsAlert: ios.allowsAlert ?? false,
        allowsBadge: ios.allowsBadge ?? false,
        allowsSound: ios.allowsSound ?? false,
      } : undefined,
    };
  } catch (error) {
    logger.error('알림 권한 확인 실패', error as Error);
    return {
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    };
  }
}

/**
 * 푸시 알림 권한 요청
 */
export async function requestPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web' || !Notifications) {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  try {
    logger.info('푸시 알림 권한 요청');

    const { status, canAskAgain, ios } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    const result: NotificationPermissionStatus = {
      granted: status === 'granted',
      canAskAgain: canAskAgain ?? false,
      status: status as NotificationPermissionStatus['status'],
      ios: ios ? {
        allowsAlert: ios.allowsAlert ?? false,
        allowsBadge: ios.allowsBadge ?? false,
        allowsSound: ios.allowsSound ?? false,
      } : undefined,
    };

    logger.info('푸시 알림 권한 요청 결과', { status: result.status, granted: result.granted });
    return result;
  } catch (error) {
    logger.error('알림 권한 요청 실패', error as Error);
    return {
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    };
  }
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * 푸시 토큰 가져오기
 */
export async function getToken(): Promise<PushTokenResult | null> {
  if (Platform.OS === 'web' || !Notifications) {
    return null;
  }

  try {
    // 권한 확인
    const permission = await checkPermission();
    if (!permission.granted) {
      logger.warn('푸시 알림 권한이 없어 토큰을 가져올 수 없습니다');
      return null;
    }

    // Expo Push Token (개발용)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (projectId) {
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      currentToken = expoPushToken;
      logger.info('Expo Push Token 발급', { tokenPrefix: expoPushToken.substring(0, 20) });

      return {
        token: expoPushToken,
        type: 'expo',
      };
    }

    // FCM Token (프로덕션)
    const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();

    currentToken = fcmToken;
    logger.info('FCM Token 발급', { tokenPrefix: fcmToken.substring(0, 20) });

    return {
      token: fcmToken,
      type: 'fcm',
    };
  } catch (error) {
    logger.error('푸시 토큰 발급 실패', error as Error);
    crashlyticsService.recordError(error as Error, {
      component: 'pushNotificationService',
      action: 'getToken',
    });
    return null;
  }
}

/**
 * 사용자에게 토큰 등록
 */
export async function registerToken(userId: string): Promise<boolean> {
  try {
    const tokenResult = await getToken();
    if (!tokenResult) {
      logger.warn('토큰 없음 - 등록 스킵');
      return false;
    }

    await registerFCMToken(userId, tokenResult.token);
    logger.info('푸시 토큰 등록 완료', { userId, type: tokenResult.type });
    return true;
  } catch (error) {
    logger.error('푸시 토큰 등록 실패', error as Error);
    return false;
  }
}

/**
 * 사용자 토큰 해제
 */
export async function unregisterToken(userId: string): Promise<boolean> {
  try {
    if (!currentToken) {
      logger.warn('등록된 토큰 없음 - 해제 스킵');
      return true;
    }

    await unregisterFCMToken(userId, currentToken);
    currentToken = null;
    logger.info('푸시 토큰 해제 완료', { userId });
    return true;
  } catch (error) {
    logger.error('푸시 토큰 해제 실패', error as Error);
    return false;
  }
}

/**
 * 현재 토큰 가져오기
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

// ============================================================================
// Badge Management
// ============================================================================

/**
 * 뱃지 수 설정
 */
export async function setBadge(count: number): Promise<void> {
  if (!Notifications || Platform.OS === 'web') return;

  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    logger.error('뱃지 설정 실패', error as Error);
  }
}

/**
 * 뱃지 초기화
 */
export async function clearBadge(): Promise<void> {
  await setBadge(0);
}

/**
 * 뱃지 수 가져오기
 */
export async function getBadge(): Promise<number> {
  if (!Notifications || Platform.OS === 'web') return 0;

  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    logger.error('뱃지 조회 실패', error as Error);
    return 0;
  }
}

// ============================================================================
// Local Notifications
// ============================================================================

/**
 * 로컬 알림 스케줄링
 */
export async function scheduleLocalNotification(
  payload: NotificationPayload,
  options?: {
    channelId?: string;
    trigger?: { seconds: number } | { date: Date };
  }
): Promise<string | null> {
  if (!Notifications || Platform.OS === 'web') return null;

  try {
    // 트리거 변환
    let trigger: NotificationsTypes.NotificationTriggerInput = null;
    if (options?.trigger) {
      if ('seconds' in options.trigger) {
        trigger = {
          type: Notifications!.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: options.trigger.seconds
        } as NotificationsTypes.TimeIntervalTriggerInput;
      } else if ('date' in options.trigger) {
        trigger = {
          type: Notifications!.SchedulableTriggerInputTypes.DATE,
          date: options.trigger.date
        } as NotificationsTypes.DateTriggerInput;
      }
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
      },
      trigger,
    });

    logger.info('로컬 알림 스케줄링', { identifier, title: payload.title });
    return identifier;
  } catch (error) {
    logger.error('로컬 알림 스케줄링 실패', error as Error);
    return null;
  }
}

/**
 * 스케줄된 알림 취소
 */
export async function cancelScheduledNotification(identifier: string): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    logger.info('스케줄 알림 취소', { identifier });
  } catch (error) {
    logger.error('스케줄 알림 취소 실패', error as Error);
  }
}

/**
 * 모든 스케줄된 알림 취소
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.info('모든 스케줄 알림 취소');
  } catch (error) {
    logger.error('모든 스케줄 알림 취소 실패', error as Error);
  }
}

/**
 * 모든 알림 닫기 (알림 센터에서)
 */
export async function dismissAllNotifications(): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.dismissAllNotificationsAsync();
    logger.info('모든 알림 닫기');
  } catch (error) {
    logger.error('알림 닫기 실패', error as Error);
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 포그라운드 알림 수신 핸들러 설정
 */
export function setNotificationReceivedHandler(
  handler: NotificationReceivedHandler | null
): void {
  notificationReceivedHandler = handler;
}

/**
 * 알림 응답 핸들러 설정 (알림 터치 시)
 */
export function setNotificationResponseHandler(
  handler: NotificationResponseHandler | null
): void {
  notificationResponseHandler = handler;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * 서비스 정리
 */
export function cleanup(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  notificationReceivedHandler = null;
  notificationResponseHandler = null;
  currentToken = null;
  isInitialized = false;

  logger.info('푸시 알림 서비스 정리 완료');
}

// ============================================================================
// Export
// ============================================================================

export const pushNotificationService = {
  // 초기화
  initialize,
  cleanup,

  // 권한
  checkPermission,
  requestPermission,

  // 토큰
  getToken,
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

export default pushNotificationService;
