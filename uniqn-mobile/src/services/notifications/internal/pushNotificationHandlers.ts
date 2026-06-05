/**
 * UNIQN Mobile - Push Notification Handlers
 *
 * @description 초기화, Android 채널, 포그라운드/응답 핸들러, 뱃지, 로컬 알림, 정리
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type * as NotificationsTypes from 'expo-notifications';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { crashlyticsService } from '@/services/observability';
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationReceivedHandler,
  NotificationResponseHandler,
} from './pushNotificationTypes';
import { DEFAULT_CHANNELS } from './pushNotificationConstants';
import { getNotifications, loadNotificationsModule, pushState } from './pushNotificationState';

// ============================================================================
// Initialization
// ============================================================================

/**
 * 푸시 알림 서비스 초기화
 */
export async function initialize(): Promise<boolean> {
  if (pushState.isInitialized) return true;

  try {
    // 웹에서는 지원하지 않음
    if (Platform.OS === 'web') {
      logger.info('푸시 알림은 웹에서 지원되지 않습니다');
      pushState.isInitialized = true;
      return true;
    }

    // 실제 디바이스 확인
    if (!Device.isDevice) {
      logger.warn('푸시 알림은 실제 디바이스에서만 작동합니다');
      pushState.isInitialized = true;
      return true;
    }

    const notifications = await loadNotificationsModule();
    if (!notifications) {
      logger.warn('expo-notifications 모듈 로드 실패 - 설치 필요');
      pushState.isInitialized = true;
      return true;
    }

    // Android 알림 채널 설정
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    // 알림 핸들러 설정
    setupNotificationHandlers();

    pushState.isInitialized = true;
    logger.info('푸시 알림 서비스 초기화 완료');
    return true;
  } catch (error) {
    logger.error('푸시 알림 서비스 초기화 실패', toError(error));
    crashlyticsService.recordError(toError(error), {
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
  const Notifications = getNotifications();
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
    logger.error('Android 알림 채널 설정 실패', toError(error));
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
  const Notifications = getNotifications();
  if (!Notifications) return;

  // 포그라운드 알림 수신 핸들러
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const payload = extractPayload(notification);

      // 커스텀 핸들러 호출
      if (pushState.receivedHandler) {
        pushState.receivedHandler(payload);
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

  // 알림 터치 응답 리스너 (subscription 저장하여 cleanup 시 해제)
  pushState.responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const payload = extractPayload(response.notification);
      const actionId = response.actionIdentifier;

      logger.info('알림 응답 수신', { actionId, data: payload.data });

      if (pushState.responseHandler) {
        pushState.responseHandler(payload, actionId);
      }
    }
  );

  logger.info('알림 핸들러 설정 완료');
}

/**
 * 알림에서 페이로드 추출
 */
function extractPayload(notification: NotificationsTypes.Notification): NotificationPayload {
  const content = notification.request?.content;
  return {
    title: content?.title || '',
    body: content?.body || '',
    data: (content?.data as Record<string, unknown>) || {},
  };
}

// ============================================================================
// Badge Management
// ============================================================================

/**
 * 뱃지 수 설정
 */
export async function setBadge(count: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') return;

  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    logger.error('뱃지 설정 실패', toError(error));
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
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') return 0;

  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    logger.error('뱃지 조회 실패', toError(error));
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
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') return null;

  try {
    // 트리거 변환
    let trigger: NotificationsTypes.NotificationTriggerInput = null;
    if (options?.trigger) {
      if ('seconds' in options.trigger) {
        trigger = {
          type: Notifications!.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: options.trigger.seconds,
        } as NotificationsTypes.TimeIntervalTriggerInput;
      } else if ('date' in options.trigger) {
        trigger = {
          type: Notifications!.SchedulableTriggerInputTypes.DATE,
          date: options.trigger.date,
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
    logger.error('로컬 알림 스케줄링 실패', toError(error));
    return null;
  }
}

/**
 * 스케줄된 알림 취소
 */
export async function cancelScheduledNotification(identifier: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    logger.info('스케줄 알림 취소', { identifier });
  } catch (error) {
    logger.error('스케줄 알림 취소 실패', toError(error));
  }
}

/**
 * 모든 스케줄된 알림 취소
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.info('모든 스케줄 알림 취소');
  } catch (error) {
    logger.error('모든 스케줄 알림 취소 실패', toError(error));
  }
}

/**
 * 모든 알림 닫기 (알림 센터에서)
 */
export async function dismissAllNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.dismissAllNotificationsAsync();
    logger.info('모든 알림 닫기');
  } catch (error) {
    logger.error('알림 닫기 실패', toError(error));
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 포그라운드 알림 수신 핸들러 설정
 */
export function setNotificationReceivedHandler(handler: NotificationReceivedHandler | null): void {
  pushState.receivedHandler = handler;
}

/**
 * 알림 응답 핸들러 설정 (알림 터치 시)
 */
export function setNotificationResponseHandler(handler: NotificationResponseHandler | null): void {
  pushState.responseHandler = handler;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * 서비스 정리
 */
export function cleanup(): void {
  if (pushState.responseSubscription) {
    pushState.responseSubscription.remove();
    pushState.responseSubscription = null;
  }

  pushState.receivedHandler = null;
  pushState.responseHandler = null;
  pushState.currentToken = null;
  pushState.isInitialized = false;

  logger.info('푸시 알림 서비스 정리 완료');
}
