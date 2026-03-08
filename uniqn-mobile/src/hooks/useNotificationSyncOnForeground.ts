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
} from '@/services/notifications/notificationService';
import { pushNotificationService } from '@/services/notifications/pushNotificationService';
import * as tokenRefreshService from '@/services/observability/tokenRefreshService';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { queryClient, queryKeys } from '@/lib/queryClient';

// ============================================================================
// Constants
// ============================================================================

/** onSnapshot 값을 무시하는 유예 기간 (로컬 변경 직후) */
const LOCAL_UPDATE_GRACE_PERIOD_MS = 3000;

/** 최대 재시도 횟수 */
const MAX_RETRY_COUNT = 3;

/** 기본 재시도 대기 시간 (ms) */
const BASE_RETRY_DELAY_MS = 1000;

/** 최대 재시도 대기 시간 (ms) */
const MAX_RETRY_DELAY_MS = 30_000;

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
        clearBadge().catch((e) => logger.warn('배지 초기화 실패', { error: String(e) }));

        // 권한 상태 재확인 (설정 앱에서 변경했을 수 있음)
        const permission = await pushNotificationService.checkPermission();

        // 권한이 새로 부여되었으면 토큰 등록
        if (permission.granted && !isTokenRegistered && userId) {
          registerToken().catch((e) => logger.warn('토큰 등록 실패', { error: String(e) }));
        } else if (permission.granted && isTokenRegistered) {
          if (tokenRefreshService.shouldRefreshOnForeground()) {
            logger.info('포그라운드 복귀 시 토큰 갱신 트리거');
            tokenRefreshService
              .triggerRefresh()
              .catch((e) => logger.warn('토큰 갱신 실패', { error: String(e) }));
          }
        }

        // 포그라운드 복귀 시 놓친 알림 동기화
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

        // 포그라운드 복귀 시 프로필 리프레시 (다른 디바이스 변경 반영)
        if (userId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) });
        }

        // 포그라운드 복귀 시 카운터 재동기화 (C3: 반환값으로 Store 업데이트)
        if (userId) {
          syncUnreadCounterFromServer(userId)
            .then((count) => {
              if (count !== null) {
                useNotificationStore.getState().setUnreadCount(count);
              }
            })
            .catch((e) => logger.warn('포그라운드 카운터 동기화 실패', { error: String(e) }));
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [clearBadge, isTokenRegistered, userId, registerToken]);

  // Effect 7: 실시간 미읽음 카운터 구독 (Race Condition 방지 + Exponential Backoff)
  useEffect(() => {
    if (!userId || !isAuthenticated) return;

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

          // 성공 시 재시도 카운트 리셋
          retryCount = 0;

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
          if (!isMounted) return;

          logger.warn('실시간 미읽음 카운터 구독 에러', { error: error.message });

          if (isAppError(error) && !error.isRetryable) return;

          if (retryCount < MAX_RETRY_COUNT) {
            const delay = getRetryDelay(retryCount);
            retryCount++;

            logger.info('카운터 구독 재시도 예약', { retryCount, delayMs: delay });

            retryTimeout = setTimeout(() => {
              if (!isMounted) return;
              currentUnsubscribe?.();
              currentUnsubscribe = subscribe();
            }, delay);
          } else {
            logger.warn('카운터 구독 최대 재시도 초과', { retryCount });
          }

          // forceSync로 서버 카운터 가져와서 Store 업데이트
          syncUnreadCounterFromServer(userId, true)
            .then((count) => {
              if (!isMounted || count === null) return;
              useNotificationStore.getState().setUnreadCount(count);
            })
            .catch((e) => logger.warn('forceSync 카운터 동기화 실패', { error: String(e) }));
        }
      );
    };

    currentUnsubscribe = subscribe();

    // 오프라인 캐시 정합성: rehydration 시 불일치 감지된 경우 즉시 서버 동기화
    if (useNotificationStore.getState().needsServerSync) {
      syncUnreadCounterFromServer(userId, true)
        .then((count) => {
          if (!isMounted || count === null) return;
          const store = useNotificationStore.getState();
          store.setUnreadCount(count);
          store.setNeedsServerSync(false);
        })
        .catch((e) => logger.warn('캐시 정합성 동기화 실패', { error: String(e) }));
    }

    return () => {
      isMounted = false;
      currentUnsubscribe?.();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [userId, isAuthenticated]);
}
