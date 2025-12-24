/**
 * UNIQN Mobile - Push Notifications Hook
 *
 * @description 푸시 알림 관리 훅
 * @version 1.0.0
 *
 * 주요 기능:
 * - 푸시 알림 초기화 및 권한 관리
 * - FCM 토큰 자동 등록
 * - 알림 수신 및 응답 핸들링
 * - 딥링크 네비게이션
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import {
  pushNotificationService,
  type NotificationPayload,
} from '@/services/pushNotificationService';
import { navigateFromNotification } from '@/services/deepLinkService';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UsePushNotificationsOptions {
  /** 자동 초기화 여부 */
  autoInitialize?: boolean;
  /** 로그인 시 토큰 자동 등록 여부 */
  autoRegisterToken?: boolean;
  /** 알림 수신 시 콜백 */
  onNotificationReceived?: (notification: NotificationPayload) => void;
  /** 알림 터치 시 콜백 */
  onNotificationResponse?: (notification: NotificationPayload) => void;
}

export interface UsePushNotificationsReturn {
  /** 초기화 완료 여부 */
  isInitialized: boolean;
  /** 권한 상태 */
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  /** 권한 요청 중 */
  isRequestingPermission: boolean;
  /** 토큰 등록 완료 여부 */
  isTokenRegistered: boolean;
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
}

// ============================================================================
// Hook
// ============================================================================

/**
 * usePushNotifications
 *
 * @description 푸시 알림 관리를 위한 훅
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     isInitialized,
 *     permissionStatus,
 *     requestPermission,
 *   } = usePushNotifications({
 *     autoInitialize: true,
 *     autoRegisterToken: true,
 *     onNotificationReceived: (notification) => {
 *       console.log('Received:', notification);
 *     },
 *   });
 *
 *   if (permissionStatus === 'undetermined') {
 *     return <PermissionRequestScreen onRequest={requestPermission} />;
 *   }
 *
 *   return <App />;
 * }
 * ```
 */
export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const {
    autoInitialize = true,
    autoRegisterToken = true,
    onNotificationReceived,
    onNotificationResponse,
  } = options;

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isTokenRegistered, setIsTokenRegistered] = useState(false);

  // Auth state
  const user = useAuthStore((state) => state.user);
  const userId = user?.uid;

  // Refs
  const isInitializingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * 알림 수신 핸들러
   */
  const handleNotificationReceived = useCallback(
    (notification: NotificationPayload) => {
      logger.info('푸시 알림 수신', { title: notification.title });

      // 커스텀 핸들러 호출
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    },
    [onNotificationReceived]
  );

  /**
   * 알림 응답 핸들러 (사용자가 알림 터치)
   */
  const handleNotificationResponse = useCallback(
    async (notification: NotificationPayload, actionIdentifier: string) => {
      logger.info('푸시 알림 응답', { title: notification.title, action: actionIdentifier });

      // 커스텀 핸들러가 있으면 우선 호출
      if (onNotificationResponse) {
        onNotificationResponse(notification);
        return;
      }

      // 기본 동작: 딥링크 네비게이션
      if (notification.data) {
        try {
          const data = notification.data as Record<string, string>;
          const type = data.type as import('@/types/notification').NotificationType | undefined;
          const link = data.link;

          if (type) {
            const handled = await navigateFromNotification(type, data, link);
            if (!handled) {
              // 딥링크가 없으면 알림 탭으로 이동
              router.push('/(app)/(tabs)/notifications');
            }
          } else {
            router.push('/(app)/(tabs)/notifications');
          }
        } catch (error) {
          logger.error('알림 네비게이션 실패', error as Error);
          router.push('/(app)/(tabs)/notifications');
        }
      }
    },
    [onNotificationResponse]
  );

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 초기화
   */
  const initialize = useCallback(async () => {
    if (isInitializingRef.current || isInitialized) return;
    isInitializingRef.current = true;

    try {
      // 서비스 초기화
      await pushNotificationService.initialize();

      // 핸들러 설정
      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);

      // 권한 상태 확인
      const permission = await pushNotificationService.checkPermission();
      setPermissionStatus(permission.status);

      setIsInitialized(true);
      logger.info('푸시 알림 훅 초기화 완료');
    } catch (error) {
      logger.error('푸시 알림 초기화 실패', error as Error);
    } finally {
      isInitializingRef.current = false;
    }
  }, [isInitialized, handleNotificationReceived, handleNotificationResponse]);

  /**
   * 권한 요청
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsRequestingPermission(true);

    try {
      const result = await pushNotificationService.requestPermission();
      setPermissionStatus(result.status);
      return result.granted;
    } catch (error) {
      logger.error('권한 요청 실패', error as Error);
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

    try {
      const success = await pushNotificationService.registerToken(userId);
      setIsTokenRegistered(success);
      return success;
    } catch (error) {
      logger.error('토큰 등록 실패', error as Error);
      return false;
    }
  }, [userId]);

  /**
   * 토큰 해제
   */
  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return true;
    }

    try {
      const success = await pushNotificationService.unregisterToken(userId);
      setIsTokenRegistered(false);
      return success;
    } catch (error) {
      logger.error('토큰 해제 실패', error as Error);
      return false;
    }
  }, [userId]);

  /**
   * 뱃지 설정
   */
  const setBadge = useCallback(async (count: number): Promise<void> => {
    await pushNotificationService.setBadge(count);
  }, []);

  /**
   * 뱃지 초기화
   */
  const clearBadge = useCallback(async (): Promise<void> => {
    await pushNotificationService.clearBadge();
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
   * 로그인 시 토큰 자동 등록
   */
  useEffect(() => {
    if (autoRegisterToken && isInitialized && userId && permissionStatus === 'granted') {
      registerToken();
    }
  }, [autoRegisterToken, isInitialized, userId, permissionStatus, registerToken]);

  /**
   * 로그아웃 시 토큰 해제
   */
  useEffect(() => {
    if (!userId && isTokenRegistered) {
      setIsTokenRegistered(false);
    }
  }, [userId, isTokenRegistered]);

  /**
   * 앱 상태 변경 시 뱃지 초기화
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // 앱이 포그라운드로 돌아올 때 뱃지 초기화
        clearBadge();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [clearBadge]);

  /**
   * 정리
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
    isInitialized,
    permissionStatus,
    isRequestingPermission,
    isTokenRegistered,
    requestPermission,
    registerToken,
    unregisterToken,
    setBadge,
    clearBadge,
  };
}

export default usePushNotifications;
