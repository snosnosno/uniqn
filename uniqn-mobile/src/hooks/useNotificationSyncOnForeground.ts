/**
 * UNIQN Mobile - foreground notification sync hook
 *
 * Syncs notification badge/unread state when the app returns to foreground and
 * manages the unread-count realtime subscription.
 */

import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { isAppError } from '@/errors';
import { queryClient, queryKeys } from '@/lib/queryClient';
import {
  subscribeToUnreadCount,
  syncUnreadCounterFromServer,
} from '@/services/notifications/notificationService';
import {
  pushNotificationService,
  type NotificationPermissionStatus,
} from '@/services/notifications/pushNotificationService';
import * as tokenRefreshService from '@/services/observability/tokenRefreshService';
import { useNotificationStore } from '@/stores/notificationStore';
import { logger } from '@/utils/logger';

const LOCAL_UPDATE_GRACE_PERIOD_MS = 3000;
const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

export interface UseNotificationSyncOnForegroundOptions {
  enabled?: boolean;
  userId: string | undefined;
  isAuthenticated: boolean;
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  isTokenRegistered: boolean;
  clearBadge: () => Promise<void>;
  registerToken: () => Promise<boolean>;
  refreshPermissionStatus?: () => Promise<NotificationPermissionStatus>;
}

export function useNotificationSyncOnForeground(
  options: UseNotificationSyncOnForegroundOptions
): void {
  const {
    enabled = true,
    userId,
    isAuthenticated,
    permissionStatus,
    isTokenRegistered,
    clearBadge,
    registerToken,
    refreshPermissionStatus,
  } = options;

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        clearBadge().catch((e) => logger.warn('Badge clear failed', { error: String(e) }));

        const permission = refreshPermissionStatus
          ? await refreshPermissionStatus()
          : await pushNotificationService.checkPermission();

        if (permission.granted && !isTokenRegistered && userId && permissionStatus === 'granted') {
          registerToken().catch((e) =>
            logger.warn('Token registration failed', { error: String(e) })
          );
        } else if (permission.granted && isTokenRegistered) {
          if (tokenRefreshService.shouldRefreshOnForeground()) {
            logger.info('Triggering token refresh on foreground resume');
            tokenRefreshService
              .triggerRefresh()
              .catch((e) => logger.warn('Token refresh failed', { error: String(e) }));
          }
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

        if (userId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) });
        }

        if (userId) {
          syncUnreadCounterFromServer(userId)
            .then((count) => {
              if (count !== null) {
                useNotificationStore.getState().setUnreadCount(count);
              }
            })
            .catch((e) => logger.warn('Unread sync on foreground failed', { error: String(e) }));
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [
    clearBadge,
    enabled,
    isTokenRegistered,
    permissionStatus,
    refreshPermissionStatus,
    registerToken,
    userId,
  ]);

  useEffect(() => {
    if (!enabled || !userId || !isAuthenticated) return;

    let isMounted = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let currentUnsubscribe: (() => void) | null = null;

    const getRetryDelay = (attempt: number): number =>
      Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);

    const subscribe = (): (() => void) => {
      return subscribeToUnreadCount(
        userId,
        (count) => {
          if (!isMounted) return;

          retryCount = 0;

          const lastLocalUpdate = useNotificationStore.getState().lastCounterLocalUpdate;
          const timeSinceLastLocal = Date.now() - lastLocalUpdate;
          if (timeSinceLastLocal < LOCAL_UPDATE_GRACE_PERIOD_MS) {
            logger.debug('Ignoring unread realtime update during local grace period', {
              timeSinceLastLocal,
            });
            return;
          }

          useNotificationStore.getState().setUnreadCount(count);
        },
        (error) => {
          if (!isMounted) return;

          logger.warn('Unread realtime subscription failed', { error: error.message });

          if (isAppError(error) && !error.isRetryable) return;

          if (retryCount < MAX_RETRY_COUNT) {
            const delay = getRetryDelay(retryCount);
            retryCount++;

            logger.info('Scheduling unread subscription retry', { retryCount, delayMs: delay });

            retryTimeout = setTimeout(() => {
              if (!isMounted) return;
              currentUnsubscribe?.();
              currentUnsubscribe = subscribe();
            }, delay);
          } else {
            logger.warn('Unread subscription retry limit reached', { retryCount });
          }

          syncUnreadCounterFromServer(userId, true)
            .then((count) => {
              if (!isMounted || count === null) return;
              useNotificationStore.getState().setUnreadCount(count);
            })
            .catch((e) => logger.warn('Force sync for unread count failed', { error: String(e) }));
        }
      );
    };

    currentUnsubscribe = subscribe();

    if (useNotificationStore.getState().needsServerSync) {
      syncUnreadCounterFromServer(userId, true)
        .then((count) => {
          if (!isMounted || count === null) return;
          const store = useNotificationStore.getState();
          store.setUnreadCount(count);
          store.setNeedsServerSync(false);
        })
        .catch((e) => logger.warn('Cache reconciliation failed', { error: String(e) }));
    }

    return () => {
      isMounted = false;
      currentUnsubscribe?.();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [enabled, isAuthenticated, userId]);
}
