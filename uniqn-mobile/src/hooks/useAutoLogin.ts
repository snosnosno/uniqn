/**
 * UNIQN Mobile - useAutoLogin Hook
 *
 * @description 자동 로그인 설정 관리 훅
 * @version 1.0.0
 *
 * 동작 방식:
 * - 자동 로그인 ON (기본): 앱 시작 시 Firebase Auth 복원 후 자동 로그인
 * - 자동 로그인 OFF: 다음 앱 시작 시 저장된 세션을 정리하고 로그인 화면에서 시작
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsStorage } from '@/lib/secureStorage';
import { setBiometricEnabled } from '@/services/auth';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface UseAutoLoginReturn {
  /** 자동 로그인 활성화 여부 */
  autoLoginEnabled: boolean;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 자동 로그인 설정 변경 */
  setAutoLoginEnabled: (enabled: boolean) => Promise<void>;
  /** 설정 새로고침 */
  refresh: () => Promise<void>;
}

export const AUTO_LOGIN_HELPER_TEXT = '끄면 다음 실행부터 다시 로그인해야 합니다.';

async function applyAutoLoginPreference(enabled: boolean): Promise<void> {
  const previousEnabled = await checkAutoLoginEnabled();
  let settingPersisted = false;

  try {
    await settingsStorage.setAutoLoginEnabled(enabled);
    settingPersisted = true;

    if (!enabled) {
      await setBiometricEnabled(false);
      logger.info('자동 로그인 해제로 생체 인증을 함께 비활성화했습니다');
    }

    logger.info('자동 로그인 설정 변경 완료', { enabled });
  } catch (error) {
    logger.error('자동 로그인 설정 변경 실패', toError(error));

    if (settingPersisted && previousEnabled !== enabled) {
      try {
        await settingsStorage.setAutoLoginEnabled(previousEnabled);
        logger.warn('자동 로그인 설정 변경을 이전 값으로 되돌렸습니다', {
          previousEnabled,
        });
      } catch (rollbackError) {
        logger.error('자동 로그인 설정 롤백 실패', toError(rollbackError));
      }
    }

    throw error;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 자동 로그인 설정 관리 훅
 *
 * @example
 * ```tsx
 * const { autoLoginEnabled, setAutoLoginEnabled, isLoading } = useAutoLogin();
 *
 * // 토글 스위치에 바인딩
 * <Switch
 *   value={autoLoginEnabled}
 *   onValueChange={setAutoLoginEnabled}
 *   disabled={isLoading}
 * />
 * ```
 */
export function useAutoLogin(): UseAutoLoginReturn {
  const [autoLoginEnabled, setAutoLoginEnabledState] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * 설정 로드
   */
  const loadSetting = useCallback(async () => {
    try {
      setIsLoading(true);
      const enabled = await settingsStorage.isAutoLoginEnabled();
      setAutoLoginEnabledState(enabled);
      logger.debug('자동 로그인 설정 로드', { enabled });
    } catch (error) {
      logger.error('자동 로그인 설정 로드 실패', toError(error));
      // 실패 시 기본값 true 유지
      setAutoLoginEnabledState(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 설정 변경
   */
  const setAutoLoginEnabled = useCallback(async (enabled: boolean) => {
    try {
      setIsLoading(true);
      await applyAutoLoginPreference(enabled);
      setAutoLoginEnabledState(enabled);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 새로고침
   */
  const refresh = useCallback(async () => {
    await loadSetting();
  }, [loadSetting]);

  // 초기 로드
  useEffect(() => {
    loadSetting();
  }, [loadSetting]);

  return {
    autoLoginEnabled,
    isLoading,
    setAutoLoginEnabled,
    refresh,
  };
}

/**
 * 자동 로그인 설정 직접 조회 (훅 외부에서 사용)
 * useAppInitialize에서 사용
 */
export async function checkAutoLoginEnabled(): Promise<boolean> {
  try {
    return await settingsStorage.isAutoLoginEnabled();
  } catch (error) {
    logger.error('자동 로그인 설정 조회 실패', toError(error));
    return true; // 기본값: 자동 로그인 활성화
  }
}
