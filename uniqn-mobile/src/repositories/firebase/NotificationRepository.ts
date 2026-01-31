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
  writeBatch,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
  arrayUnion,
  arrayRemove,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { QueryBuilder, processPaginatedResults, type PaginatedResult } from '@/utils/firestore';
import { COLLECTIONS } from '@/constants';
import { parseNotificationSettingsDocument } from '@/schemas';
import { createDefaultNotificationSettings } from '@/types/notification';
import type { INotificationRepository, GetNotificationsOptions } from '../interfaces/INotificationRepository';
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
        .whereEqual('recipientId', userId)
        .whereIf(filter?.isRead !== undefined, 'isRead', '==', filter?.isRead)
        .orderByDesc('createdAt')
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
        where('recipientId', '==', userId),
        where('isRead', '==', false)
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

  async markAllAsRead(userId: string): Promise<void> {
    try {
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

      const batch = writeBatch(getFirebaseDb());
      const now = serverTimestamp();

      snapshot.docs.forEach((d) => {
        batch.update(d.ref, {
          isRead: true,
          readAt: now,
        });
      });

      await batch.commit();

      logger.info('모든 알림 읽음 처리', { count: snapshot.size });
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

  async delete(notificationId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);
      await deleteDoc(docRef);

      logger.info('알림 삭제', { notificationId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '알림 삭제',
        component: 'NotificationRepository',
        context: { notificationId },
      });
    }
  }

  async deleteMany(notificationIds: string[]): Promise<void> {
    try {
      if (notificationIds.length === 0) return;

      const batch = writeBatch(getFirebaseDb());

      notificationIds.forEach((id) => {
        const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, id);
        batch.delete(docRef);
      });

      await batch.commit();

      logger.info('여러 알림 삭제', { count: notificationIds.length });
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
        where('recipientId', '==', userId),
        where('createdAt', '<', Timestamp.fromDate(cutoffDate)),
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
      const docRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId, 'notificationSettings', 'default');
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
      const docRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId, 'notificationSettings', 'default');
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

  async registerFCMToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        lastTokenUpdate: serverTimestamp(),
      });

      logger.info('FCM 토큰 등록', { userId, tokenPrefix: token.substring(0, 20) });
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
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(token),
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
        fcmTokens: [],
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
}
