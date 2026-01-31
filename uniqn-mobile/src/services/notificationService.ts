/**
 * UNIQN Mobile - Notification Service
 *
 * @description 알림 관리 서비스 (Firestore + Expo Notifications)
 * @version 1.0.0
 *
 * TODO [출시 전]: FCM 네이티브 통합 (EAS Build 설정 후)
 * TODO [출시 전]: 알림 그룹핑 기능 추가
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/errors';
import { withErrorHandling } from '@/utils/withErrorHandling';
import { RealtimeManager } from '@/shared/realtime';
import { COLLECTIONS } from '@/constants';
import { notificationRepository } from '@/repositories';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;

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
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Firestore 문서를 NotificationData로 변환
 * @description 실시간 구독에서만 사용 (Repository는 내부 변환 사용)
 */
function docToNotification(doc: QueryDocumentSnapshot<DocumentData>): NotificationData {
  const data = doc.data();
  return {
    id: doc.id,
    recipientId: data.recipientId,
    type: data.type,
    title: data.title,
    body: data.body,
    link: data.link,
    data: data.data,
    isRead: data.isRead ?? false,
    createdAt: data.createdAt,
    readAt: data.readAt,
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
  return withErrorHandling(async () => {
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
  }, 'fetchNotifications');
}

/**
 * 읽지 않은 알림 수 조회
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return withErrorHandling(async () => {
    return notificationRepository.getUnreadCount(userId);
  }, 'getUnreadCount');
}

/**
 * 알림 상세 조회
 */
export async function getNotification(notificationId: string): Promise<NotificationData | null> {
  return withErrorHandling(async () => {
    return notificationRepository.getById(notificationId);
  }, 'getNotification');
}

// ============================================================================
// Notification Update Operations
// ============================================================================

/**
 * 알림 읽음 처리
 */
export async function markAsRead(notificationId: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.markAsRead(notificationId);
  }, 'markAsRead');
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllAsRead(userId: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.markAllAsRead(userId);
  }, 'markAllAsRead');
}

/**
 * 알림 삭제
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.delete(notificationId);
  }, 'deleteNotification');
}

/**
 * 여러 알림 삭제
 */
export async function deleteNotifications(notificationIds: string[]): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.deleteMany(notificationIds);
  }, 'deleteNotifications');
}

/**
 * 오래된 알림 정리 (30일 이상)
 */
export async function cleanupOldNotifications(userId: string, daysToKeep = 30): Promise<number> {
  return withErrorHandling(async () => {
    return notificationRepository.deleteOlderThan(userId, daysToKeep);
  }, 'cleanupOldNotifications');
}

// ============================================================================
// Real-time Subscription
// ============================================================================

/**
 * 알림 실시간 구독
 *
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 */
export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: NotificationData[]) => void,
  onError?: (error: Error) => void
): () => void {
  return RealtimeManager.subscribe(
    RealtimeManager.Keys.notifications(userId),
    () => {
      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where('recipientId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notifications = snapshot.docs.map(docToNotification);
          onNotifications(notifications);
        },
        (error) => {
          const appError = normalizeError(error);
          logger.error('알림 구독 에러', appError, {
            code: appError.code,
          });
          onError?.(appError);
        }
      );

      logger.info('알림 구독 시작', { userId });
      return unsubscribe;
    }
  );
}

/**
 * 읽지 않은 알림 수 실시간 구독
 *
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  return RealtimeManager.subscribe(
    RealtimeManager.Keys.unreadCount(userId),
    () => {
      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where('recipientId', '==', userId),
        where('isRead', '==', false)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          onCount(snapshot.size);
        },
        (error) => {
          const appError = normalizeError(error);
          logger.error('읽지 않은 알림 수 구독 에러', appError, {
            code: appError.code,
          });
          onError?.(appError);
        }
      );

      logger.info('읽지 않은 알림 수 구독 시작', { userId });
      return unsubscribe;
    }
  );
}

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * 알림 설정 조회
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  return withErrorHandling(async () => {
    return notificationRepository.getSettings(userId);
  }, 'getNotificationSettings');
}

/**
 * 알림 설정 저장
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.saveSettings(userId, settings);
  }, 'saveNotificationSettings');
}

// ============================================================================
// Push Notification Permission (Expo)
// ============================================================================

/**
 * 푸시 알림 권한 확인
 *
 * @description Expo Notifications를 사용한 권한 확인
 * TODO [출시 전]: expo-notifications 설치 후 구현
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

  // TODO: expo-notifications 설치 후 실제 구현
  // import * as Notifications from 'expo-notifications';
  // const { status } = await Notifications.getPermissionsAsync();

  return {
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  };
}

/**
 * 푸시 알림 권한 요청
 *
 * @description Expo Notifications를 사용한 권한 요청
 * TODO [출시 전]: expo-notifications 설치 후 구현
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

  // TODO: expo-notifications 설치 후 실제 구현
  // import * as Notifications from 'expo-notifications';
  // const { status } = await Notifications.requestPermissionsAsync();

  logger.info('푸시 알림 권한 요청');

  return {
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  };
}

// ============================================================================
// FCM Token Management
// ============================================================================

/**
 * FCM 토큰 등록
 *
 * @description Firestore에 FCM 토큰 저장 (arrayUnion 사용으로 중복 방지)
 */
export async function registerFCMToken(userId: string, token: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.registerFCMToken(userId, token);
  }, 'registerFCMToken');
}

/**
 * FCM 토큰 삭제
 *
 * @description Firestore에서 특정 FCM 토큰 제거 (arrayRemove 사용)
 */
export async function unregisterFCMToken(userId: string, token: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.unregisterFCMToken(userId, token);
  }, 'unregisterFCMToken');
}

/**
 * 모든 FCM 토큰 삭제
 *
 * @description 로그아웃 시 해당 사용자의 모든 FCM 토큰 제거
 */
export async function unregisterAllFCMTokens(userId: string): Promise<void> {
  return withErrorHandling(async () => {
    await notificationRepository.unregisterAllFCMTokens(userId);
  }, 'unregisterAllFCMTokens');
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
