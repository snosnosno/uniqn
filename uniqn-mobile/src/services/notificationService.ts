/**
 * UNIQN Mobile - Notification Service
 *
 * @description 알림 관리 서비스 (Firestore + Expo Notifications)
 * @version 1.0.0
 *
 * 현재 상태: expo-notifications 설치 완료
 *
 * TODO [출시 전]: EAS Build 후 실제 디바이스에서 FCM 테스트
 * TODO [P2]: 알림 그룹핑 기능 추가 (Android Notification Channels)
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import * as pushNotificationService from '@/services/pushNotificationService';
import { normalizeError } from '@/errors';
import { withErrorHandling } from '@/utils/withErrorHandling';
import { RealtimeManager } from '@/shared/realtime';
import { COLLECTIONS, FIELDS } from '@/constants';
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
  ios?: {
    allowsAlert: boolean;
    allowsBadge: boolean;
    allowsSound: boolean;
  };
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
  return RealtimeManager.subscribe(RealtimeManager.Keys.notifications(userId), () => {
    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationsRef,
      where(FIELDS.NOTIFICATION.recipientId, '==', userId),
      orderBy(FIELDS.NOTIFICATION.createdAt, 'desc'),
      limit(50)
    );

    // 에러 콜백 중복 실행 방지 (Firebase SDK 내부 재시도로 인한 무한 루프 차단)
    let hasErrored = false;
    let firebaseUnsubscribe: (() => void) | null = null;

    firebaseUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (hasErrored) return;
        const notifications = snapshot.docs.map(docToNotification);
        onNotifications(notifications);
      },
      (error) => {
        if (hasErrored) return;
        hasErrored = true;

        const appError = normalizeError(error);
        logger.error('알림 구독 에러', appError, {
          code: appError.code,
        });

        // 리스너 즉시 해제 (재시도 방지)
        firebaseUnsubscribe?.();
        firebaseUnsubscribe = null;

        // RealtimeManager에서 죽은 구독 엔트리 강제 제거 (재구독 가능하도록)
        RealtimeManager.forceRemove(RealtimeManager.Keys.notifications(userId));

        onError?.(appError);
      }
    );

    logger.info('알림 구독 시작', { userId });

    return () => {
      hasErrored = true;
      firebaseUnsubscribe?.();
      firebaseUnsubscribe = null;
    };
  });
}

/**
 * 읽지 않은 알림 수 실시간 구독 (최적화 버전)
 *
 * @description
 * - Phase 12 - RealtimeManager로 중복 구독 방지
 * - 비용 최적화: 단일 카운터 문서 구독 (모든 미읽음 문서 대신)
 * - 카운터 문서 경로: users/{userId}/counters/notifications
 * - 카운터가 없으면 getCountFromServer() 폴백
 *
 * @changelog v1.1.0 - 전체 미읽음 문서 구독 → 단일 카운터 문서 구독
 */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  return RealtimeManager.subscribe(RealtimeManager.Keys.unreadCount(userId), () => {
    const counterRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId, 'counters', 'notifications');

    // Firebase unsubscribe 참조 (에러 시 자체 정리용)
    let firebaseUnsubscribe: (() => void) | null = null;
    // 에러 콜백 중복 실행 방지 (Firebase SDK 내부 재시도로 인한 무한 루프 차단)
    let hasErrored = false;

    // 카운터 문서 실시간 구독 (단일 문서 - 비용 효율적)
    firebaseUnsubscribe = onSnapshot(
      counterRef,
      async (snapshot: DocumentSnapshot) => {
        if (hasErrored) return;

        if (snapshot.exists()) {
          const data = snapshot.data() as { unreadCount?: number } | undefined;
          const count = data?.unreadCount ?? 0;
          onCount(count);
        } else {
          // 카운터 문서가 없으면 직접 카운트 (드문 경우)
          try {
            const count = await notificationRepository.getUnreadCount(userId);
            onCount(count);
          } catch (error) {
            logger.error('폴백 카운트 조회 실패', normalizeError(error));
            onCount(0);
          }
        }
      },
      (error: Error) => {
        // 이미 에러 처리됨 - Firebase SDK 내부 재시도로 인한 중복 호출 차단
        if (hasErrored) return;
        hasErrored = true;

        const appError = normalizeError(error);
        logger.error('읽지 않은 알림 수 구독 에러', appError, {
          code: appError.code,
        });

        // 리스너 즉시 해제 (재시도 방지)
        firebaseUnsubscribe?.();
        firebaseUnsubscribe = null;

        // RealtimeManager에서 죽은 구독 엔트리 강제 제거 (재구독 가능하도록)
        RealtimeManager.forceRemove(RealtimeManager.Keys.unreadCount(userId));

        onError?.(appError);
      }
    );

    logger.info('읽지 않은 알림 수 구독 시작 (최적화)', { userId });

    return () => {
      hasErrored = true;
      firebaseUnsubscribe?.();
      firebaseUnsubscribe = null;
    };
  });
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
  return withErrorHandling(async () => {
    await notificationRepository.registerFCMToken(userId, token, metadata);
  }, 'registerFCMToken');
}

/**
 * FCM 토큰 삭제
 *
 * @description Firestore에서 특정 FCM 토큰 제거 (Map 키 deleteField)
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
