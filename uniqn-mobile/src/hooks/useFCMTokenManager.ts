/**
 * UNIQN Mobile - FCM 토큰 라이프사이클 훅
 *
 * @description 토큰 등록/해제/갱신, 뱃지 관리
 * @version 1.0.0
 *
 * useNotificationHandler에서 분리:
 * - Effect 3: 로그인 시 토큰 자동 등록
 * - Effect 4: 토큰 갱신 서비스
 * - Effect 5: 로그아웃 시 토큰 상태 초기화
 */

import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { pushNotificationService } from '@/services/pushNotificationService';
import * as tokenRefreshService from '@/services/tokenRefreshService';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface UseFCMTokenManagerOptions {
  /** 사용자 ID */
  userId: string | undefined;
  /** 초기화 완료 여부 */
  isInitialized: boolean;
  /** 권한 상태 */
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  /** 로그인 시 토큰 자동 등록 여부 (기본: true) */
  autoRegisterToken?: boolean;
}

export interface UseFCMTokenManagerReturn {
  /** 토큰 등록 완료 여부 */
  isTokenRegistered: boolean;
  /** 토큰 등록 */
  registerToken: () => Promise<boolean>;
  /** 토큰 해제 */
  unregisterToken: () => Promise<boolean>;
  /** 뱃지 수 설정 */
  setBadge: (count: number) => Promise<void>;
  /** 뱃지 초기화 */
  clearBadge: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useFCMTokenManager(options: UseFCMTokenManagerOptions): UseFCMTokenManagerReturn {
  const { userId, isInitialized, permissionStatus, autoRegisterToken = true } = options;

  const [isTokenRegistered, setIsTokenRegistered] = useState(false);

  // ============================================================================
  // Actions
  // ============================================================================

  const registerToken = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      logger.warn('토큰 등록 실패 - 로그인 필요');
      return false;
    }
    if (Platform.OS === 'web') return false;

    try {
      const success = await pushNotificationService.registerToken(userId);
      setIsTokenRegistered(success);
      if (success) {
        logger.info('FCM 토큰 등록 완료');
      }
      return success;
    } catch (error) {
      logger.error('토큰 등록 실패', toError(error));
      return false;
    }
  }, [userId]);

  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    if (Platform.OS === 'web') return true;

    try {
      const success = await pushNotificationService.unregisterToken(userId);
      setIsTokenRegistered(false);
      logger.info('FCM 토큰 해제 완료');
      return success;
    } catch (error) {
      logger.error('토큰 해제 실패', toError(error));
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

  // ============================================================================
  // Effects
  // ============================================================================

  // Effect 3: 로그인 시 토큰 자동 등록
  useEffect(() => {
    if (autoRegisterToken && isInitialized && userId && permissionStatus === 'granted') {
      registerToken();
    }
  }, [autoRegisterToken, isInitialized, userId, permissionStatus, registerToken]);

  // Effect 4: 토큰 갱신 서비스 (Exponential Backoff 기반)
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
          logger.warn('토큰 갱신 실패', { failureCount });
        },
        onSuccess: () => {
          logger.info('토큰 갱신 성공 (tokenRefreshService)');
        },
      },
      {
        baseInterval: 12 * 60 * 60 * 1000, // 12시간
      }
    );

    return () => {
      tokenRefreshService.stop();
    };
  }, [isTokenRegistered, userId, registerToken]);

  // Effect 5: 로그아웃 시 토큰 상태 초기화
  useEffect(() => {
    if (!userId && isTokenRegistered) {
      setIsTokenRegistered(false);
    }
  }, [userId, isTokenRegistered]);

  return {
    isTokenRegistered,
    registerToken,
    unregisterToken,
    setBadge,
    clearBadge,
  };
}
