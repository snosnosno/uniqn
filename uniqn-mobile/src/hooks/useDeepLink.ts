/**
 * UNIQN Mobile - Deep Link Hook
 *
 * @description 딥링크 처리 및 알림 네비게이션 통합 훅
 * @version 1.0.0
 *
 * 사용법:
 * - app/_layout.tsx에서 useDeepLinkSetup() 호출
 * - 알림 클릭 시 useNotificationNavigation() 사용
 */

import { useEffect, useCallback, useRef, useState } from 'react';
// expo-router is used via deepLinkService
import {
  setupDeepLinkListener,
  navigateToDeepLink,
  navigateFromNotification,
  parseDeepLink,
  createDeepLink,
  createJobDeepLink,
  type DeepLinkRoute,
  type ParsedDeepLink,
} from '@/services/deepLinkService';
import { RouteMapper } from '@/shared/deeplink';
import { markAsRead } from '@/services/notificationService';
import { trackEvent } from '@/services/analyticsService';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { NotificationType, NotificationData } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

/** 딥링크 상태 (향후 전역 상태 관리 시 활용) */
// export for future use - suppresses unused warning
export interface DeepLinkState {
  /** 마지막으로 처리된 딥링크 URL */
  lastUrl: string | null;
  /** 마지막 파싱 결과 */
  lastParsed: ParsedDeepLink | null;
  /** 처리 중 여부 */
  isProcessing: boolean;
}

interface UseDeepLinkSetupOptions {
  /** 딥링크 수신 시 콜백 */
  onDeepLink?: (url: string, parsed: ParsedDeepLink) => void;
  /** 인증이 필요한 딥링크인데 미인증 상태일 때 콜백 */
  onAuthRequired?: (url: string) => void;
  /** 활성화 여부 */
  enabled?: boolean;
}

interface UseNotificationNavigationResult {
  /** 알림 클릭 처리 */
  handleNotificationPress: (notification: NotificationData) => Promise<void>;
  /** 처리 중 여부 */
  isNavigating: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 네비게이션 디바운스 딜레이 (ms) - 중복 클릭 방지 */
const NAVIGATION_DEBOUNCE_MS = 500;

// ============================================================================
// useDeepLinkSetup
// ============================================================================

/**
 * 딥링크 리스너 설정 훅
 *
 * @description 앱 최상위 레이아웃에서 한 번만 호출
 *
 * @example
 * ```tsx
 * // app/_layout.tsx
 * export default function RootLayout() {
 *   useDeepLinkSetup({
 *     onAuthRequired: (url) => {
 *       // 로그인 화면으로 리다이렉트, URL 저장
 *     },
 *   });
 *   return <Stack />;
 * }
 * ```
 */
export function useDeepLinkSetup(options: UseDeepLinkSetupOptions = {}): void {
  const { onDeepLink, onAuthRequired, enabled = true } = options;
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const pendingDeepLinkRef = useRef<string | null>(null);

  // 딥링크 처리
  const handleDeepLink = useCallback(
    (url: string) => {
      const parsed = parseDeepLink(url);

      logger.info('딥링크 처리', { url, isValid: parsed.isValid, route: parsed.route?.name });

      if (!parsed.isValid || !parsed.route) {
        logger.warn('유효하지 않은 딥링크', { url });
        return;
      }

      // 인증 필요 라우트 체크 (SSOT: RouteMapper 사용)
      const requiresAuth = RouteMapper.requiresAuth(parsed.route.name);

      if (requiresAuth && !user) {
        // 인증 필요한데 미인증 상태
        logger.info('인증 필요한 딥링크 - 로그인 후 처리', { url });
        pendingDeepLinkRef.current = url;
        onAuthRequired?.(url);
        return;
      }

      // 콜백 호출
      onDeepLink?.(url, parsed);

      // 네비게이션
      navigateToDeepLink(url);
    },
    [user, onDeepLink, onAuthRequired]
  );

  // 리스너 등록
  useEffect(() => {
    if (!enabled || !isInitialized) return;

    const cleanup = setupDeepLinkListener(handleDeepLink);

    return cleanup;
  }, [enabled, isInitialized, handleDeepLink]);

  // 인증 후 대기 중인 딥링크 처리
  useEffect(() => {
    if (user && pendingDeepLinkRef.current && isInitialized) {
      const pendingUrl = pendingDeepLinkRef.current;
      pendingDeepLinkRef.current = null;

      logger.info('인증 후 대기 딥링크 처리', { url: pendingUrl });
      navigateToDeepLink(pendingUrl);
    }
  }, [user, isInitialized]);
}

// ============================================================================
// useNotificationNavigation
// ============================================================================

/**
 * 알림 클릭 네비게이션 훅
 *
 * @description 알림 목록에서 알림 클릭 시 네비게이션 처리
 *
 * @example
 * ```tsx
 * function NotificationItem({ notification }) {
 *   const { handleNotificationPress, isNavigating } = useNotificationNavigation();
 *
 *   return (
 *     <Pressable
 *       onPress={() => handleNotificationPress(notification)}
 *       disabled={isNavigating}
 *     >
 *       ...
 *     </Pressable>
 *   );
 * }
 * ```
 */
export function useNotificationNavigation(): UseNotificationNavigationResult {
  // useRef: 콜백 내부에서 최신 상태 참조 (의존성 배열 비움으로 재생성 방지)
  // useState: UI 업데이트 트리거
  const isNavigatingRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNotificationPress = useCallback(async (notification: NotificationData) => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    setIsNavigating(true);

    try {
      // 읽지 않은 알림이면 읽음 처리
      if (!notification.isRead) {
        try {
          await markAsRead(notification.id);
        } catch {
          // 읽음 처리 실패해도 네비게이션은 진행
          logger.warn('알림 읽음 처리 실패', { notificationId: notification.id });
        }
      }

      // Analytics
      trackEvent('notification_click', {
        notification_type: notification.type,
        notification_id: notification.id,
      });

      // 네비게이션
      await navigateFromNotification(
        notification.type as NotificationType,
        notification.data,
        notification.link
      );
    } finally {
      // 딜레이 후 플래그 해제 (중복 클릭 방지)
      setTimeout(() => {
        isNavigatingRef.current = false;
        setIsNavigating(false);
      }, NAVIGATION_DEBOUNCE_MS);
    }
  }, []);

  return {
    handleNotificationPress,
    isNavigating,
  };
}

// ============================================================================
// useDeepLinkNavigation
// ============================================================================

/**
 * 프로그래매틱 딥링크 네비게이션 훅
 *
 * @description 코드에서 딥링크로 네비게이션 필요 시 사용
 *
 * @example
 * ```tsx
 * function ShareButton({ jobId }) {
 *   const { navigateToJob, createShareUrl } = useDeepLinkNavigation();
 *
 *   const handleShare = () => {
 *     Share.share({
 *       url: createShareUrl('job', jobId),
 *       title: '공고 공유하기',
 *     });
 *   };
 *
 *   return <Button onPress={handleShare}>공유</Button>;
 * }
 * ```
 */
export function useDeepLinkNavigation() {
  // 라우트로 네비게이션
  const navigate = useCallback((route: DeepLinkRoute) => {
    const url = createDeepLink(route);
    return navigateToDeepLink(url);
  }, []);

  // 공고로 네비게이션
  const navigateToJob = useCallback(
    (jobId: string) => {
      return navigate({ name: 'job', params: { id: jobId } });
    },
    [navigate]
  );

  // 지원서로 네비게이션 (v2.0: 지원 상세 화면 없음, 스케줄로 이동)
  const navigateToApplication = useCallback(
    (_applicationId: string) => {
      logger.warn('navigateToApplication: 지원 상세 화면 없음, 스케줄로 이동');
      return navigate({ name: 'schedule' });
    },
    [navigate]
  );

  // 스케줄로 네비게이션 (v2.0: date 파라미터 무시됨)
  const navigateToSchedule = useCallback(
    (_date?: string) => {
      return navigate({ name: 'schedule' });
    },
    [navigate]
  );

  // 알림 목록으로 네비게이션
  const navigateToNotifications = useCallback(() => {
    return navigate({ name: 'notifications' });
  }, [navigate]);

  /**
   * 공유용 URL 생성
   *
   * @param type - 공유 타입
   * @param id - 리소스 ID
   * @returns 공유용 웹 URL
   */
  const createShareUrl = useCallback((type: 'job', id?: string) => {
    switch (type) {
      case 'job':
        return id ? createJobDeepLink(id, true) : '';
      default:
        return '';
    }
  }, []);

  return {
    navigate,
    navigateToJob,
    navigateToApplication,
    navigateToSchedule,
    navigateToNotifications,
    createShareUrl,
    createDeepLink,
    parseDeepLink,
  };
}

// ============================================================================
// usePendingDeepLink
// ============================================================================

/**
 * 대기 중인 딥링크 처리 훅
 *
 * @description 로그인 화면에서 로그인 후 원래 딥링크로 리다이렉트 시 사용
 */
export function usePendingDeepLink() {
  const pendingUrlRef = useRef<string | null>(null);

  const setPendingUrl = useCallback((url: string) => {
    pendingUrlRef.current = url;
  }, []);

  const getPendingUrl = useCallback(() => {
    return pendingUrlRef.current;
  }, []);

  const clearPendingUrl = useCallback(() => {
    pendingUrlRef.current = null;
  }, []);

  const processPendingUrl = useCallback(async () => {
    const url = pendingUrlRef.current;
    if (!url) return false;

    pendingUrlRef.current = null;
    return navigateToDeepLink(url);
  }, []);

  return {
    setPendingUrl,
    getPendingUrl,
    clearPendingUrl,
    processPendingUrl,
    hasPendingUrl: !!pendingUrlRef.current,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  useDeepLinkSetup,
  useNotificationNavigation,
  useDeepLinkNavigation,
  usePendingDeepLink,
};
