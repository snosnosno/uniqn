/**
 * UNIQN Mobile - 알림 핸들러 훅
 *
 * @description 푸시 알림 수신/터치 처리 + 딥링크 네비게이션
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  pushNotificationService,
  type NotificationPayload,
} from '@/services/pushNotificationService';
import {
  deepLinkService,
  navigateFromNotification,
} from '@/services/deepLinkService';
import { trackEvent } from '@/services/analyticsService';
import { logger } from '@/utils/logger';
import type { NotificationType } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

interface UseNotificationHandlerOptions {
  /** 포그라운드 알림 수신 시 토스트 표시 여부 (기본: true) */
  showForegroundToast?: boolean;
  /** 알림 수신 콜백 */
  onNotificationReceived?: (notification: NotificationPayload) => void;
  /** 알림 터치 콜백 (네비게이션 전) */
  onNotificationTapped?: (notification: NotificationPayload) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 알림 핸들러 훅
 *
 * @description MainNavigator에서 사용하여 푸시 알림과 딥링크 처리
 *
 * @example
 * function MainNavigator() {
 *   useNotificationHandler({
 *     showForegroundToast: true,
 *     onNotificationReceived: (n) => console.log('알림 수신:', n),
 *   });
 *
 *   return <Stack />;
 * }
 */
export function useNotificationHandler(options: UseNotificationHandlerOptions = {}) {
  const {
    showForegroundToast = true,
    onNotificationReceived,
    onNotificationTapped,
  } = options;

  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const isSetup = useRef(false);

  /**
   * 포그라운드 알림 수신 핸들러
   */
  const handleNotificationReceived = useCallback(
    (notification: NotificationPayload) => {
      logger.info('포그라운드 알림 수신', {
        title: notification.title,
        data: notification.data,
      });

      // Analytics 이벤트
      trackEvent('notification_received', {
        notification_type: (notification.data?.type as string) ?? 'unknown',
        app_state: 'foreground',
      });

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
    [showForegroundToast, addToast, onNotificationReceived]
  );

  /**
   * 알림 터치 응답 핸들러
   */
  const handleNotificationResponse = useCallback(
    async (notification: NotificationPayload, actionIdentifier: string) => {
      logger.info('알림 터치', {
        title: notification.title,
        actionIdentifier,
        data: notification.data,
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

      // 딥링크 네비게이션
      const success = await navigateFromNotification(notificationType, data, link);

      if (!success) {
        logger.warn('알림 네비게이션 실패', { type: notificationType });
      }
    },
    [onNotificationTapped]
  );

  /**
   * 푸시 알림 초기화 및 토큰 등록
   */
  useEffect(() => {
    if (isSetup.current) return;
    if (Platform.OS === 'web') return;

    const setup = async () => {
      try {
        // 푸시 알림 서비스 초기화
        await pushNotificationService.initialize();

        // 알림 핸들러 등록
        pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
        pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);

        isSetup.current = true;
        logger.info('알림 핸들러 설정 완료');
      } catch (error) {
        logger.error('알림 핸들러 설정 실패', error as Error);
      }
    };

    setup();

    return () => {
      // 클린업
      pushNotificationService.setNotificationReceivedHandler(null);
      pushNotificationService.setNotificationResponseHandler(null);
      isSetup.current = false;
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  /**
   * 사용자 로그인 시 토큰 등록
   */
  useEffect(() => {
    if (!user?.uid) return;
    if (Platform.OS === 'web') return;

    const registerToken = async () => {
      const permission = await pushNotificationService.checkPermission();

      if (!permission.granted) {
        // 권한이 없으면 요청
        const result = await pushNotificationService.requestPermission();
        if (!result.granted) {
          logger.info('푸시 알림 권한 거부');
          return;
        }
      }

      // 토큰 등록
      await pushNotificationService.registerToken(user.uid);
    };

    registerToken();
  }, [user?.uid]);

  /**
   * 딥링크 리스너 설정
   */
  useEffect(() => {
    const cleanup = deepLinkService.setupDeepLinkListener((url) => {
      logger.info('딥링크 수신', { url });
      trackEvent('deep_link_received', { url });
    });

    return cleanup;
  }, []);
}

export default useNotificationHandler;
