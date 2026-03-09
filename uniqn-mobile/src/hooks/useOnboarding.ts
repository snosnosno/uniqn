/**
 * UNIQN Mobile - 온보딩 상태 관리 훅
 *
 * @description 온보딩 완료 여부를 MMKV에 저장하고 관리
 * @version 2.0.0
 */

import { useCompletionFlag } from '@/hooks/useCompletionFlag';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  NOTIFICATION_ONBOARDING_COMPLETED: 'onboarding:notification_permission',
  ONBOARDING_VERSION: 'onboarding:version',
} as const;

/** 현재 온보딩 버전 (온보딩 플로우 변경 시 증가) */
const CURRENT_ONBOARDING_VERSION = 1;

/** 온보딩 타임아웃 (ms) */
const ONBOARDING_TIMEOUT_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

export interface UseOnboardingReturn {
  /** 알림 권한 온보딩 필요 여부 */
  readonly needsNotificationOnboarding: boolean;
  /** 알림 권한 온보딩 완료 처리 */
  readonly completeNotificationOnboarding: () => void;
  /** 온보딩 상태 초기화 (테스트용) */
  readonly resetOnboarding: () => void;
  /** 로딩 중 */
  readonly isLoading: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 온보딩 상태 관리 훅
 *
 * @example
 * const { needsNotificationOnboarding, completeNotificationOnboarding } = useOnboarding();
 *
 * if (needsNotificationOnboarding) {
 *   return <NotificationPermissionScreen onComplete={completeNotificationOnboarding} />;
 * }
 */
export function useOnboarding(): UseOnboardingReturn {
  const { needsAction, complete, reset, isLoading } = useCompletionFlag({
    completedKeyPrefix: STORAGE_KEYS.NOTIFICATION_ONBOARDING_COMPLETED,
    versionKeyPrefix: STORAGE_KEYS.ONBOARDING_VERSION,
    currentVersion: CURRENT_ONBOARDING_VERSION,
    timeoutMs: ONBOARDING_TIMEOUT_MS,
    label: '온보딩(알림 권한)',
  });

  return {
    needsNotificationOnboarding: needsAction,
    completeNotificationOnboarding: complete,
    resetOnboarding: reset,
    isLoading,
  };
}

export default useOnboarding;
