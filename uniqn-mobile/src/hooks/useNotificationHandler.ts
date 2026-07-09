/**
 * UNIQN Mobile - notification handler composition hook
 *
 * Combines setup, token lifecycle, and foreground sync into one interface.
 */

import {
  usePushNotificationSetup,
  type UsePushNotificationSetupOptions,
} from './usePushNotificationSetup';
import { useFCMTokenManager } from './useFCMTokenManager';
import { useNotificationSyncOnForeground } from './useNotificationSyncOnForeground';

export interface UseNotificationHandlerOptions extends UsePushNotificationSetupOptions {
  /** 통합 알림 핸들러 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 로그인 후 토큰 자동 등록 여부 (기본: true) */
  autoRegisterToken?: boolean;
}

export interface UseNotificationHandlerReturn {
  isInitialized: boolean;
  permissionStatus: 'granted' | 'denied' | 'undetermined' | null;
  isRequestingPermission: boolean;
  isTokenRegistered: boolean;
  requestPermission: () => Promise<boolean>;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
  setBadge: (count: number) => Promise<void>;
  clearBadge: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useNotificationHandler(
  options: UseNotificationHandlerOptions = {}
): UseNotificationHandlerReturn {
  const { enabled = true, autoRegisterToken = true, ...setupOptions } = options;

  const setup = usePushNotificationSetup({
    ...setupOptions,
    autoInitialize: enabled && (setupOptions.autoInitialize ?? true),
  });

  const token = useFCMTokenManager({
    userId: setup.userId,
    isInitialized: setup.isInitialized,
    permissionStatus: setup.permissionStatus,
    autoRegisterToken: enabled && autoRegisterToken,
  });

  useNotificationSyncOnForeground({
    enabled,
    userId: setup.userId,
    isAuthenticated: setup.isAuthenticated,
    permissionStatus: setup.permissionStatus,
    isTokenRegistered: token.isTokenRegistered,
    clearBadge: token.clearBadge,
    registerToken: token.registerToken,
    refreshPermissionStatus: setup.refreshPermissionStatus,
  });

  return {
    isInitialized: setup.isInitialized,
    permissionStatus: setup.permissionStatus,
    isRequestingPermission: setup.isRequestingPermission,
    isTokenRegistered: token.isTokenRegistered,
    requestPermission: setup.requestPermission,
    registerToken: token.registerToken,
    unregisterToken: token.unregisterToken,
    setBadge: token.setBadge,
    clearBadge: token.clearBadge,
    openSettings: setup.openSettings,
  };
}
