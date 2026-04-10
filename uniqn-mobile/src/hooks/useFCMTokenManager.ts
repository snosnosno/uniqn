/**
 * UNIQN Mobile - FCM token lifecycle hook
 *
 * Handles token registration, removal, refresh, and badge helpers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { pushNotificationService } from '@/services/notifications/pushNotificationService';
import * as tokenRefreshService from '@/services/observability/tokenRefreshService';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';

export interface UseFCMTokenManagerOptions {
  userId: string | undefined;
  isInitialized: boolean;
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  autoRegisterToken?: boolean;
}

export interface UseFCMTokenManagerReturn {
  isTokenRegistered: boolean;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
  setBadge: (count: number) => Promise<void>;
  clearBadge: () => Promise<void>;
}

const ACTIVE_TOKEN_REGISTRATION_RETRY_DELAY_MS = 15_000;

export function useFCMTokenManager(options: UseFCMTokenManagerOptions): UseFCMTokenManagerReturn {
  const { userId, isInitialized, permissionStatus, autoRegisterToken = true } = options;

  const [isTokenRegistered, setIsTokenRegistered] = useState(false);
  const [needsFollowUpRetry, setNeedsFollowUpRetry] = useState(false);
  const registerTokenPromiseRef = useRef<Promise<boolean> | null>(null);

  const registerToken = useCallback(async (): Promise<boolean> => {
    if (registerTokenPromiseRef.current) {
      return registerTokenPromiseRef.current;
    }

    const registerPromise = (async (): Promise<boolean> => {
      if (!userId) {
        logger.warn('Token registration skipped - userId is required');
        setNeedsFollowUpRetry(false);
        return false;
      }

      if (Platform.OS === 'web') {
        setNeedsFollowUpRetry(false);
        return false;
      }

      try {
        const success = await pushNotificationService.registerToken(userId);
        setIsTokenRegistered(success);
        setNeedsFollowUpRetry(!success);

        if (success) {
          logger.info('FCM token registration completed');
        }

        return success;
      } catch (error) {
        setIsTokenRegistered(false);
        setNeedsFollowUpRetry(true);
        logger.error('FCM token registration failed', toError(error));
        return false;
      } finally {
        registerTokenPromiseRef.current = null;
      }
    })();

    registerTokenPromiseRef.current = registerPromise;
    return registerPromise;
  }, [userId]);

  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    if (Platform.OS === 'web') return true;

    try {
      const success = await pushNotificationService.unregisterToken(userId);
      setIsTokenRegistered(false);
      setNeedsFollowUpRetry(false);
      logger.info('FCM token unregistration completed');
      return success;
    } catch (error) {
      logger.error('FCM token unregistration failed', toError(error));
      return false;
    }
  }, [userId]);

  const setBadge = useCallback(async (count: number): Promise<void> => {
    if (Platform.OS === 'web') return;
    await pushNotificationService.setBadge(count);
  }, []);

  const clearBadge = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    await pushNotificationService.clearBadge();
  }, []);

  useEffect(() => {
    if (autoRegisterToken && isInitialized && userId && permissionStatus === 'granted') {
      void registerToken();
    }
  }, [autoRegisterToken, isInitialized, permissionStatus, registerToken, userId]);

  useEffect(() => {
    if (!needsFollowUpRetry) return;
    if (!autoRegisterToken || !isInitialized || !userId || permissionStatus !== 'granted') return;
    if (isTokenRegistered || Platform.OS === 'web') return;
    if (registerTokenPromiseRef.current || AppState.currentState !== 'active') return;

    const retryTimer = setTimeout(() => {
      if (AppState.currentState !== 'active') return;

      setNeedsFollowUpRetry(false);
      registerToken()
        .then((success) => {
          if (!success) {
            logger.warn('FCM token follow-up registration attempt did not complete');
          }
        })
        .catch((error) => {
          logger.warn('FCM token follow-up registration attempt failed', {
            error: toError(error).message,
          });
        });
    }, ACTIVE_TOKEN_REGISTRATION_RETRY_DELAY_MS);

    return () => {
      clearTimeout(retryTimer);
    };
  }, [
    autoRegisterToken,
    isInitialized,
    isTokenRegistered,
    needsFollowUpRetry,
    permissionStatus,
    registerToken,
    userId,
  ]);

  useEffect(() => {
    if (!isTokenRegistered || !userId) return;
    if (Platform.OS === 'web') return;

    tokenRefreshService.start(
      {
        userId,
        onRefresh: async () => {
          const success = await registerToken();
          return success;
        },
        onFailure: (failureCount) => {
          logger.warn('Token refresh failed', { failureCount });
        },
        onSuccess: () => {
          logger.info('Token refresh succeeded (tokenRefreshService)');
        },
      },
      {
        baseInterval: 12 * 60 * 60 * 1000,
      }
    );

    return () => {
      tokenRefreshService.stop();
    };
  }, [isTokenRegistered, registerToken, userId]);

  useEffect(() => {
    if (!userId && isTokenRegistered) {
      setIsTokenRegistered(false);
    }

    if (!userId) {
      setNeedsFollowUpRetry(false);
      registerTokenPromiseRef.current = null;
    }
  }, [isTokenRegistered, userId]);

  return {
    isTokenRegistered,
    registerToken,
    unregisterToken,
    setBadge,
    clearBadge,
  };
}
