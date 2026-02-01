/**
 * UNIQN Mobile - 온보딩 상태 관리 훅
 *
 * @description 온보딩 완료 여부를 MMKV에 저장하고 관리
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react';
import storage from '@/lib/mmkvStorage';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  NOTIFICATION_ONBOARDING_COMPLETED: 'onboarding:notification_permission',
  ONBOARDING_VERSION: 'onboarding:version',
} as const;

/** 현재 온보딩 버전 (온보딩 플로우 변경 시 증가) */
const CURRENT_ONBOARDING_VERSION = 1;

// ============================================================================
// Utils
// ============================================================================

/**
 * UID를 해싱하여 스토리지 키에 사용
 * 보안상 원본 UID를 로컬 스토리지에 노출하지 않기 위함
 */
function hashUID(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Types
// ============================================================================

export interface UseOnboardingReturn {
  /** 알림 권한 온보딩 필요 여부 */
  needsNotificationOnboarding: boolean;
  /** 알림 권한 온보딩 완료 처리 */
  completeNotificationOnboarding: () => void;
  /** 온보딩 상태 초기화 (테스트용) */
  resetOnboarding: () => void;
  /** 로딩 중 */
  isLoading: boolean;
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
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [needsNotificationOnboarding, setNeedsNotificationOnboarding] =
    useState(false);

  // 온보딩 상태 확인
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setNeedsNotificationOnboarding(false);
      setIsLoading(false);
      return;
    }

    const checkOnboardingStatus = () => {
      try {
        const mmkv = storage.getMMKVInstance();

        // 사용자별 키 생성 (UID 해싱으로 보안 강화)
        const userHash = hashUID(user.uid);
        const userKey = `${STORAGE_KEYS.NOTIFICATION_ONBOARDING_COMPLETED}:${userHash}`;
        const versionKey = `${STORAGE_KEYS.ONBOARDING_VERSION}:${userHash}`;

        // 온보딩 완료 여부 확인
        const completedStr = mmkv.getString(userKey);
        const versionStr = mmkv.getString(versionKey);

        const isCompleted = completedStr === 'true';
        const savedVersion = versionStr ? parseInt(versionStr, 10) : 0;

        // 버전이 변경되었거나 완료하지 않은 경우 온보딩 필요
        const needsOnboarding =
          !isCompleted || savedVersion < CURRENT_ONBOARDING_VERSION;

        setNeedsNotificationOnboarding(needsOnboarding);

        logger.debug('온보딩 상태 확인', {
          userHash,
          isCompleted,
          savedVersion,
          currentVersion: CURRENT_ONBOARDING_VERSION,
          needsOnboarding,
        });
      } catch (error) {
        logger.error('온보딩 상태 확인 실패', error as Error);
        // 에러 시 온보딩 표시하지 않음 (사용자 경험 우선)
        setNeedsNotificationOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [isAuthenticated, user?.uid]);

  // 알림 권한 온보딩 완료 처리
  const completeNotificationOnboarding = useCallback(() => {
    if (!user?.uid) return;

    try {
      const mmkv = storage.getMMKVInstance();

      // 사용자별 키 생성 (UID 해싱으로 보안 강화)
      const userHash = hashUID(user.uid);
      const userKey = `${STORAGE_KEYS.NOTIFICATION_ONBOARDING_COMPLETED}:${userHash}`;
      const versionKey = `${STORAGE_KEYS.ONBOARDING_VERSION}:${userHash}`;

      mmkv.set(userKey, 'true');
      mmkv.set(versionKey, String(CURRENT_ONBOARDING_VERSION));

      setNeedsNotificationOnboarding(false);

      logger.info('알림 권한 온보딩 완료', { userHash });
    } catch (error) {
      logger.error('온보딩 완료 저장 실패', error as Error);
    }
  }, [user?.uid]);

  // 온보딩 초기화 (테스트/디버깅용)
  const resetOnboarding = useCallback(() => {
    if (!user?.uid) return;

    try {
      const mmkv = storage.getMMKVInstance();

      // 사용자별 키 생성 (UID 해싱으로 보안 강화)
      const userHash = hashUID(user.uid);
      const userKey = `${STORAGE_KEYS.NOTIFICATION_ONBOARDING_COMPLETED}:${userHash}`;
      const versionKey = `${STORAGE_KEYS.ONBOARDING_VERSION}:${userHash}`;

      mmkv.delete(userKey);
      mmkv.delete(versionKey);

      setNeedsNotificationOnboarding(true);

      logger.info('온보딩 상태 초기화', { userHash });
    } catch (error) {
      logger.error('온보딩 초기화 실패', error as Error);
    }
  }, [user?.uid]);

  return {
    needsNotificationOnboarding,
    completeNotificationOnboarding,
    resetOnboarding,
    isLoading,
  };
}

export default useOnboarding;
