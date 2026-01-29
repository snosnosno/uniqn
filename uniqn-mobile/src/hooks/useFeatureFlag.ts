/**
 * UNIQN Mobile - Feature Flag Hooks
 *
 * @description Feature Flag 상태 접근을 위한 React Hooks
 * @version 1.0.0
 *
 * 사용 예시:
 * ```tsx
 * const isSocialLoginEnabled = useFeatureFlag('enable_social_login');
 * const { isEnabled, isLoading, refresh } = useFeatureFlagWithStatus('enable_biometric');
 * const flags = useFeatureFlags(['enable_social_login', 'enable_biometric']);
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  featureFlagService,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@/services/featureFlagService';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// 기본 훅: 단일 Feature Flag 조회
// ============================================================================

/**
 * 단일 Feature Flag 값 조회
 *
 * @param key - Feature Flag 키
 * @returns Feature Flag 값 (boolean)
 *
 * @example
 * ```tsx
 * const isSocialLoginEnabled = useFeatureFlag('enable_social_login');
 *
 * if (isSocialLoginEnabled) {
 *   return <SocialLoginButtons />;
 * }
 * ```
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [value, setValue] = useState<boolean>(() => featureFlagService.getFlag(key));

  useEffect(() => {
    // 초기화 후 값 업데이트
    const initializeAndUpdate = async () => {
      await featureFlagService.initialize();
      setValue(featureFlagService.getFlag(key));
    };

    initializeAndUpdate();
  }, [key]);

  return value;
}

// ============================================================================
// 확장 훅: 상태 정보 포함
// ============================================================================

interface FeatureFlagStatus {
  /** Feature Flag 활성화 여부 */
  isEnabled: boolean;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 발생 여부 */
  hasError: boolean;
  /** 수동 새로고침 */
  refresh: () => Promise<void>;
}

/**
 * Feature Flag 값 + 상태 정보 조회
 *
 * @param key - Feature Flag 키
 * @returns Feature Flag 값과 상태 정보
 *
 * @example
 * ```tsx
 * const { isEnabled, isLoading, refresh } = useFeatureFlagWithStatus('enable_biometric');
 *
 * if (isLoading) {
 *   return <Loading />;
 * }
 * ```
 */
export function useFeatureFlagWithStatus(key: FeatureFlagKey): FeatureFlagStatus {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => featureFlagService.getFlag(key));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      featureFlagService.clearCache();
      await featureFlagService.fetchAndActivate();
      setIsEnabled(featureFlagService.getFlag(key));
    } catch (error) {
      logger.error('Failed to refresh feature flag', toError(error), { key });
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await featureFlagService.initialize();
        setIsEnabled(featureFlagService.getFlag(key));
      } catch (error) {
        logger.error('Failed to initialize feature flag', toError(error), { key });
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [key]);

  return { isEnabled, isLoading, hasError, refresh };
}

// ============================================================================
// 다중 Feature Flag 조회
// ============================================================================

/**
 * 여러 Feature Flag 한 번에 조회
 *
 * @param keys - Feature Flag 키 배열
 * @returns Feature Flag 값 객체
 *
 * @example
 * ```tsx
 * const flags = useFeatureFlags(['enable_social_login', 'enable_biometric']);
 *
 * if (flags.enable_social_login) {
 *   // ...
 * }
 * ```
 */
export function useFeatureFlags<K extends FeatureFlagKey>(
  keys: K[],
): Pick<FeatureFlags, K> {
  // 키 배열을 문자열로 안정화 (참조 변경에도 내용이 같으면 동일)
  const keysString = useMemo(() => keys.join(','), [keys]);

  const [flags, setFlags] = useState<Pick<FeatureFlags, K>>(() => {
    const result = {} as Pick<FeatureFlags, K>;
    keys.forEach((key) => {
      result[key] = featureFlagService.getFlag(key);
    });
    return result;
  });

  useEffect(() => {
    const initialize = async () => {
      await featureFlagService.initialize();
      const result = {} as Pick<FeatureFlags, K>;
      keys.forEach((key) => {
        result[key] = featureFlagService.getFlag(key);
      });
      setFlags(result);
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keysString이 keys의 내용을 대표
  }, [keysString]);

  return flags;
}

// ============================================================================
// 모든 Feature Flag 조회
// ============================================================================

/**
 * 모든 Feature Flag 조회 (주로 디버깅/관리자용)
 *
 * @returns 모든 Feature Flag 값
 */
export function useAllFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(() => featureFlagService.getAllFlags());

  useEffect(() => {
    const initialize = async () => {
      await featureFlagService.initialize();
      setFlags(featureFlagService.getAllFlags());
    };

    initialize();
  }, []);

  return flags;
}

// ============================================================================
// 점검 모드 확인 훅
// ============================================================================

/**
 * 점검 모드 확인 훅
 *
 * @returns 점검 모드 여부
 *
 * @example
 * ```tsx
 * const isMaintenanceMode = useMaintenanceMode();
 *
 * if (isMaintenanceMode) {
 *   return <MaintenanceScreen />;
 * }
 * ```
 */
export function useMaintenanceMode(): boolean {
  return useFeatureFlag('maintenance_mode');
}

// ============================================================================
// 조건부 렌더링 훅
// ============================================================================

interface ConditionalResult<T> {
  /** 조건이 충족되면 value, 아니면 null */
  result: T | null;
  /** 로딩 상태 */
  isLoading: boolean;
}

/**
 * Feature Flag에 따른 조건부 값 반환
 *
 * @param key - Feature Flag 키
 * @param value - 활성화 시 반환할 값
 * @returns 조건부 결과
 *
 * @example
 * ```tsx
 * const { result: socialButtons, isLoading } = useWhenEnabled(
 *   'enable_social_login',
 *   <SocialLoginButtons />
 * );
 *
 * return (
 *   <View>
 *     <LoginForm />
 *     {socialButtons}
 *   </View>
 * );
 * ```
 */
export function useWhenEnabled<T>(key: FeatureFlagKey, value: T): ConditionalResult<T> {
  const { isEnabled, isLoading } = useFeatureFlagWithStatus(key);

  const result = useMemo(() => {
    return isEnabled ? value : null;
  }, [isEnabled, value]);

  return { result, isLoading };
}

export default useFeatureFlag;
