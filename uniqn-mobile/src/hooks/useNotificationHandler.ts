/**
 * UNIQN Mobile - 통합 알림 핸들러 훅
 *
 * @description 푸시 알림 수신/터치 처리 + 권한/토큰 관리 + 딥링크 네비게이션
 * @version 2.0.0
 *
 * @changelog
 * - v2.0.0: usePushNotifications 기능 통합
 *   - 상태 반환 (isInitialized, permissionStatus, isTokenRegistered)
 *   - 액션 메서드 (requestPermission, registerToken, unregisterToken, setBadge, clearBadge, openSettings)
 *   - 24시간 토큰 자동 갱신
 *   - 앱 포그라운드 복귀 시 뱃지 초기화
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Platform, AppState, Linking, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  pushNotificationService,
  type NotificationPayload,
} from '@/services/pushNotificationService';
import * as tokenRefreshService from '@/services/tokenRefreshService';
import { navigateFromNotification, waitForNavigationReadyAsync } from '@/services/deepLinkService';
import { subscribeToUnreadCount } from '@/services/notificationService';
import { trackEvent } from '@/services/analyticsService';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { Timestamp } from 'firebase/firestore';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { notificationRepository } from '@/repositories';
import type { NotificationType, NotificationData } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/** 마지막 동기화 시간 캐시 (userId → timestamp) */
const lastSyncTimeCache = new Map<string, number>();

/** 동기화 캐시 TTL (밀리초) - 30초 */
const SYNC_CACHE_TTL_MS = 30000;

/**
 * 서버에서 미읽음 카운터 동기화
 *
 * @description 포그라운드 복귀 시 또는 멀티 디바이스 동기화를 위해 서버 카운터 조회
 * @param userId 사용자 ID
 * @param forceSync 캐시 무시하고 강제 동기화 (기본값: false)
 *
 * @note 알림 목록 화면 진입 시에도 호출 가능하도록 export
 * @note 30초 캐시 TTL 적용으로 불필요한 Firestore 읽기 방지
 */
export async function syncUnreadCounterFromServer(
  userId: string,
  forceSync: boolean = false
): Promise<void> {
  try {
    // 🆕 캐시 TTL 체크 (불필요한 Firestore 읽기 방지)
    const now = Date.now();
    const lastSyncTime = lastSyncTimeCache.get(userId) ?? 0;

    if (!forceSync && now - lastSyncTime < SYNC_CACHE_TTL_MS) {
      logger.debug('카운터 동기화 스킵 - 캐시 TTL 내', {
        userId,
        lastSyncAgo: now - lastSyncTime,
      });
      return;
    }

    // Repository를 통해 캐시된 카운터 조회
    const serverCount = await notificationRepository.getUnreadCounterFromCache(userId);

    // 캐시 갱신
    lastSyncTimeCache.set(userId, now);

    if (serverCount !== null) {
      const localCount = useNotificationStore.getState().unreadCount;

      // 서버와 로컬 카운트가 다르면 동기화
      if (serverCount !== localCount) {
        useNotificationStore.getState().setUnreadCount(serverCount);
        logger.info('포그라운드 복귀 - 카운터 동기화', {
          serverCount,
          localCount,
          diff: serverCount - localCount,
        });
      }
    }
  } catch (error) {
    logger.warn('카운터 동기화 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    // 동기화 실패해도 앱은 계속 동작
  }
}

/**
 * 카운터 동기화 캐시 초기화
 *
 * @description 로그아웃 시 호출하여 다음 로그인 시 새로 동기화
 * @param userId 사용자 ID (선택, 없으면 전체 캐시 초기화)
 */
export function clearCounterSyncCache(userId?: string): void {
  if (userId) {
    lastSyncTimeCache.delete(userId);
  } else {
    lastSyncTimeCache.clear();
  }
}

// ============================================================================
// Types
// ============================================================================

export interface UseNotificationHandlerOptions {
  /** 포그라운드 알림 수신 시 토스트 표시 여부 (기본: true) */
  showForegroundToast?: boolean;
  /** 알림 수신 콜백 */
  onNotificationReceived?: (notification: NotificationPayload) => void;
  /** 알림 터치 콜백 (네비게이션 전) */
  onNotificationTapped?: (notification: NotificationPayload) => void;
  /** 자동 초기화 여부 (기본: true) */
  autoInitialize?: boolean;
  /** 로그인 시 토큰 자동 등록 여부 (기본: true) */
  autoRegisterToken?: boolean;
}

export interface UseNotificationHandlerReturn {
  // ========== 상태 ==========
  /** 초기화 완료 여부 */
  isInitialized: boolean;
  /** 권한 상태 */
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  /** 권한 요청 중 */
  isRequestingPermission: boolean;
  /** 토큰 등록 완료 여부 */
  isTokenRegistered: boolean;

  // ========== 액션 ==========
  /** 권한 요청 */
  requestPermission: () => Promise<boolean>;
  /** 토큰 등록 */
  registerToken: () => Promise<boolean>;
  /** 토큰 해제 */
  unregisterToken: () => Promise<boolean>;
  /** 뱃지 수 설정 */
  setBadge: (count: number) => Promise<void>;
  /** 뱃지 초기화 */
  clearBadge: () => Promise<void>;
  /** 설정 앱 열기 (권한 거부 시) */
  openSettings: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 통합 알림 핸들러 훅
 *
 * @description MainNavigator에서 사용하여 푸시 알림과 딥링크 처리
 *
 * @example
 * function MainNavigator() {
 *   const {
 *     isInitialized,
 *     permissionStatus,
 *     requestPermission,
 *     openSettings,
 *   } = useNotificationHandler({
 *     showForegroundToast: true,
 *     onNotificationReceived: (n) => console.log('알림 수신:', n),
 *   });
 *
 *   // 권한 거부 시 설정 앱으로 이동
 *   if (permissionStatus === 'denied') {
 *     return <PermissionDeniedScreen onOpenSettings={openSettings} />;
 *   }
 *
 *   return <Stack />;
 * }
 */
export function useNotificationHandler(
  options: UseNotificationHandlerOptions = {}
): UseNotificationHandlerReturn {
  const {
    showForegroundToast = true,
    onNotificationReceived,
    onNotificationTapped,
    autoInitialize = true,
    autoRegisterToken = true,
  } = options;

  // ========== Store ==========
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const userId = user?.uid;

  // ========== State ==========
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isTokenRegistered, setIsTokenRegistered] = useState(false);

  // ========== Refs ==========
  const isInitializingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * 포그라운드 알림 수신 핸들러
   *
   * @description FCM 수신 시 로컬 store에 알림 추가 (Firestore 실시간 리스너 대체)
   */
  const handleNotificationReceived = useCallback(
    (notification: NotificationPayload) => {
      logger.info('포그라운드 알림 수신', {
        title: notification.title,
        type: notification.data?.type,
      });

      // Analytics 이벤트
      trackEvent('notification_received', {
        notification_type: (notification.data?.type as string) ?? 'unknown',
        app_state: 'foreground',
      });

      // 🆕 FCM payload로부터 로컬 store에 알림 추가 (Firestore 실시간 리스너 대체)
      const notificationId = notification.data?.notificationId as string | undefined;
      if (notificationId) {
        const notificationData: NotificationData = {
          id: notificationId,
          recipientId: userId || '',
          type: ((notification.data?.type as string) || 'announcement') as NotificationType,
          title: notification.title || '',
          body: notification.body || '',
          link: notification.data?.link as string | undefined,
          data: notification.data as Record<string, string> | undefined,
          isRead: false,
          createdAt: Timestamp.now(),
        };

        // Zustand store에 알림 추가 (incrementUnreadCounts 자동 호출됨)
        useNotificationStore.getState().addNotification(notificationData);

        // React Query 캐시 무효화 (Store ↔ Query 동기화)
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

        logger.info('FCM 알림을 로컬 store에 추가', { notificationId });
      }

      // 커스텀 콜백
      onNotificationReceived?.(notification);

      // 토스트 표시 (선택적)
      if (showForegroundToast && notification.title) {
        addToast({
          type: 'info',
          message: notification.body || notification.title,
          duration: 5000,
        });
      }
    },
    [showForegroundToast, addToast, onNotificationReceived, userId]
  );

  /**
   * 알림 터치 응답 핸들러
   */
  const handleNotificationResponse = useCallback(
    async (notification: NotificationPayload, actionIdentifier: string) => {
      logger.info('알림 터치', {
        title: notification.title,
        actionIdentifier,
        type: notification.data?.type,
      });

      // Analytics 이벤트
      const notificationType = (notification.data?.type as NotificationType) ?? 'announcement';
      trackEvent('notification_tapped', {
        notification_type: notificationType,
        action: actionIdentifier,
      });

      // 커스텀 콜백
      onNotificationTapped?.(notification);

      // 알림 데이터에서 네비게이션 정보 추출
      const data = notification.data as Record<string, string> | undefined;
      const link = data?.link;

      // 콜드 스타트 시 네비게이션 준비 대기
      await waitForNavigationReadyAsync();

      // 딥링크 네비게이션
      const success = await navigateFromNotification(notificationType, data, link);

      if (!success) {
        logger.warn('알림 네비게이션 실패', { type: notificationType });
      }
    },
    [onNotificationTapped]
  );

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 초기화
   */
  const initialize = useCallback(async () => {
    if (isInitializingRef.current || isInitialized) return;
    if (Platform.OS === 'web') return;

    isInitializingRef.current = true;

    try {
      // 푸시 알림 서비스 초기화
      await pushNotificationService.initialize();

      // 알림 핸들러 등록
      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);

      // 권한 상태 확인
      let permission = await pushNotificationService.checkPermission();

      // 권한이 미결정 상태이면 자동으로 권한 요청
      if (permission.status === 'undetermined' && permission.canAskAgain) {
        permission = await pushNotificationService.requestPermission();
      }

      setPermissionStatus(permission.status);

      setIsInitialized(true);
      logger.info('알림 핸들러 초기화 완료', { permissionStatus: permission.status });
    } catch (error) {
      logger.error('알림 핸들러 초기화 실패', toError(error));
    } finally {
      isInitializingRef.current = false;
    }
  }, [isInitialized, handleNotificationReceived, handleNotificationResponse]);

  /**
   * 권한 요청
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    setIsRequestingPermission(true);

    try {
      const result = await pushNotificationService.requestPermission();
      setPermissionStatus(result.status);

      if (result.granted) {
        trackEvent('notification_permission_granted');
      } else {
        trackEvent('notification_permission_denied', {
          can_ask_again: result.canAskAgain,
        });
      }

      return result.granted;
    } catch (error) {
      logger.error('권한 요청 실패', toError(error));
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  /**
   * 토큰 등록
   */
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

  /**
   * 토큰 해제
   */
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

  /**
   * 뱃지 설정
   */
  const setBadge = useCallback(async (count: number): Promise<void> => {
    if (Platform.OS === 'web') return;
    await pushNotificationService.setBadge(count);
  }, []);

  /**
   * 뱃지 초기화
   */
  const clearBadge = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    await pushNotificationService.clearBadge();
  }, []);

  /**
   * 설정 앱 열기 (권한 거부 시)
   */
  const openSettings = useCallback(async (): Promise<void> => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
      trackEvent('notification_settings_opened');
    } catch (error) {
      logger.error('설정 앱 열기 실패', toError(error));
    }
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * 자동 초기화
   */
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);

  /**
   * 핸들러 참조 갱신 (userId, 콜백 변경 시)
   */
  useEffect(() => {
    if (isInitialized) {
      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);
    }
  }, [isInitialized, handleNotificationReceived, handleNotificationResponse]);

  /**
   * 로그인 시 토큰 자동 등록
   */
  useEffect(() => {
    if (autoRegisterToken && isInitialized && userId && permissionStatus === 'granted') {
      registerToken();
    }
  }, [autoRegisterToken, isInitialized, userId, permissionStatus, registerToken]);

  /**
   * 토큰 갱신 서비스 (Exponential Backoff 기반)
   *
   * - 12시간마다 정기 갱신
   * - 실패 시 Exponential Backoff 재시도 (30초 → 30분 max)
   * - 네트워크/앱 상태 연동
   */
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

  /**
   * 로그아웃 시 토큰 상태 초기화
   */
  useEffect(() => {
    if (!userId && isTokenRegistered) {
      setIsTokenRegistered(false);
    }
  }, [userId, isTokenRegistered]);

  /**
   * 앱 상태 변경 시 처리
   * - 포그라운드 복귀: 뱃지 초기화 + 권한 상태 재확인 + 토큰 갱신 확인 + 🆕 카운터 동기화
   */
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // 앱이 포그라운드로 돌아올 때
        clearBadge();

        // 권한 상태 재확인 (설정 앱에서 변경했을 수 있음)
        const permission = await pushNotificationService.checkPermission();
        setPermissionStatus(permission.status);

        // 권한이 새로 부여되었으면 토큰 등록
        if (permission.granted && !isTokenRegistered && userId) {
          registerToken();
        } else if (permission.granted && isTokenRegistered) {
          // 포그라운드 복귀 시 토큰 갱신 필요 여부 확인
          if (tokenRefreshService.shouldRefreshOnForeground()) {
            logger.info('포그라운드 복귀 시 토큰 갱신 트리거');
            tokenRefreshService.triggerRefresh();
          }
        }

        // 포그라운드 복귀 시 카운터 동기화: 실시간 구독(onSnapshot)이 자동 처리
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [clearBadge, isTokenRegistered, userId, registerToken]);

  // 딥링크 리스너는 useDeepLinkSetup (MainNavigator)에서 처리
  // useNotificationHandler에서 직접 설정하면 인증 체크가 우회되어 무한 루프 발생

  /**
   * 실시간 미읽음 카운터 구독
   * @description 기존 subscribeToUnreadCount (onSnapshot)를 글로벌 스토어에 연결
   */
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToUnreadCount(
      userId,
      (count) => {
        useNotificationStore.getState().setUnreadCount(count);
      },
      (error) => {
        logger.warn('실시간 미읽음 카운터 구독 에러 - 폴백', { error: error.message });
        syncUnreadCounterFromServer(userId, true);
      }
    );

    return unsubscribe;
  }, [userId]);

  /**
   * 클린업
   */
  useEffect(() => {
    return () => {
      pushNotificationService.setNotificationReceivedHandler(null);
      pushNotificationService.setNotificationResponseHandler(null);
    };
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // 상태
    isInitialized,
    permissionStatus,
    isRequestingPermission,
    isTokenRegistered,

    // 액션
    requestPermission,
    registerToken,
    unregisterToken,
    setBadge,
    clearBadge,
    openSettings,
  };
}

export default useNotificationHandler;
