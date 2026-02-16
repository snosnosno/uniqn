/**
 * UNIQN Mobile - 통합 알림 핸들러 훅 (합성 래퍼)
 *
 * @description 3개 분리된 훅을 합성하여 기존 인터페이스 유지
 * @version 3.0.0
 *
 * @changelog
 * - v3.0.0: 단일 모놀리식 훅 → 3개 훅 합성 구조로 리팩토링
 *   - usePushNotificationSetup: 초기화 + 권한 + 포그라운드 핸들러
 *   - useFCMTokenManager: 토큰 라이프사이클 (등록/해제/갱신)
 *   - useNotificationSyncOnForeground: 포그라운드 동기화 + 카운터 구독
 */

import {
  usePushNotificationSetup,
  type UsePushNotificationSetupOptions,
} from './usePushNotificationSetup';
import { useFCMTokenManager } from './useFCMTokenManager';
import { useNotificationSyncOnForeground } from './useNotificationSyncOnForeground';

// 하위호환 re-export (C3: Store 업데이트 포함 래퍼)
import { syncUnreadCounterFromServer as _syncFromService } from '@/services/notificationService';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * 서버에서 미읽음 카운터 동기화 + Store 업데이트
 *
 * @description Service의 syncUnreadCounterFromServer는 값만 반환하므로,
 * 이 래퍼에서 Store.setUnreadCount()를 호출하여 하위호환 유지.
 * @deprecated notifications.tsx에서 직접 사용 중. 향후 훅 내부로 통합 예정.
 */
export async function syncUnreadCounterFromServer(
  userId: string,
  forceSync: boolean = false
): Promise<void> {
  const serverCount = await _syncFromService(userId, forceSync);
  if (serverCount !== null) {
    useNotificationStore.getState().setUnreadCount(serverCount);
  }
}

/** @deprecated clearCounterSyncCache는 shared/cache에서 직접 import하세요 */
export { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';

// ============================================================================
// Types
// ============================================================================

export interface UseNotificationHandlerOptions extends UsePushNotificationSetupOptions {
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
 * 통합 알림 핸들러 훅 (합성 패턴)
 *
 * @description 3개 서브 훅을 합성하여 기존 인터페이스를 유지합니다.
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
  const { autoRegisterToken = true, ...setupOptions } = options;

  // 1. 초기화 + 권한 + 포그라운드 핸들러
  const setup = usePushNotificationSetup(setupOptions);

  // 2. 토큰 라이프사이클
  const token = useFCMTokenManager({
    userId: setup.userId,
    isInitialized: setup.isInitialized,
    permissionStatus: setup.permissionStatus,
    autoRegisterToken,
  });

  // 3. 포그라운드 동기화 + 카운터 구독
  useNotificationSyncOnForeground({
    userId: setup.userId,
    isAuthenticated: setup.isAuthenticated,
    isTokenRegistered: token.isTokenRegistered,
    clearBadge: token.clearBadge,
    registerToken: token.registerToken,
  });

  return {
    // 상태
    isInitialized: setup.isInitialized,
    permissionStatus: setup.permissionStatus,
    isRequestingPermission: setup.isRequestingPermission,
    isTokenRegistered: token.isTokenRegistered,

    // 액션
    requestPermission: setup.requestPermission,
    registerToken: token.registerToken,
    unregisterToken: token.unregisterToken,
    setBadge: token.setBadge,
    clearBadge: token.clearBadge,
    openSettings: setup.openSettings,
  };
}

export default useNotificationHandler;
