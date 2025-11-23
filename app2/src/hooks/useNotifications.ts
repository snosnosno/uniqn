/**
 * 알림 관리 Hook
 *
 * @description
 * Firestore 알림 컬렉션을 실시간으로 구독하고 관리하는 Hook
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import { useState, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  Timestamp,
  type Query,
  type DocumentData
} from 'firebase/firestore';

import { db } from '../firebase';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './useToast';
import { useFirestoreQuery } from './firestore';
import type {
  Notification,
  NotificationFilter,
  NotificationStats
} from '../types';

export interface UseNotificationsReturn {
  // 데이터
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats;

  // 상태
  loading: boolean;
  error: Error | null;

  // 액션
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllRead: () => Promise<void>;

  // 필터
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
}

/**
 * 알림 Hook
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, markAsRead } = useNotifications();
 *
 * return (
 *   <div>
 *     <Badge count={unreadCount} />
 *     {notifications.map(notification => (
 *       <NotificationItem
 *         key={notification.id}
 *         notification={notification}
 *         onMarkAsRead={markAsRead}
 *       />
 *     ))}
 *   </div>
 * );
 * ```
 */
export const useNotifications = (): UseNotificationsReturn => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<NotificationFilter>({});

  /**
   * Firestore 타임스탬프를 Date로 변환
   */
  const convertTimestamp = (timestamp: Date | Timestamp): Date => {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return timestamp.toDate();
  };

  /**
   * Firestore 쿼리 생성 (currentUser에 따라 동적 생성)
   */
  const notificationsQuery = useMemo((): Query<DocumentData> | null => {
    if (!currentUser) return null;

    return query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [currentUser]);

  /**
   * Firestore 실시간 구독 (useFirestoreQuery 사용)
   * id는 useFirestoreQuery가 자동으로 추가
   */
  type NotificationData = Omit<Notification, 'id' | 'createdAt' | 'sentAt' | 'readAt'> & {
    createdAt: Date | Timestamp;
    sentAt?: Date | Timestamp;
    readAt?: Date | Timestamp;
  };

  const {
    data: rawNotifications,
    loading,
    error,
  } = useFirestoreQuery<NotificationData>(notificationsQuery, {
    onSuccess: () => {
      // 로그 제거 - 불필요한 재구독 방지
    },
    onError: (err) => {
      logger.error('알림 구독 실패', err);
    },
  });

  /**
   * Firestore 데이터를 Notification 타입으로 변환
   * useFirestoreQuery는 FirestoreDocument<T>를 반환하므로 id가 이미 포함됨
   */
  const notifications = useMemo((): Notification[] => {
    return rawNotifications.map((doc): Notification => {
      const withId = doc as unknown as Notification;
      return {
        ...withId,
        createdAt: doc.createdAt ? convertTimestamp(doc.createdAt) : new Date(),
        sentAt: doc.sentAt ? convertTimestamp(doc.sentAt) : undefined,
        readAt: doc.readAt ? convertTimestamp(doc.readAt) : undefined,
      };
    });
  }, [rawNotifications]);

  /**
   * 필터링된 알림 목록
   */
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    if (filter.isRead !== undefined) {
      filtered = filtered.filter(n => n.isRead === filter.isRead);
    }

    if (filter.category) {
      filtered = filtered.filter(n => n.category === filter.category);
    }

    if (filter.priority) {
      filtered = filtered.filter(n => n.priority === filter.priority);
    }

    if (filter.startDate) {
      filtered = filtered.filter(n => {
        const createdAt = n.createdAt instanceof Date ? n.createdAt : convertTimestamp(n.createdAt);
        return createdAt >= filter.startDate!;
      });
    }

    if (filter.endDate) {
      filtered = filtered.filter(n => {
        const createdAt = n.createdAt instanceof Date ? n.createdAt : convertTimestamp(n.createdAt);
        return createdAt <= filter.endDate!;
      });
    }

    return filtered;
  }, [notifications, filter]);

  /**
   * 읽지 않은 알림 개수
   */
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  /**
   * 알림 통계
   */
  const stats = useMemo((): NotificationStats => {
    const byCategory = notifications.reduce((acc, n) => {
      acc[n.category] = (acc[n.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = notifications.reduce((acc, n) => {
      acc[n.priority] = (acc[n.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: notifications.length,
      unread: unreadCount,
      byCategory: byCategory as NotificationStats['byCategory'],
      byPriority: byPriority as NotificationStats['byPriority'],
    };
  }, [notifications, unreadCount]);

  /**
   * 알림 읽음 처리
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!currentUser) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: Timestamp.now(),
      });

      logger.info('알림 읽음 처리', { data: { notificationId } });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('알림 읽음 처리 실패', error, { data: { notificationId } });
      showError('알림 읽음 처리에 실패했습니다.');
    }
  }, [currentUser, showError]);

  /**
   * 모든 알림 읽음 처리
   */
  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;

    // notifications를 직접 참조하지 않고 쿼리로 가져옴
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', currentUser.uid),
      where('isRead', '==', false)
    );

    try {
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showSuccess('읽지 않은 알림이 없습니다.');
        return;
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, {
          isRead: true,
          readAt: Timestamp.now(),
        });
      });

      await batch.commit();

      logger.info('모든 알림 읽음 처리', {
        data: { count: snapshot.size }
      });
      showSuccess(`${snapshot.size}개의 알림을 읽음 처리했습니다.`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('모든 알림 읽음 처리 실패', error);
      showError('알림 읽음 처리에 실패했습니다.');
    }
  }, [currentUser, showSuccess, showError]);

  /**
   * 알림 삭제
   */
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!currentUser) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);

      logger.info('알림 삭제', { data: { notificationId } });
      showSuccess('알림이 삭제되었습니다.');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('알림 삭제 실패', error, { data: { notificationId } });
      showError('알림 삭제에 실패했습니다.');
    }
  }, [currentUser, showSuccess, showError]);

  /**
   * 읽은 알림 모두 삭제
   */
  const deleteAllRead = useCallback(async () => {
    if (!currentUser) return;

    // notifications를 직접 참조하지 않고 쿼리로 가져옴
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', currentUser.uid),
      where('isRead', '==', true)
    );

    try {
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showSuccess('읽은 알림이 없습니다.');
        return;
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();

      logger.info('읽은 알림 모두 삭제', {
        data: { count: snapshot.size }
      });
      showSuccess(`${snapshot.size}개의 알림이 삭제되었습니다.`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('읽은 알림 삭제 실패', error);
      showError('알림 삭제에 실패했습니다.');
    }
  }, [currentUser, showSuccess, showError]);

  return {
    // 데이터
    notifications: filteredNotifications,
    unreadCount,
    stats,

    // 상태
    loading,
    error,

    // 액션
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,

    // 필터
    filter,
    setFilter,
  };
};
