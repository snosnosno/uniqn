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
const BATCH_LIMIT = 500; // Firestore writeBatch 최대 작업 수

// ============================================================================
// Helpers
// ============================================================================

/**
 * FCM 토큰에서 Firestore Map 키 생성 (듀얼 해시 기반)
 *
 * @description substring(0,32) 방식 대신 FNV-1a 변형 듀얼 해시로 키 생성.
 * 두 개의 독립적 32비트 해시를 조합하여 충돌 확률을 ~1/9조로 낮춤.
 */
function createTokenKey(token: string): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995) >>> 0;
  }
  return `tk_${h1.toString(36)}_${h2.toString(36)}`;
}

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
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToNotification(docSnap as QueryDocumentSnapshot<DocumentData>);
  }

  async getByUserId(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<PaginatedResult<NotificationData>> {
    const { filter, pageSize = PAGE_SIZE, lastDoc } = options;

    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);

    // QueryBuilder로 쿼리 구성
    const q = new QueryBuilder(notificationsRef)
      .whereEqual(FIELDS.NOTIFICATION.recipientId, userId)
      .whereIf(filter?.isRead !== undefined, FIELDS.NOTIFICATION.isRead, '==', filter?.isRead)
      .whereIn(FIELDS.NOTIFICATION.type, filter?.types)
      .whereGreaterOrEqual(
        FIELDS.NOTIFICATION.createdAt,
        filter?.startDate ? Timestamp.fromDate(filter.startDate) : undefined
      )
      .whereLessOrEqual(
        FIELDS.NOTIFICATION.createdAt,
        filter?.endDate ? Timestamp.fromDate(filter.endDate) : undefined
      )
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
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationsRef,
      where(FIELDS.NOTIFICATION.recipientId, '==', userId),
      where(FIELDS.NOTIFICATION.isRead, '==', false)
    );

    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }

  async getUnreadCounterFromCache(userId: string): Promise<number | null> {
    if (!userId || userId.trim() === '') {
      logger.warn('유효하지 않은 userId', {
        component: 'NotificationRepository',
        method: 'getUnreadCounterFromCache',
      });
      return null;
    }

    const counterRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId, 'counters', 'notifications');
    const counterSnap = await getDoc(counterRef);

    if (!counterSnap.exists()) {
      return null; // 문서 없음
    }

    return counterSnap.data()?.unreadCount ?? 0;
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async markAsRead(notificationId: string): Promise<void> {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(docRef, {
      isRead: true,
      readAt: serverTimestamp(),
    });

    logger.info('알림 읽음 처리', { notificationId });
  }

  async markAllAsRead(userId: string): Promise<{ updatedIds: string[] }> {
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

    const now = serverTimestamp();
    const notificationIds: string[] = snapshot.docs.map((d) => d.id);

    // W-NEW-3: Firestore 배치 500개 제한 대응 - 청크 단위로 커밋
    for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
      const batchChunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(getFirebaseDb());

      batchChunk.forEach((d) => {
        batch.update(d.ref, {
          isRead: true,
          readAt: now,
          // 배치 업데이트 플래그: onNotificationRead 트리거에서 개별 카운터 감소 스킵
          _batchUpdate: true,
        });
      });

      await batch.commit();
    }

    // _batchUpdate 플래그 정리 (실패해도 읽음 처리 결과에 영향 없음)
    Promise.resolve()
      .then(async () => {
        for (let i = 0; i < notificationIds.length; i += BATCH_LIMIT) {
          const cleanupChunk = notificationIds.slice(i, i + BATCH_LIMIT);
          const cleanupBatch = writeBatch(getFirebaseDb());

          cleanupChunk.forEach((id) => {
            const ref = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, id);
            cleanupBatch.update(ref, { _batchUpdate: deleteField() });
          });

          await cleanupBatch.commit();
        }
      })
      .catch((error) => {
        logger.warn('_batchUpdate 플래그 정리 실패', { error: String(error) });
      });

    logger.info('모든 알림 읽음 처리', { count: snapshot.size });
    return { updatedIds: notificationIds };
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async delete(notificationId: string): Promise<{ wasUnread: boolean; recipientId?: string }> {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);

    // 삭제 전 미읽음 상태 확인 (카운터 관리는 Service 레이어에서 처리)
    const docSnap = await getDoc(docRef);

    // W2: 문서가 없으면 불필요한 deleteDoc 호출 방지
    if (!docSnap.exists()) {
      logger.warn('삭제할 알림이 존재하지 않음', { notificationId });
      return { wasUnread: false };
    }

    const wasUnread = docSnap.data()?.isRead === false;
    const recipientId = docSnap.data()?.recipientId as string | undefined;

    await deleteDoc(docRef);

    logger.info('알림 삭제', { notificationId, wasUnread });
    return { wasUnread, recipientId };
  }

  async deleteMany(notificationIds: string[]): Promise<{ deletedUnreadCount: number }> {
    if (notificationIds.length === 0) return { deletedUnreadCount: 0 };

    // 삭제 전 미읽음 알림 개수 확인 (카운터 관리는 Service 레이어에서 처리)
    let unreadCount = 0;
    const IN_QUERY_LIMIT = 10; // Firestore in 쿼리 제한

    for (let i = 0; i < notificationIds.length; i += IN_QUERY_LIMIT) {
      const chunk = notificationIds.slice(i, i + IN_QUERY_LIMIT);
      const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
      const q = query(
        notificationsRef,
        where('__name__', 'in', chunk),
        where(FIELDS.NOTIFICATION.isRead, '==', false)
      );
      const snapshot = await getCountFromServer(q);
      unreadCount += snapshot.data().count;
    }

    // W3: Firestore 배치 500개 제한 대응 - 청크 단위로 커밋
    for (let i = 0; i < notificationIds.length; i += BATCH_LIMIT) {
      const batchChunk = notificationIds.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(getFirebaseDb());

      batchChunk.forEach((id) => {
        const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, id);
        batch.delete(docRef);
      });

      await batch.commit();
    }

    logger.info('여러 알림 삭제', { count: notificationIds.length, unreadCount });
    return { deletedUnreadCount: unreadCount };
  }

  async deleteOlderThan(userId: string, daysToKeep: number): Promise<number> {
    const MAX_ITERATIONS = 10; // 안전장치: 최대 5000건
    let totalDeleted = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
        const q = query(
          notificationsRef,
          where(FIELDS.NOTIFICATION.recipientId, '==', userId),
          where(FIELDS.NOTIFICATION.createdAt, '<', Timestamp.fromDate(cutoffDate)),
          limit(BATCH_LIMIT)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          break;
        }

        const batch = writeBatch(getFirebaseDb());
        snapshot.docs.forEach((d) => {
          batch.delete(d.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;

        // 500개 미만이면 더 이상 없음
        if (snapshot.size < BATCH_LIMIT) {
          break;
        }
      }

      if (totalDeleted > 0) {
        logger.info('오래된 알림 정리', { count: totalDeleted, daysToKeep });
      }
      return totalDeleted;
    } catch (error) {
      logger.error('오래된 알림 정리 실패', toError(error), { userId, daysToKeep, totalDeleted });
      return totalDeleted;
    }
  }

  // ==========================================================================
  // 설정 (Settings)
  // ==========================================================================

  async getSettings(userId: string): Promise<NotificationSettings> {
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
  }

  async saveSettings(userId: string, settings: NotificationSettings): Promise<void> {
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
  }

  // ==========================================================================
  // FCM 토큰 (Push Notification)
  // ==========================================================================

  async registerFCMToken(
    userId: string,
    token: string,
    metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
  ): Promise<void> {
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    const tokenKey = createTokenKey(token);
    // 레거시 키 (substring 방식) — 존재하면 삭제하여 중복 방지
    const legacyTokenKey = token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');

    await updateDoc(userRef, {
      [`fcmTokens.${tokenKey}`]: {
        token,
        type: metadata.type,
        platform: metadata.platform,
        registeredAt: serverTimestamp(),
        lastRefreshedAt: serverTimestamp(),
      },
      // 레거시 키 정리 (이미 없으면 no-op)
      ...(tokenKey !== legacyTokenKey ? { [`fcmTokens.${legacyTokenKey}`]: deleteField() } : {}),
    });

    logger.info('FCM 토큰 등록', {
      userId,
      tokenPrefix: token.substring(0, 20),
      type: metadata.type,
    });
  }

  async unregisterFCMToken(userId: string, token: string): Promise<void> {
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    const tokenKey = createTokenKey(token);
    const legacyTokenKey = token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');

    await updateDoc(userRef, {
      [`fcmTokens.${tokenKey}`]: deleteField(),
      // 레거시 키도 함께 삭제 (이미 없으면 no-op)
      ...(tokenKey !== legacyTokenKey ? { [`fcmTokens.${legacyTokenKey}`]: deleteField() } : {}),
    });

    logger.info('FCM 토큰 삭제', { userId, tokenPrefix: token.substring(0, 20) });
  }

  async unregisterAllFCMTokens(userId: string): Promise<void> {
    const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      fcmTokens: {},
    });

    logger.info('모든 FCM 토큰 삭제', { userId });
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
