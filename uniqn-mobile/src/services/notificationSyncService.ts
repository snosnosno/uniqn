/**
 * UNIQN Mobile - Notification Sync Service
 *
 * @description 오프라인 복귀 시 놓친 알림 동기화
 * @version 1.0.0
 *
 * 기능:
 * - lastFetchedAt 이후 알림 동기화
 * - 중복 방지 (이미 존재하는 알림 필터링)
 * - 동기화 결과 통계
 */

import { fetchNotifications } from '@/services/notificationService';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import type { NotificationData } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  /** 동기화된 알림 수 */
  syncedCount: number;
  /** 새 알림 목록 */
  notifications: NotificationData[];
  /** 동기화 시작 시간 */
  syncedSince: Date | null;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 놓친 알림 동기화
 *
 * @param userId 사용자 ID
 * @param lastFetchedAt 마지막 조회 시간 (timestamp)
 * @param existingIds 이미 존재하는 알림 ID 목록 (중복 방지)
 * @returns 동기화 결과
 *
 * @example
 * ```ts
 * const result = await syncMissedNotifications(
 *   user.uid,
 *   store.lastFetchedAt,
 *   store.notifications.map(n => n.id)
 * );
 *
 * if (result.success && result.syncedCount > 0) {
 *   store.addNotifications(result.notifications);
 *   toast.info(`새 알림 ${result.syncedCount}개`);
 * }
 * ```
 */
export async function syncMissedNotifications(
  userId: string,
  lastFetchedAt: number | null,
  existingIds: string[] = []
): Promise<SyncResult> {
  // lastFetchedAt이 없으면 동기화 스킵
  if (!lastFetchedAt) {
    logger.info('lastFetchedAt 없음 - 동기화 스킵');
    return {
      syncedCount: 0,
      notifications: [],
      syncedSince: null,
      success: true,
    };
  }

  const syncedSince = new Date(lastFetchedAt);

  try {
    logger.info('놓친 알림 동기화 시작', {
      userId,
      since: syncedSince.toISOString(),
    });

    // lastFetchedAt 이후 알림 조회
    const result = await fetchNotifications({
      userId,
      filter: {
        startDate: syncedSince,
      },
      pageSize: 50, // 최대 50개
    });

    // 중복 필터링 (이미 존재하는 알림 제외)
    const existingIdSet = new Set(existingIds);
    const newNotifications = result.notifications.filter((n) => !existingIdSet.has(n.id));

    logger.info('놓친 알림 동기화 완료', {
      totalFetched: result.notifications.length,
      newCount: newNotifications.length,
      duplicateFiltered: result.notifications.length - newNotifications.length,
    });

    return {
      syncedCount: newNotifications.length,
      notifications: newNotifications,
      syncedSince,
      success: true,
    };
  } catch (error) {
    const err = toError(error);
    logger.error('놓친 알림 동기화 실패', err);

    return {
      syncedCount: 0,
      notifications: [],
      syncedSince,
      success: false,
      error: err.message,
    };
  }
}

/**
 * 동기화 필요 여부 확인
 *
 * @param lastFetchedAt 마지막 조회 시간
 * @param thresholdMs 임계값 (밀리초, 기본 5분)
 * @returns 동기화 필요 여부
 */
export function shouldSync(
  lastFetchedAt: number | null,
  thresholdMs: number = 5 * 60 * 1000
): boolean {
  if (!lastFetchedAt) return true;

  const elapsed = Date.now() - lastFetchedAt;
  return elapsed > thresholdMs;
}

// ============================================================================
// Export
// ============================================================================

export default {
  syncMissedNotifications,
  shouldSync,
};
