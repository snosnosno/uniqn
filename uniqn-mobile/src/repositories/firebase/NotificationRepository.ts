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
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
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

      // 🆕 배치 업데이트 후 카운터 리셋 + 플래그 정리 (Cloud Function 호출)
      // 재시도 로직 (최대 3회)
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
          // 플래그 정리를 위해 알림 ID 목록 전달
          await resetCounter({ notificationIds });
          resetSuccess = true;
          logger.info('미읽음 카운터 리셋 완료', { userId });
        } catch (counterError) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            // 재시도 전 대기 (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
            logger.warn('카운터 리셋 재시도', {
              attempt: retryCount,
              error: toError(counterError).message,
            });
          }
        }
      }

      // 🆕 최종 실패 시 로컬 카운터라도 0으로 설정
      if (!resetSuccess) {
        logger.error('카운터 리셋 최종 실패 - 로컬 카운터 동기화', {
          userId,
          attempts: MAX_RETRIES,
        });
        // 동적 import로 순환 참조 방지
        const { useNotificationStore } = await import('@/stores/notificationStore');
        useNotificationStore.getState().setUnreadCount(0);
      }

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

  async delete(notificationId: string, userId?: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS, notificationId);

      // 🆕 삭제 전 미읽음 상태 확인 (카운터 감소 필요 여부)
      const docSnap = await getDoc(docRef);
      const wasUnread = docSnap.exists() && docSnap.data()?.isRead === false;
      const recipientId = userId || docSnap.data()?.recipientId;

      await deleteDoc(docRef);

      // 🆕 미읽음이었으면 카운터 감소 (Cloud Function 호출)
      if (wasUnread && recipientId) {
        try {
          const functions = getFirebaseFunctions();
          const decrementCounter = httpsCallable<{ delta: number }, { success: boolean }>(
            functions,
            'decrementUnreadCounter'
          );
          await decrementCounter({ delta: 1 });
          logger.info('알림 삭제 후 카운터 감소', { notificationId });
        } catch (counterError) {
          // 카운터 감소 실패해도 삭제는 성공으로 처리
          logger.warn('알림 삭제 후 카운터 감소 실패', {
            notificationId,
            error: toError(counterError).message,
          });
          // 로컬 store에서 직접 감소 (fallback)
          const { useNotificationStore } = await import('@/stores/notificationStore');
          useNotificationStore.getState().decrementUnreadCount(1);
        }
      }

      logger.info('알림 삭제', { notificationId, wasUnread });
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

      // 🆕 삭제 전 미읽음 알림 개수 확인
      let unreadCount = 0;
      const CHUNK_SIZE = 10; // in 쿼리 제한

      for (let i = 0; i < notificationIds.length; i += CHUNK_SIZE) {
        const chunk = notificationIds.slice(i, i + CHUNK_SIZE);
        const notificationsRef = collection(getFirebaseDb(), COLLECTIONS.NOTIFICATIONS);
        const q = query(
          notificationsRef,
          where('__name__', 'in', chunk),
          where('isRead', '==', false)
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

      // 🆕 미읽음이 있었으면 카운터 감소
      if (unreadCount > 0) {
        try {
          const functions = getFirebaseFunctions();
          const decrementCounter = httpsCallable<{ delta: number }, { success: boolean }>(
            functions,
            'decrementUnreadCounter'
          );
          await decrementCounter({ delta: unreadCount });
          logger.info('여러 알림 삭제 후 카운터 감소', {
            count: notificationIds.length,
            unreadCount,
          });
        } catch (counterError) {
          // 카운터 감소 실패해도 삭제는 성공으로 처리
          logger.warn('여러 알림 삭제 후 카운터 감소 실패', {
            unreadCount,
            error: toError(counterError).message,
          });
          // 로컬 store에서 직접 감소 (fallback)
          const { useNotificationStore } = await import('@/stores/notificationStore');
          useNotificationStore.getState().decrementUnreadCount(unreadCount);
        }
      }

      logger.info('여러 알림 삭제', { count: notificationIds.length, unreadCount });
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
