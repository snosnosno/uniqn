/**
 * UNIQN Mobile - useAutoLogin Hook
 *
 * @description 자동 로그인 설정 관리 훅
 * @version 1.0.0
 *
 * 동작 방식:
 * - 자동 로그인 ON (기본): 앱 시작 시 Firebase Auth 복원 후 자동 로그인
 * - 자동 로그인 OFF: 앱 시작 시 로그인 화면으로 이동 (Firebase Auth 상태는 유지)
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsStorage } from '@/lib/secureStorage';
import { logger } from '@/utils/logger';

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
      logger.error('자동 로그인 설정 로드 실패', error as Error);
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
      await settingsStorage.setAutoLoginEnabled(enabled);
      setAutoLoginEnabledState(enabled);
      logger.info('자동 로그인 설정 변경 완료', { enabled });
    } catch (error) {
      logger.error('자동 로그인 설정 변경 실패', error as Error);
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
    logger.error('자동 로그인 설정 조회 실패', error as Error);
    return true; // 기본값: 자동 로그인 활성화
  }
}

export default useAutoLogin;
