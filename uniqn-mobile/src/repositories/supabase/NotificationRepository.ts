/**
 * UNIQN Mobile - Supabase Notification Repository
 *
 * @description Supabase PostgREST 기반 Notification Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 알림 CRUD 작업 캡슐화
 * 2. 실시간 구독 (Supabase Realtime)
 * 3. FCM 토큰 관리
 * 4. 알림 설정 관리
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import {
  handleSupabaseError,
  toCamelCase,
  toSnakeCase,
  paginatedQuery,
  createRealtimeSubscription,
} from '@/utils/supabase';
import { parseNotificationSettingsDocument } from '@/schemas';
import {
  createDefaultNotificationSettings,
  getNotificationCategory,
  getNotificationPriority,
} from '@/types/notification';
import type {
  INotificationRepository,
  GetNotificationsOptions,
} from '../interfaces/INotificationRepository';
import type { NotificationData, NotificationSettings } from '@/types/notification';
import type { PaginatedResult } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  NOTIFICATIONS: 'notifications',
  USERS: 'users',
  NOTIFICATION_SETTINGS: 'notification_settings',
  FCM_TOKENS: 'fcm_tokens',
  NOTIFICATION_COUNTERS: 'notification_counters',
} as const;

const PAGE_SIZE = 20;
const NOTIFICATION_REALTIME_LIMIT = 50;
const NOTIFICATION_COLUMNS =
  'id,body,category,created_at,data,is_read,link,priority,read_at,recipient_id,title,type' as const;
const NOTIFICATION_SETTINGS_COLUMNS =
  'id,user_id,enabled,push_enabled,categories,quiet_hours,updated_at' as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * snake_case DB 행을 NotificationData로 변환
 */
function toNotification(row: Record<string, unknown>): NotificationData {
  const type = row.type as NotificationData['type'];

  return {
    id: row.id as string,
    recipientId: row.recipient_id as string,
    type,
    category: getNotificationCategory(type),
    title: row.title as string,
    body: row.body as string,
    link: (row.link as string) ?? undefined,
    data: (row.data as Record<string, string>) ?? undefined,
    isRead: (row.is_read as boolean) ?? false,
    priority: getNotificationPriority(type),
    createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Supabase Notification Repository
 */
export class SupabaseNotificationRepository implements INotificationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(notificationId: string): Promise<NotificationData | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(NOTIFICATION_COLUMNS)
        .eq('id', notificationId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '알림 조회', table: TABLES.NOTIFICATIONS });
      }

      if (!data) {
        return null;
      }

      return toNotification(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 조회 실패', toError(error), { notificationId });
      handleSupabaseError(error, { operation: '알림 조회', table: TABLES.NOTIFICATIONS });
    }
  }

  async getByUserId(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<PaginatedResult<NotificationData>> {
    try {
      const { filter, pageSize = PAGE_SIZE, lastDoc } = options;

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.NOTIFICATIONS, {
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor: lastDoc,
        filters: (q) => {
          let query = q.eq('recipient_id', userId);

          if (filter?.isRead !== undefined) {
            query = query.eq('is_read', filter.isRead);
          }
          if (filter?.types && filter.types.length > 0) {
            query = query.in('type', filter.types);
          }
          if (filter?.startDate) {
            query = query.gte('created_at', filter.startDate.toISOString());
          }
          if (filter?.endDate) {
            query = query.lte('created_at', filter.endDate.toISOString());
          }

          return query;
        },
      });

      const items = result.items.map(toNotification);

      logger.info('알림 목록 조회 성공', {
        component: 'NotificationRepository',
        count: items.length,
        hasMore: result.hasMore,
      });

      return {
        items,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 목록 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '알림 목록 조회', table: TABLES.NOTIFICATIONS });
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) {
        handleSupabaseError(error, {
          operation: '미읽음 알림 수 조회',
          table: TABLES.NOTIFICATIONS,
        });
      }

      return count ?? 0;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('미읽음 알림 수 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '미읽음 알림 수 조회', table: TABLES.NOTIFICATIONS });
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
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATION_COUNTERS)
        .select('unread_count')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, {
          operation: '캐싱된 미읽음 카운터 조회',
          table: TABLES.NOTIFICATION_COUNTERS,
        });
      }

      if (!data) {
        return null;
      }

      return ((data as Record<string, unknown>).unread_count as number) ?? 0;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('캐싱된 미읽음 카운터 조회 실패', toError(error), { userId });
      handleSupabaseError(error, {
        operation: '캐싱된 미읽음 카운터 조회',
        table: TABLES.NOTIFICATION_COUNTERS,
      });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) {
        handleSupabaseError(error, { operation: '알림 읽음 처리', table: TABLES.NOTIFICATIONS });
      }

      logger.info('알림 읽음 처리', { notificationId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 읽음 처리 실패', toError(error), { notificationId });
      handleSupabaseError(error, { operation: '알림 읽음 처리', table: TABLES.NOTIFICATIONS });
    }
  }

  async markAllAsRead(userId: string): Promise<{ updatedIds: string[] }> {
    try {
      // 1. 미읽음 알림 ID 목록 조회
      const { data: unreadData, error: fetchError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id')
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (fetchError) {
        handleSupabaseError(fetchError, {
          operation: '미읽음 알림 조회',
          table: TABLES.NOTIFICATIONS,
        });
      }

      const unreadIds = ((unreadData ?? []) as Record<string, unknown>[]).map(
        (row) => row.id as string
      );

      if (unreadIds.length === 0) {
        logger.info('읽지 않은 알림 없음');
        return { updatedIds: [] };
      }

      // 2. 일괄 읽음 처리
      const { error: updateError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (updateError) {
        handleSupabaseError(updateError, {
          operation: '모든 알림 읽음 처리',
          table: TABLES.NOTIFICATIONS,
        });
      }

      logger.info('모든 알림 읽음 처리', { count: unreadIds.length });
      return { updatedIds: unreadIds };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('모든 알림 읽음 처리 실패', toError(error), { userId });
      handleSupabaseError(error, {
        operation: '모든 알림 읽음 처리',
        table: TABLES.NOTIFICATIONS,
      });
    }
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async delete(notificationId: string): Promise<{ wasUnread: boolean; recipientId?: string }> {
    try {
      // 삭제 전 상태 확인
      const { data, error: fetchError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id, is_read, recipient_id')
        .eq('id', notificationId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, {
          operation: '알림 삭제 전 조회',
          table: TABLES.NOTIFICATIONS,
        });
      }

      if (!data) {
        logger.warn('삭제할 알림이 존재하지 않음', { notificationId });
        return { wasUnread: false };
      }

      const row = data as Record<string, unknown>;
      const wasUnread = row.is_read === false;
      const recipientId = row.recipient_id as string | undefined;

      const { error: deleteError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .eq('id', notificationId);

      if (deleteError) {
        handleSupabaseError(deleteError, { operation: '알림 삭제', table: TABLES.NOTIFICATIONS });
      }

      logger.info('알림 삭제', { notificationId, wasUnread });
      return { wasUnread, recipientId };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 삭제 실패', toError(error), { notificationId });
      handleSupabaseError(error, { operation: '알림 삭제', table: TABLES.NOTIFICATIONS });
    }
  }

  async deleteMany(notificationIds: string[]): Promise<{ deletedUnreadCount: number }> {
    if (notificationIds.length === 0) return { deletedUnreadCount: 0 };

    try {
      // 삭제 전 미읽음 개수 확인
      const { count, error: countError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id', { count: 'exact', head: true })
        .in('id', notificationIds)
        .eq('is_read', false);

      if (countError) {
        handleSupabaseError(countError, {
          operation: '삭제 대상 미읽음 카운트',
          table: TABLES.NOTIFICATIONS,
        });
      }

      const unreadCount = count ?? 0;

      // 일괄 삭제
      const { error: deleteError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .in('id', notificationIds);

      if (deleteError) {
        handleSupabaseError(deleteError, {
          operation: '여러 알림 삭제',
          table: TABLES.NOTIFICATIONS,
        });
      }

      logger.info('여러 알림 삭제', { count: notificationIds.length, unreadCount });
      return { deletedUnreadCount: unreadCount };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('여러 알림 삭제 실패', toError(error), { count: notificationIds.length });
      handleSupabaseError(error, { operation: '여러 알림 삭제', table: TABLES.NOTIFICATIONS });
    }
  }

  async deleteOlderThan(userId: string, daysToKeep: number): Promise<number> {
    let totalDeleted = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Supabase는 DELETE + 조건으로 일괄 삭제 가능
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .eq('recipient_id', userId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        handleSupabaseError(error, { operation: '오래된 알림 정리', table: TABLES.NOTIFICATIONS });
      }

      totalDeleted = (data ?? []).length;

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
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATION_SETTINGS)
        .select(NOTIFICATION_SETTINGS_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, {
          operation: '알림 설정 조회',
          table: TABLES.NOTIFICATION_SETTINGS,
        });
      }

      if (!data) {
        return createDefaultNotificationSettings();
      }

      const camel = toCamelCase<Record<string, unknown>>(data as Record<string, unknown>);
      const parsed = parseNotificationSettingsDocument(camel);
      if (!parsed) {
        logger.warn('알림 설정 문서 파싱 실패, 기본값 반환', { userId });
        return createDefaultNotificationSettings();
      }

      return parsed;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 설정 조회 실패', toError(error), { userId });
      handleSupabaseError(error, {
        operation: '알림 설정 조회',
        table: TABLES.NOTIFICATION_SETTINGS,
      });
    }
  }

  async saveSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      const snakeData = toSnakeCase(settings as unknown as Record<string, unknown>);

      const { error } = await supabase.from(TABLES.NOTIFICATION_SETTINGS).upsert({
        user_id: userId,
        ...snakeData,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        handleSupabaseError(error, {
          operation: '알림 설정 저장',
          table: TABLES.NOTIFICATION_SETTINGS,
        });
      }

      logger.info('알림 설정 저장', { userId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('알림 설정 저장 실패', toError(error), { userId });
      handleSupabaseError(error, {
        operation: '알림 설정 저장',
        table: TABLES.NOTIFICATION_SETTINGS,
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
      const now = new Date().toISOString();

      const { error } = await supabase.from(TABLES.FCM_TOKENS).upsert(
        {
          user_id: userId,
          token,
          type: metadata.type,
          platform: metadata.platform,
          registered_at: now,
          last_refreshed_at: now,
        },
        { onConflict: 'user_id,token' }
      );

      if (error) {
        handleSupabaseError(error, { operation: 'FCM 토큰 등록', table: TABLES.FCM_TOKENS });
      }

      logger.info('FCM 토큰 등록', {
        userId,
        tokenPrefix: token.substring(0, 20),
        type: metadata.type,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('FCM 토큰 등록 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: 'FCM 토큰 등록', table: TABLES.FCM_TOKENS });
    }
  }

  async unregisterFCMToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.FCM_TOKENS)
        .delete()
        .eq('user_id', userId)
        .eq('token', token);

      if (error) {
        handleSupabaseError(error, { operation: 'FCM 토큰 삭제', table: TABLES.FCM_TOKENS });
      }

      logger.info('FCM 토큰 삭제', { userId, tokenPrefix: token.substring(0, 20) });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('FCM 토큰 삭제 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: 'FCM 토큰 삭제', table: TABLES.FCM_TOKENS });
    }
  }

  async unregisterAllFCMTokens(userId: string): Promise<void> {
    try {
      const { error } = await supabase.from(TABLES.FCM_TOKENS).delete().eq('user_id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '모든 FCM 토큰 삭제', table: TABLES.FCM_TOKENS });
      }

      logger.info('모든 FCM 토큰 삭제', { userId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('모든 FCM 토큰 삭제 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '모든 FCM 토큰 삭제', table: TABLES.FCM_TOKENS });
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
    try {
      let currentNotifications: NotificationData[] = [];

      const fullReload = (): void => {
        supabase
          .from(TABLES.NOTIFICATIONS)
          .select(NOTIFICATION_COLUMNS)
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(NOTIFICATION_REALTIME_LIMIT)
          .then(({ data, error }) => {
            if (error) {
              onError?.(new Error(error.message));
              return;
            }
            currentNotifications = ((data ?? []) as Record<string, unknown>[]).map(toNotification);
            onNotifications(currentNotifications);
          });
      };

      // 초기 데이터 로드
      fullReload();

      // Realtime 구독으로 변경사항 증분 처리
      const unsubscribe = createRealtimeSubscription(
        TABLES.NOTIFICATIONS,
        `recipient_id=eq.${userId}`,
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotification = toNotification(payload.new as Record<string, unknown>);
            currentNotifications = [newNotification, ...currentNotifications];
            if (currentNotifications.length > NOTIFICATION_REALTIME_LIMIT) {
              currentNotifications = currentNotifications.slice(0, NOTIFICATION_REALTIME_LIMIT);
            }
            onNotifications(currentNotifications);
          } else if (payload.eventType === 'UPDATE') {
            const updated = toNotification(payload.new as Record<string, unknown>);
            currentNotifications = currentNotifications.map((n) =>
              n.id === updated.id ? updated : n
            );
            onNotifications(currentNotifications);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, unknown>).id as string;
            currentNotifications = currentNotifications.filter((n) => n.id !== deletedId);
            onNotifications(currentNotifications);
          } else {
            // 알 수 없는 이벤트 타입 — 안전하게 전체 재조회
            fullReload();
          }
        }
      );

      logger.info('알림 구독 시작', { userId });
      return unsubscribe;
    } catch (error) {
      logger.error('알림 구독 설정 실패', toError(error), { userId });
      onError?.(toError(error));
      return () => {
        /* noop */
      };
    }
  }

  subscribeToUnreadCount(
    userId: string,
    onCount: (count: number) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      // 초기 카운트 로드
      this.getUnreadCount(userId)
        .then(onCount)
        .catch((error) => {
          logger.error('초기 미읽음 카운트 조회 실패', toError(error));
          onCount(0);
        });

      // Realtime 구독으로 변경 감지 시 카운트 재조회
      const unsubscribe = createRealtimeSubscription(
        TABLES.NOTIFICATIONS,
        `recipient_id=eq.${userId}`,
        () => {
          this.getUnreadCount(userId)
            .then(onCount)
            .catch((error) => {
              logger.error('미읽음 카운트 재조회 실패', toError(error));
              onError?.(toError(error));
            });
        }
      );

      logger.info('읽지 않은 알림 수 구독 시작', { userId });
      return unsubscribe;
    } catch (error) {
      logger.error('미읽음 카운트 구독 설정 실패', toError(error), { userId });
      onError?.(toError(error));
      return () => {
        /* noop */
      };
    }
  }
}
