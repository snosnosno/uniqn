/**
 * UNIQN Mobile - onboarding state management
 */

import { useCompletionFlag } from '@/hooks/useCompletionFlag';

const STORAGE_KEYS = {
  NOTIFICATION_ONBOARDING_COMPLETED: 'onboarding:notification_permission',
  ONBOARDING_VERSION: 'onboarding:version',
} as const;

const CURRENT_ONBOARDING_VERSION = 1;

export interface UseOnboardingReturn {
  readonly needsNotificationOnboarding: boolean;
  readonly completeNotificationOnboarding: () => void;
  readonly resetOnboarding: () => void;
  readonly isLoading: boolean;
}

export function useOnboarding(): UseOnboardingReturn {
  const { needsAction, complete, reset, isLoading } = useCompletionFlag({
    completedKeyPrefix: STORAGE_KEYS.NOTIFICATION_ONBOARDING_COMPLETED,
    versionKeyPrefix: STORAGE_KEYS.ONBOARDING_VERSION,
    currentVersion: CURRENT_ONBOARDING_VERSION,
    label: 'notification onboarding',
  });

  return {
    needsNotificationOnboarding: needsAction,
    completeNotificationOnboarding: complete,
    resetOnboarding: reset,
    isLoading,
  };
}
