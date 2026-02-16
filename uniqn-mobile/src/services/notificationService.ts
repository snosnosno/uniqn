/**
 * UNIQN Mobile - Notification Service
 *
 * @description 알림 관리 서비스 (Firestore + Expo Notifications)
 * @version 1.1.0 - handleServiceError 패턴 적용
 *
 * 현재 상태: expo-notifications 설치 완료
 *
 * TODO [출시 전]: EAS Build 후 실제 디바이스에서 FCM 테스트
 * TODO [P2]: 알림 그룹핑 기능 추가 (Android Notification Channels)
 */

import { Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { getFirebaseFunctions } from '@/lib/firebase';
import * as pushNotificationService from '@/services/pushNotificationService';
import { type NotificationPayload } from '@/services/pushNotificationService';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { toError } from '@/errors';
import { notificationRepository } from '@/repositories';
import { useNotificationStore } from '@/stores/notificationStore';
import { isSyncCacheValid, updateSyncCache } from '@/shared/cache/counterSyncCache';
import { logger } from '@/utils/logger';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
  NotificationType,
} from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;
const COMPONENT = 'notificationService';

// ============================================================================
// Types
// ============================================================================

interface FetchNotificationsOptions {
  userId: string;
  filter?: NotificationFilter;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface FetchNotificationsResult {
  notifications: NotificationData[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  ios?: {
    allowsAlert: boolean;
    allowsBadge: boolean;
    allowsSound: boolean;
  };
}

// ============================================================================
// Counter Management (Repository에서 이동)
// ============================================================================

/**
 * 미읽음 카운터 리셋 (재시도 + Store 폴백)
 *
 * @description markAllAsRead 후 Cloud Function으로 카운터 리셋
 * 최대 3회 재시도 (exponential backoff), 최종 실패 시 로컬 Store 폴백
 */
async function resetUnreadCounterWithRetry(
  notificationIds: string[],
  userId: string
): Promise<void> {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let resetSuccess = false;

  while (retryCount < MAX_RETRIES && !resetSuccess) {
    try {
      const functions = getFirebaseFunctions();
      const resetCounter = httpsCallable<{ notificationIds: string[] }, { success: boolean }>(
        functions,
        'resetUnreadCounter'
      );
      await resetCounter({ notificationIds });
      resetSuccess = true;
      logger.info('미읽음 카운터 리셋 완료', { userId });
    } catch (counterError) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        logger.warn('카운터 리셋 재시도', {
          attempt: retryCount,
          error: toError(counterError).message,
        });
      }
    }
  }

  if (!resetSuccess) {
    logger.error('카운터 리셋 최종 실패 - 로컬 카운터 동기화', {
      userId,
      attempts: MAX_RETRIES,
    });
    useNotificationStore.getState().setUnreadCount(0);
  }
}

/**
 * 미읽음 카운터 감소 (CF 호출 + Store 폴백)
 *
 * @description delete/deleteMany 후 Cloud Function으로 카운터 감소
 * 실패 시 로컬 Store에서 직접 감소
 */
async function decrementUnreadCounterWithRetry(delta: number): Promise<void> {
  try {
    const functions = getFirebaseFunctions();
    const decrementCounter = httpsCallable<{ delta: number }, { success: boolean }>(
      functions,
      'decrementUnreadCounter'
    );
    await decrementCounter({ delta });
    logger.info('미읽음 카운터 감소 완료', { delta });
  } catch (counterError) {
    logger.warn('미읽음 카운터 감소 실패 - 로컬 폴백', {
      delta,
      error: toError(counterError).message,
    });
    useNotificationStore.getState().decrementUnreadCount(delta);
  }
}

// ============================================================================
// Counter Sync (useNotificationHandler에서 이동)
// ============================================================================

/**
 * 서버에서 미읽음 카운터 동기화
 *
 * @description 포그라운드 복귀 시 또는 멀티 디바이스 동기화를 위해 서버 카운터 조회
 * @param userId 사용자 ID
 * @param forceSync 캐시 무시하고 강제 동기화 (기본값: false)
 *
 * @note 알림 목록 화면 진입 시에도 호출 가능하도록 export
 * @note 30초 캐시 TTL 적용으로 불필요한 Firestore 읽기 방지
 */
export async function syncUnreadCounterFromServer(
  userId: string,
  forceSync: boolean = false
): Promise<void> {
  try {
    if (!forceSync && isSyncCacheValid(userId)) {
      logger.debug('카운터 동기화 스킵 - 캐시 TTL 내', { userId });
      return;
    }

    const serverCount = await notificationRepository.getUnreadCounterFromCache(userId);
    updateSyncCache(userId);

    if (serverCount !== null) {
      const localCount = useNotificationStore.getState().unreadCount;

      if (serverCount !== localCount) {
        useNotificationStore.getState().setUnreadCount(serverCount);
        logger.info('포그라운드 복귀 - 카운터 동기화', {
          serverCount,
          localCount,
          diff: serverCount - localCount,
        });
      }
    }
  } catch (error) {
    logger.warn('카운터 동기화 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// FCM Payload Conversion (useNotificationHandler에서 이동)
// ============================================================================

/**
 * FCM 페이로드로부터 NotificationData 생성
 *
 * @description Hook 레이어에서 Firebase SDK (Timestamp) 직접 참조를 방지하기 위해
 * Service 레이어에서 변환을 담당
 */
export function createNotificationFromFCM(
  payload: NotificationPayload,
  userId: string
): NotificationData | null {
  const notificationId = payload.data?.notificationId as string | undefined;
  if (!notificationId) return null;

  return {
    id: notificationId,
    recipientId: userId,
    type: ((payload.data?.type as string) || 'announcement') as NotificationType,
    title: payload.title || '',
    body: payload.body || '',
    link: payload.data?.link as string | undefined,
    data: payload.data as Record<string, string> | undefined,
    isRead: false,
    createdAt: Timestamp.now(),
  };
}

// ============================================================================
// Notification Fetch Operations
// ============================================================================

/**
 * 알림 목록 조회 (페이지네이션)
 */
export async function fetchNotifications(
  options: FetchNotificationsOptions
): Promise<FetchNotificationsResult> {
  try {
    const { userId, filter, pageSize = PAGE_SIZE, lastDoc } = options;

    const result = await notificationRepository.getByUserId(userId, {
      filter,
      pageSize,
      lastDoc,
    });

    return {
      notifications: result.items,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 목록 조회',
      component: COMPONENT,
      context: { userId: options.userId },
    });
  }
}

/**
 * 읽지 않은 알림 수 조회
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await notificationRepository.getUnreadCount(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '읽지 않은 알림 수 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 상세 조회
 */
export async function getNotification(notificationId: string): Promise<NotificationData | null> {
  try {
    return await notificationRepository.getById(notificationId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 상세 조회',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

// ============================================================================
// Notification Update Operations
// ============================================================================

/**
 * 알림 읽음 처리
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await notificationRepository.markAsRead(notificationId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 읽음 처리',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

/**
 * 모든 알림 읽음 처리 + 카운터 리셋
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const { updatedIds } = await notificationRepository.markAllAsRead(userId);
    if (updatedIds.length > 0) {
      await resetUnreadCounterWithRetry(updatedIds, userId);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 알림 읽음 처리',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 삭제 + 카운터 감소
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const { wasUnread } = await notificationRepository.delete(notificationId);
    if (wasUnread) {
      await decrementUnreadCounterWithRetry(1);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 삭제',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

/**
 * 여러 알림 삭제 + 카운터 감소
 */
export async function deleteNotifications(notificationIds: string[]): Promise<void> {
  try {
    const { deletedUnreadCount } = await notificationRepository.deleteMany(notificationIds);
    if (deletedUnreadCount > 0) {
      await decrementUnreadCounterWithRetry(deletedUnreadCount);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '여러 알림 삭제',
      component: COMPONENT,
      context: { count: notificationIds.length },
    });
  }
}

/**
 * 오래된 알림 정리 (30일 이상)
 */
export async function cleanupOldNotifications(userId: string, daysToKeep = 30): Promise<number> {
  try {
    return await notificationRepository.deleteOlderThan(userId, daysToKeep);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '오래된 알림 정리',
      component: COMPONENT,
      context: { userId, daysToKeep },
    });
  }
}

// ============================================================================
// Real-time Subscription
// ============================================================================

/**
 * 알림 실시간 구독
 *
 * @description Repository를 통한 실시간 구독 (RealtimeManager 중복 구독 방지)
 */
export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: NotificationData[]) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToNotifications(userId, onNotifications, onError);
}

/**
 * 읽지 않은 알림 수 실시간 구독 (최적화 버전)
 *
 * @description Repository를 통한 카운터 문서 실시간 구독
 */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToUnreadCount(userId, onCount, onError);
}

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * 알림 설정 조회
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    return await notificationRepository.getSettings(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 설정 저장
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  try {
    await notificationRepository.saveSettings(userId, settings);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 저장',
      component: COMPONENT,
      context: { userId },
    });
  }
}

// ============================================================================
// Push Notification Permission (Expo)
// ============================================================================

/**
 * 푸시 알림 권한 확인
 *
 * @description Expo Notifications를 사용한 권한 확인
 * 현재 상태: expo-notifications 설치 완료, pushNotificationService에서 구현됨
 * @see pushNotificationService.getPermissionStatus
 */
export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  // 웹에서는 기본적으로 거부 처리
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.checkPermission();
}

/**
 * 푸시 알림 권한 요청
 *
 * @description Expo Notifications를 사용한 권한 요청
 * 현재 상태: expo-notifications 설치 완료, pushNotificationService에서 구현됨
 * @see pushNotificationService.requestPermissions
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  // 웹에서는 기본적으로 거부 처리
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.requestPermission();
}

// ============================================================================
// FCM Token Management
// ============================================================================

/**
 * FCM 토큰 등록
 *
 * @description Firestore에 FCM 토큰 저장 (Map 구조, 토큰키 기반 upsert)
 */
export async function registerFCMToken(
  userId: string,
  token: string,
  metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
): Promise<void> {
  try {
    await notificationRepository.registerFCMToken(userId, token, metadata);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 등록',
      component: COMPONENT,
      context: { userId, platform: metadata.platform },
    });
  }
}

/**
 * FCM 토큰 삭제
 *
 * @description Firestore에서 특정 FCM 토큰 제거 (Map 키 deleteField)
 */
export async function unregisterFCMToken(userId: string, token: string): Promise<void> {
  try {
    await notificationRepository.unregisterFCMToken(userId, token);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 모든 FCM 토큰 삭제
 *
 * @description 로그아웃 시 해당 사용자의 모든 FCM 토큰 제거
 */
export async function unregisterAllFCMTokens(userId: string): Promise<void> {
  try {
    await notificationRepository.unregisterAllFCMTokens(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const notificationService = {
  // Fetch
  fetchNotifications,
  getUnreadCount,
  getNotification,

  // Update
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  cleanupOldNotifications,

  // Counter Sync
  syncUnreadCounterFromServer,

  // FCM Conversion
  createNotificationFromFCM,

  // Subscription
  subscribeToNotifications,
  subscribeToUnreadCount,

  // Settings
  getNotificationSettings,
  saveNotificationSettings,

  // Permission
  checkNotificationPermission,
  requestNotificationPermission,

  // FCM
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
};

export default notificationService;
