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
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  QueryDocumentSnapshot,
  getCountFromServer,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/errorUtils';
import { withErrorHandling } from '@/utils/withErrorHandling';
import { COLLECTIONS } from '@/constants';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';
import { createDefaultNotificationSettings } from '@/types/notification';

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
 */
function docToNotification(doc: QueryDocumentSnapshot): NotificationData {
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

    // 기본 쿼리 조건
    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    let q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1) // 다음 페이지 존재 여부 확인용
    );

    // 읽음 여부 필터
    if (filter?.isRead !== undefined) {
      q = query(
        notificationsRef,
        where('recipientId', '==', userId),
        where('isRead', '==', filter.isRead),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      );
    }

    // 페이지네이션
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;

    // 다음 페이지 존재 여부
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

    const notifications = resultDocs.map(docToNotification);
    const newLastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

    logger.info('알림 목록 조회 성공', {
      count: notifications.length,
      hasMore,
    });

    return {
      notifications,
      lastDoc: newLastDoc,
      hasMore,
    };
  }, 'fetchNotifications');
}

/**
 * 읽지 않은 알림 수 조회
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return withErrorHandling(async () => {
    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('isRead', '==', false)
    );

    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }, 'getUnreadCount');
}

/**
 * 알림 상세 조회
 */
export async function getNotification(notificationId: string): Promise<NotificationData | null> {
  return withErrorHandling(async () => {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToNotification(docSnap as QueryDocumentSnapshot);
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
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(docRef, {
      isRead: true,
      readAt: serverTimestamp(),
    });

    logger.info('알림 읽음 처리', { notificationId });
  }, 'markAsRead');
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllAsRead(userId: string): Promise<void> {
  return withErrorHandling(async () => {
    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      logger.info('읽지 않은 알림 없음');
      return;
    }

    // 배치 처리
    const batch = writeBatch(getFirebaseDb());
    const now = serverTimestamp();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: now,
      });
    });

    await batch.commit();

    logger.info('모든 알림 읽음 처리', { count: snapshot.size });
  }, 'markAllAsRead');
}

/**
 * 알림 삭제
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  return withErrorHandling(async () => {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
    await deleteDoc(docRef);

    logger.info('알림 삭제', { notificationId });
  }, 'deleteNotification');
}

/**
 * 여러 알림 삭제
 */
export async function deleteNotifications(notificationIds: string[]): Promise<void> {
  return withErrorHandling(async () => {
    if (notificationIds.length === 0) return;

    const batch = writeBatch(getFirebaseDb());

    notificationIds.forEach((id) => {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, id);
      batch.delete(docRef);
    });

    await batch.commit();

    logger.info('여러 알림 삭제', { count: notificationIds.length });
  }, 'deleteNotifications');
}

/**
 * 오래된 알림 정리 (30일 이상)
 */
export async function cleanupOldNotifications(userId: string, daysToKeep = 30): Promise<number> {
  return withErrorHandling(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('createdAt', '<', Timestamp.fromDate(cutoffDate)),
      limit(500) // 한 번에 처리할 최대 개수
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    const batch = writeBatch(getFirebaseDb());
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info('오래된 알림 정리', { count: snapshot.size, daysToKeep });
    return snapshot.size;
  }, 'cleanupOldNotifications');
}

// ============================================================================
// Real-time Subscription
// ============================================================================

/**
 * 알림 실시간 구독
 */
export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: NotificationData[]) => void,
  onError?: (error: Error) => void
): () => void {
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
      const normalizedError = normalizeError(error);
      logger.error('알림 구독 에러', normalizedError.originalError as Error, {
        code: normalizedError.code,
      });
      onError?.(new Error(normalizedError.message));
    }
  );

  logger.info('알림 구독 시작', { userId });
  return unsubscribe;
}

/**
 * 읽지 않은 알림 수 실시간 구독
 */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
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
      const normalizedError = normalizeError(error);
      logger.error('읽지 않은 알림 수 구독 에러', normalizedError.originalError as Error, {
        code: normalizedError.code,
      });
      onError?.(new Error(normalizedError.message));
    }
  );

  logger.info('읽지 않은 알림 수 구독 시작', { userId });
  return unsubscribe;
}

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * 알림 설정 조회
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  return withErrorHandling(async () => {
    const docRef = doc(getFirebaseDb(), 'userSettings', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || !docSnap.data()?.notifications) {
      return createDefaultNotificationSettings();
    }

    return docSnap.data().notifications as NotificationSettings;
  }, 'getNotificationSettings');
}

/**
 * 알림 설정 저장
 */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  return withErrorHandling(async () => {
    const docRef = doc(getFirebaseDb(), 'userSettings', userId);
    await updateDoc(docRef, {
      notifications: {
        ...settings,
        updatedAt: serverTimestamp(),
      },
    });

    logger.info('알림 설정 저장', { userId });
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
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      lastTokenUpdate: serverTimestamp(),
    });

    logger.info('FCM 토큰 등록', { userId, tokenPrefix: token.substring(0, 20) });
  }, 'registerFCMToken');
}

/**
 * FCM 토큰 삭제
 *
 * @description Firestore에서 특정 FCM 토큰 제거 (arrayRemove 사용)
 */
export async function unregisterFCMToken(userId: string, token: string): Promise<void> {
  return withErrorHandling(async () => {
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
    });

    logger.info('FCM 토큰 삭제', { userId, tokenPrefix: token.substring(0, 20) });
  }, 'unregisterFCMToken');
}

/**
 * 모든 FCM 토큰 삭제
 *
 * @description 로그아웃 시 해당 사용자의 모든 FCM 토큰 제거
 */
export async function unregisterAllFCMTokens(userId: string): Promise<void> {
  return withErrorHandling(async () => {
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      fcmTokens: [],
    });

    logger.info('모든 FCM 토큰 삭제', { userId });
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
