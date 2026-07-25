import * as Sentry from '@sentry/react-native';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { toError } from '@/errors';
import { notificationRepository } from '@/repositories';
import { isSyncCacheValid, updateSyncCache } from '@/shared/cache/counterSyncCache';
import { logger } from '@/utils/logger';
import { normalizeNotification } from './notificationMessageNormalizer';
import type {
  FetchNotificationsOptions,
  FetchNotificationsResult,
} from './notificationServiceTypes';
import type { NotificationData } from '@/types/notification';

const PAGE_SIZE = 20;
const COMPONENT = 'notificationService';

async function resetUnreadCounterWithRetry(
  notificationIds: string[],
  userId: string
): Promise<boolean> {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const { error } = await invokeEdgeFunction('reset-unread-counter', {
        body: { notificationIds },
      });
      if (error) throw error;
      logger.info('미읽음 카운터 리셋 완료', { userId });
      return true;
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

  logger.error('카운터 리셋 최종 실패 - onSnapshot/foreground sync에서 보정 예정', {
    userId,
    attempts: MAX_RETRIES,
  });
  Sentry.addBreadcrumb({
    category: 'swallow',
    level: 'warning',
    message: '미읽음 카운터 리셋 최종 실패 — 무시됨',
    data: { userId, attempts: MAX_RETRIES },
  });
  return false;
}

async function decrementUnreadCounterWithRetry(delta: number): Promise<boolean> {
  try {
    const { error } = await invokeEdgeFunction('decrement-unread-counter', {
      body: { delta },
    });
    if (error) throw error;
    logger.info('미읽음 카운터 감소 완료', { delta });
    return true;
  } catch (counterError) {
    logger.warn('미읽음 카운터 감소 실패 - onSnapshot/foreground sync에서 보정 예정', {
      delta,
      error: toError(counterError).message,
    });
    Sentry.addBreadcrumb({
      category: 'swallow',
      level: 'warning',
      message: '미읽음 카운터 감소 실패 — 무시됨',
      data: { delta, error: String(counterError) },
    });
    return false;
  }
}

export async function syncUnreadCounterFromServer(
  userId: string,
  forceSync: boolean = false
): Promise<number | null> {
  try {
    if (!forceSync && isSyncCacheValid(userId)) {
      logger.debug('카운터 동기화 스킵 - 캐시 TTL 내', { userId });
      return null;
    }

    const serverCount = await notificationRepository.getUnreadCounterFromCache(userId);

    if (serverCount !== null) {
      updateSyncCache(userId);
    }

    return serverCount;
  } catch (error) {
    logger.warn('카운터 동기화 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.addBreadcrumb({
      category: 'swallow',
      level: 'warning',
      message: '카운터 동기화 실패 — 무시됨',
      data: { userId, error: String(error) },
    });
    return null;
  }
}

export async function getUnreadCounterFromCache(userId: string): Promise<number | null> {
  try {
    return await notificationRepository.getUnreadCounterFromCache(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '캐시된 미읽음 카운터 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

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
      notifications: result.items.map(normalizeNotification),
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

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const cachedCount = await notificationRepository.getUnreadCounterFromCache(userId);
    if (cachedCount !== null) {
      return cachedCount;
    }

    return await notificationRepository.getUnreadCount(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '읽지 않은 알림 수 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

export async function getNotification(notificationId: string): Promise<NotificationData | null> {
  try {
    const notification = await notificationRepository.getById(notificationId);
    return notification ? normalizeNotification(notification) : null;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 상세 조회',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

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

export async function deleteAllNotifications(userId: string): Promise<number> {
  try {
    const { deletedCount } = await notificationRepository.deleteAllByRecipient(userId);
    if (deletedCount > 0) {
      // DB 행 트리거가 카운터를 감소시키지만, EF 리셋(멱등 upsert 0)으로 0 확정
      await resetUnreadCounterWithRetry([], userId);
    }
    return deletedCount;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 알림 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

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

export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: NotificationData[]) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToNotifications(
    userId,
    (notifications) => {
      onNotifications(notifications.map(normalizeNotification));
    },
    onError
  );
}

export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToUnreadCount(userId, onCount, onError);
}
