/**
 * UNIQN Mobile - 푸시 알림 초기화 & 권한 훅
 *
 * @description 알림 서비스 초기화, 권한 요청, 포그라운드 핸들러 등록
 * @version 1.0.0
 *
 * useNotificationHandler에서 분리:
 * - Effect 1: 자동 초기화
 * - Effect 2: 핸들러 참조 갱신
 * - Effect 9: 클린업
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  pushNotificationService,
  type NotificationPayload,
} from '@/services/pushNotificationService';
import { createNotificationFromFCM } from '@/services/notificationService';
import { navigateFromNotification, waitForNavigationReadyAsync } from '@/services/deepLinkService';
import { trackEvent } from '@/services/analyticsService';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { queryClient, queryKeys } from '@/lib/queryClient';
import type { NotificationType } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export interface UsePushNotificationSetupOptions {
  /** 포그라운드 알림 수신 시 토스트 표시 여부 (기본: true) */
  showForegroundToast?: boolean;
  /** 알림 수신 콜백 */
  onNotificationReceived?: (notification: NotificationPayload) => void;
  /** 알림 터치 콜백 (네비게이션 전) */
  onNotificationTapped?: (notification: NotificationPayload) => void;
  /** 자동 초기화 여부 (기본: true) */
  autoInitialize?: boolean;
}

export interface UsePushNotificationSetupReturn {
  /** 초기화 완료 여부 */
  isInitialized: boolean;
  /** 권한 상태 */
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  /** 권한 요청 중 */
  isRequestingPermission: boolean;
  /** 권한 요청 */
  requestPermission: () => Promise<boolean>;
  /** 설정 앱 열기 (권한 거부 시) */
  openSettings: () => Promise<void>;
  /** 내부 사용: 인증 상태 */
  userId: string | undefined;
  /** 내부 사용: 인증 여부 */
  isAuthenticated: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function usePushNotificationSetup(
  options: UsePushNotificationSetupOptions = {}
): UsePushNotificationSetupReturn {
  const {
    showForegroundToast = true,
    onNotificationReceived,
    onNotificationTapped,
    autoInitialize = true,
  } = options;

  // Store
  const { user, status } = useAuthStore();
  const { addToast } = useToastStore();
  const userId = user?.uid;
  const isAuthenticated = status === 'authenticated';

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined' | null
  >(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Refs
  const isInitializingRef = useRef(false);

  // W4: useRef로 핸들러 참조 안정화 (initialize 의존성에서 제외)
  const handlersRef = useRef({
    showForegroundToast,
    addToast,
    onNotificationReceived,
    onNotificationTapped,
    userId,
  });

  // 최신 값으로 ref 갱신 (매 렌더마다)
  handlersRef.current = {
    showForegroundToast,
    addToast,
    onNotificationReceived,
    onNotificationTapped,
    userId,
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * 포그라운드 알림 수신 핸들러
   */
  const handleNotificationReceived = useCallback((notification: NotificationPayload) => {
    const {
      showForegroundToast: show,
      addToast: toast,
      onNotificationReceived: onReceived,
      userId: uid,
    } = handlersRef.current;

    logger.info('포그라운드 알림 수신', {
      title: notification.title,
      type: notification.data?.type,
    });

    trackEvent('notification_received', {
      notification_type: (notification.data?.type as string) ?? 'unknown',
      app_state: 'foreground',
    });

    // Service 레이어를 통해 FCM payload → NotificationData 변환
    const notificationData = createNotificationFromFCM(notification, uid || '');
    if (notificationData) {
      useNotificationStore.getState().addNotification(notificationData);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      logger.info('FCM 알림을 로컬 store에 추가', { notificationId: notificationData.id });
    }

    onReceived?.(notification);

    if (show && notification.title) {
      toast({
        type: 'info',
        message: notification.body || notification.title,
        duration: 5000,
      });
    }
  }, []);

  /**
   * 알림 터치 응답 핸들러
   */
  const handleNotificationResponse = useCallback(
    async (notification: NotificationPayload, actionIdentifier: string) => {
      const { onNotificationTapped: onTapped } = handlersRef.current;

      logger.info('알림 터치', {
        title: notification.title,
        actionIdentifier,
        type: notification.data?.type,
      });

      const notificationType = (notification.data?.type as NotificationType) ?? 'announcement';
      trackEvent('notification_tapped', {
        notification_type: notificationType,
        action: actionIdentifier,
      });

      onTapped?.(notification);

      const data = notification.data as Record<string, string> | undefined;
      const link = data?.link;

      await waitForNavigationReadyAsync();
      const success = await navigateFromNotification(notificationType, data, link);

      if (!success) {
        logger.warn('알림 네비게이션 실패', { type: notificationType });
      }
    },
    []
  );

  // ============================================================================
  // Actions
  // ============================================================================

  const initialize = useCallback(async () => {
    if (isInitializingRef.current || isInitialized) return;
    if (Platform.OS === 'web') return;

    isInitializingRef.current = true;

    try {
      await pushNotificationService.initialize();

      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);

      let permission = await pushNotificationService.checkPermission();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 핸들러는 useRef 기반 stable 참조
  }, [isInitialized]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    setIsRequestingPermission(true);
    try {
      const result = await pushNotificationService.requestPermission();
      setPermissionStatus(result.status);

      if (result.granted) {
        trackEvent('notification_permission_granted');
      } else {
        trackEvent('notification_permission_denied', { can_ask_again: result.canAskAgain });
      }

      return result.granted;
    } catch (error) {
      logger.error('권한 요청 실패', toError(error));
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

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

  // Effect 1: 자동 초기화
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);

  // Effect 2: 핸들러 참조 갱신 (핸들러는 useRef 기반이므로 stable)
  useEffect(() => {
    if (isInitialized) {
      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);
    }
  }, [isInitialized, handleNotificationReceived, handleNotificationResponse]); // stable refs

  // Effect 9: 클린업
  useEffect(() => {
    return () => {
      pushNotificationService.setNotificationReceivedHandler(null);
      pushNotificationService.setNotificationResponseHandler(null);
    };
  }, []);

  return {
    isInitialized,
    permissionStatus,
    isRequestingPermission,
    requestPermission,
    openSettings,
    userId,
    isAuthenticated,
  };
}
