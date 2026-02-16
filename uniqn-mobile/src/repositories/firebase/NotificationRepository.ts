/**
 * UNIQN Mobile - Firebase Notification Repository
 *
 * @description Firebase Firestore 기반 Notification Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 알림 CRUD 작업 캡슐화
 * 3. QueryBuilder 패턴 활용
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, normalizeError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { RealtimeManager } from '@/shared/realtime';
import { QueryBuilder, processPaginatedResults, type PaginatedResult } from '@/utils/firestore';
import { COLLECTIONS, FIELDS } from '@/constants';
import { parseNotificationSettingsDocument } from '@/schemas';
import { createDefaultNotificationSettings } from '@/types/notification';
import type {
  INotificationRepository,
  GetNotificationsOptions,
} from '../interfaces/INotificationRepository';
import type { NotificationData, NotificationSettings } from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Firestore 문서를 NotificationData로 변환
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
// Repository Implementation
// ============================================================================

/**
 * Firebase Notification Repository
 */
export class FirebaseNotificationRepository implements INotificationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(notificationId: string): Promise<NotificationData | null> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToNotification(docSnap as QueryDocumentSnapshot<DocumentData>);
    } catch (error) {
      logger.error('알림 조회 실패', toError(error), { notificationId });
      throw handleServiceError(error, {
        operation: '알림 조회',
        component: 'NotificationRepository',
        context: { notificationId },
      });
    }
  }

  async getByUserId(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<PaginatedResult<NotificationData>> {
    try {
      const { filter, pageSize = PAGE_SIZE, lastDoc } = options;

      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);

      // QueryBuilder로 쿼리 구성
      const q = new QueryBuilder(notificationsRef)
        .whereEqual(FIELDS.NOTIFICATION.recipientId, userId)
        .whereIf(filter?.isRead !== undefined, FIELDS.NOTIFICATION.isRead, '==', filter?.isRead)
        .orderByDesc(FIELDS.NOTIFICATION.createdAt)
        .paginate(pageSize, lastDoc)
        .build();

      const snapshot = await getDocs(q);

      const result = processPaginatedResults(snapshot.docs, pageSize, docToNotification);

      logger.info('알림 목록 조회 성공', {
        component: 'NotificationRepository',
        count: result.items.length,
        hasMore: result.hasMore,
      });

      return result;
    } catch (error) {
      logger.error('알림 목록 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '알림 목록 조회',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where(FIELDS.NOTIFICATION.recipientId, '==', userId),
        where(FIELDS.NOTIFICATION.isRead, '==', false)
      );

      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      logger.error('미읽음 알림 수 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '미읽음 알림 수 조회',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  async getUnreadCounterFromCache(userId: string): Promise<number | null> {
    if (!userId || userId.trim() === '') {
      logger.warn('유효하지 않은 userId', {
        component: 'NotificationRepository',
        method: 'getUnreadCounterFromCache',
      });
      return null;
    }

    try {
      const counterRef = doc(
        getFirebaseDb(),
        COLLECTIONS.USERS,
        userId,
        'counters',
        'notifications'
      );
      const counterSnap = await getDoc(counterRef);

      if (!counterSnap.exists()) {
        return null; // 문서 없음
      }

      return counterSnap.data()?.unreadCount ?? 0;
    } catch (error) {
      logger.error('캐시된 미읽음 카운터 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '캐시된 미읽음 카운터 조회',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
      await updateDoc(docRef, {
        isRead: true,
        readAt: serverTimestamp(),
      });

      logger.info('알림 읽음 처리', { notificationId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '알림 읽음 처리',
        component: 'NotificationRepository',
        context: { notificationId },
      });
    }
  }

  async markAllAsRead(userId: string): Promise<{ updatedIds: string[] }> {
    try {
      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where(FIELDS.NOTIFICATION.recipientId, '==', userId),
        where(FIELDS.NOTIFICATION.isRead, '==', false)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        logger.info('읽지 않은 알림 없음');
        return { updatedIds: [] };
      }

      const batch = writeBatch(getFirebaseDb());
      const now = serverTimestamp();
      const notificationIds: string[] = [];

      snapshot.docs.forEach((d) => {
        notificationIds.push(d.id);
        batch.update(d.ref, {
          isRead: true,
          readAt: now,
          // 배치 업데이트 플래그: onNotificationRead 트리거에서 개별 카운터 감소 스킵
          _batchUpdate: true,
        });
      });

      await batch.commit();

      logger.info('모든 알림 읽음 처리', { count: snapshot.size });
      return { updatedIds: notificationIds };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '모든 알림 읽음 처리',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async delete(notificationId: string): Promise<{ wasUnread: boolean; recipientId?: string }> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);

      // 삭제 전 미읽음 상태 확인 (카운터 관리는 Service 레이어에서 처리)
      const docSnap = await getDoc(docRef);
      const wasUnread = docSnap.exists() && docSnap.data()?.isRead === false;
      const recipientId = docSnap.data()?.recipientId as string | undefined;

      await deleteDoc(docRef);

      logger.info('알림 삭제', { notificationId, wasUnread });
      return { wasUnread, recipientId };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '알림 삭제',
        component: 'NotificationRepository',
        context: { notificationId },
      });
    }
  }

  async deleteMany(notificationIds: string[]): Promise<{ deletedUnreadCount: number }> {
    try {
      if (notificationIds.length === 0) return { deletedUnreadCount: 0 };

      // 삭제 전 미읽음 알림 개수 확인 (카운터 관리는 Service 레이어에서 처리)
      let unreadCount = 0;
      const CHUNK_SIZE = 10; // in 쿼리 제한

      for (let i = 0; i < notificationIds.length; i += CHUNK_SIZE) {
        const chunk = notificationIds.slice(i, i + CHUNK_SIZE);
        const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
        const q = query(
          notificationsRef,
          where('__name__', 'in', chunk),
          where(FIELDS.NOTIFICATION.isRead, '==', false)
        );
        const snapshot = await getCountFromServer(q);
        unreadCount += snapshot.data().count;
      }

      // 배치 삭제 실행
      const batch = writeBatch(getFirebaseDb());

      notificationIds.forEach((id) => {
        const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, id);
        batch.delete(docRef);
      });

      await batch.commit();

      logger.info('여러 알림 삭제', { count: notificationIds.length, unreadCount });
      return { deletedUnreadCount: unreadCount };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '여러 알림 삭제',
        component: 'NotificationRepository',
        context: { count: notificationIds.length },
      });
    }
  }

  async deleteOlderThan(userId: string, daysToKeep: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where(FIELDS.NOTIFICATION.recipientId, '==', userId),
        where(FIELDS.NOTIFICATION.createdAt, '<', Timestamp.fromDate(cutoffDate)),
        limit(500) // 한 번에 처리할 최대 개수
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return 0;
      }

      const batch = writeBatch(getFirebaseDb());
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();

      logger.info('오래된 알림 정리', { count: snapshot.size, daysToKeep });
      return snapshot.size;
    } catch (error) {
      logger.error('오래된 알림 정리 실패', toError(error), { userId, daysToKeep });
      return 0;
    }
  }

  // ==========================================================================
  // 설정 (Settings)
  // ==========================================================================

  async getSettings(userId: string): Promise<NotificationSettings> {
    try {
      const docRef = doc(
        getFirebaseDb(),
        COLLECTIONS.USERS,
        userId,
        'notificationSettings',
        'default'
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return createDefaultNotificationSettings();
      }

      const parsed = parseNotificationSettingsDocument(docSnap.data());
      if (!parsed) {
        logger.warn('알림 설정 문서 파싱 실패, 기본값 반환', { userId });
        return createDefaultNotificationSettings();
      }

      return parsed;
    } catch (error) {
      logger.error('알림 설정 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '알림 설정 조회',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  async saveSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      const docRef = doc(
        getFirebaseDb(),
        COLLECTIONS.USERS,
        userId,
        'notificationSettings',
        'default'
      );
      await setDoc(
        docRef,
        {
          ...settings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      logger.info('알림 설정 저장', { userId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '알림 설정 저장',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // FCM 토큰 (Push Notification)
  // ==========================================================================

  async registerFCMToken(
    userId: string,
    token: string,
    metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
  ): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      const tokenKey = token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');

      await updateDoc(userRef, {
        [`fcmTokens.${tokenKey}`]: {
          token,
          type: metadata.type,
          platform: metadata.platform,
          registeredAt: serverTimestamp(),
          lastRefreshedAt: serverTimestamp(),
        },
      });

      logger.info('FCM 토큰 등록', {
        userId,
        tokenPrefix: token.substring(0, 20),
        type: metadata.type,
      });
    } catch (error) {
      throw handleServiceError(error, {
        operation: 'FCM 토큰 등록',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  async unregisterFCMToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      const tokenKey = token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');

      await updateDoc(userRef, {
        [`fcmTokens.${tokenKey}`]: deleteField(),
      });

      logger.info('FCM 토큰 삭제', { userId, tokenPrefix: token.substring(0, 20) });
    } catch (error) {
      throw handleServiceError(error, {
        operation: 'FCM 토큰 삭제',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  async unregisterAllFCMTokens(userId: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      await updateDoc(userRef, {
        fcmTokens: {},
      });

      logger.info('모든 FCM 토큰 삭제', { userId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '모든 FCM 토큰 삭제',
        component: 'NotificationRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // 실시간 구독 (Realtime Subscription)
  // ==========================================================================

  subscribeToNotifications(
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

          firebaseUnsubscribe?.();
          firebaseUnsubscribe = null;

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

  subscribeToUnreadCount(
    userId: string,
    onCount: (count: number) => void,
    onError?: (error: Error) => void
  ): () => void {
    return RealtimeManager.subscribe(RealtimeManager.Keys.unreadCount(userId), () => {
      const counterRef = doc(
        getFirebaseDb(),
        COLLECTIONS.USERS,
        userId,
        'counters',
        'notifications'
      );

      let firebaseUnsubscribe: (() => void) | null = null;
      let hasErrored = false;

      firebaseUnsubscribe = onSnapshot(
        counterRef,
        async (snapshot: DocumentSnapshot) => {
          if (hasErrored) return;

          if (snapshot.exists()) {
            const data = snapshot.data() as { unreadCount?: number } | undefined;
            const count = data?.unreadCount ?? 0;
            onCount(count);
          } else {
            try {
              const count = await this.getUnreadCount(userId);
              onCount(count);
            } catch (error) {
              logger.error('폴백 카운트 조회 실패', normalizeError(error));
              onCount(0);
            }
          }
        },
        (error: Error) => {
          if (hasErrored) return;
          hasErrored = true;

          const appError = normalizeError(error);
          logger.error('읽지 않은 알림 수 구독 에러', appError, {
            code: appError.code,
          });

          firebaseUnsubscribe?.();
          firebaseUnsubscribe = null;

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
}
