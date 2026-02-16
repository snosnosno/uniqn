/**
 * UNIQN Mobile - 포그라운드 동기화 & 카운터 구독 훅
 *
 * @description 앱 포그라운드 복귀 시 동기화 + 실시간 미읽음 카운터 구독
 * @version 1.0.0
 *
 * useNotificationHandler에서 분리:
 * - Effect 6: 앱 상태 변경 시 처리 (포그라운드 복귀)
 * - Effect 7: 실시간 미읽음 카운터 구독
 */

import { useEffect, useRef } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  subscribeToUnreadCount,
  syncUnreadCounterFromServer,
} from '@/services/notificationService';
import { pushNotificationService } from '@/services/pushNotificationService';
import * as tokenRefreshService from '@/services/tokenRefreshService';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { queryClient, queryKeys } from '@/lib/queryClient';

// ============================================================================
// Constants
// ============================================================================

/** onSnapshot 값을 무시하는 유예 기간 (로컬 변경 직후) */
const LOCAL_UPDATE_GRACE_PERIOD_MS = 3000;

// ============================================================================
// Types
// ============================================================================

export interface UseNotificationSyncOnForegroundOptions {
  /** 사용자 ID */
  userId: string | undefined;
  /** 인증 여부 */
  isAuthenticated: boolean;
  /** 토큰 등록 여부 */
  isTokenRegistered: boolean;
  /** 뱃지 초기화 함수 */
  clearBadge: () => Promise<void>;
  /** 토큰 등록 함수 */
  registerToken: () => Promise<boolean>;
}

// ============================================================================
// Hook
// ============================================================================

export function useNotificationSyncOnForeground(
  options: UseNotificationSyncOnForegroundOptions
): void {
  const { userId, isAuthenticated, isTokenRegistered, clearBadge, registerToken } = options;

  const appStateRef = useRef(AppState.currentState);

  // ============================================================================
  // Effects
  // ============================================================================

  // Effect 6: 앱 상태 변경 시 처리 (포그라운드 복귀)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        clearBadge();

        // 권한 상태 재확인 (설정 앱에서 변경했을 수 있음)
        const permission = await pushNotificationService.checkPermission();

        // 권한이 새로 부여되었으면 토큰 등록
        if (permission.granted && !isTokenRegistered && userId) {
          registerToken();
        } else if (permission.granted && isTokenRegistered) {
          if (tokenRefreshService.shouldRefreshOnForeground()) {
            logger.info('포그라운드 복귀 시 토큰 갱신 트리거');
            tokenRefreshService.triggerRefresh();
          }
        }

        // 포그라운드 복귀 시 놓친 알림 동기화
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

        // 포그라운드 복귀 시 카운터 재동기화 (C3: 반환값으로 Store 업데이트)
        if (userId) {
          syncUnreadCounterFromServer(userId).then((count) => {
            if (count !== null) {
              useNotificationStore.getState().setUnreadCount(count);
            }
          });
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [clearBadge, isTokenRegistered, userId, registerToken]);

  // Effect 7: 실시간 미읽음 카운터 구독 (Race Condition 방지 포함)
  useEffect(() => {
    if (!userId || !isAuthenticated) return;

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasRetried = false;
    let currentUnsubscribe: (() => void) | null = null;

    const subscribe = (): (() => void) => {
      return subscribeToUnreadCount(
        userId,
        (count) => {
          hasRetried = false;

          // Race Condition 방지: 최근 로컬 변경이 있었으면 서버 값 무시
          const lastLocalUpdate = useNotificationStore.getState().lastCounterLocalUpdate;
          const timeSinceLastLocal = Date.now() - lastLocalUpdate;
          if (timeSinceLastLocal < LOCAL_UPDATE_GRACE_PERIOD_MS) {
            logger.debug('카운터 동기화 스킵 - 로컬 업데이트 직후', { timeSinceLastLocal });
            return;
          }

          useNotificationStore.getState().setUnreadCount(count);
        },
        (error) => {
          logger.warn('실시간 미읽음 카운터 구독 에러', { error: error.message });

          if (isAppError(error) && !error.isRetryable) return;

          if (!hasRetried) {
            hasRetried = true;
            retryTimeout = setTimeout(() => {
              currentUnsubscribe?.();
              currentUnsubscribe = subscribe();
            }, 10_000);
          }

          // C3: forceSync로 서버 카운터 가져와서 Store 업데이트
          syncUnreadCounterFromServer(userId, true).then((count) => {
            if (count !== null) {
              useNotificationStore.getState().setUnreadCount(count);
            }
          });
        }
      );
    };

    currentUnsubscribe = subscribe();

    return () => {
      currentUnsubscribe?.();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [userId, isAuthenticated]);
}
