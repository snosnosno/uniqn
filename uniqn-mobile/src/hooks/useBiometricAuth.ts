/**
 * UNIQN Mobile - useBiometricAuth Hook
 *
 * @description 생체 인증 상태 및 동작 관리 훅
 * @version 1.0.0
 *
 * 동작 방식:
 * 1. 설정에서 생체 인증 활성화 시 현재 Firebase 세션 정보 저장
 * 2. 로그인 화면에서 생체 인증 성공 시 저장된 세션으로 자동 로그인
 * 3. Firebase 세션이 만료된 경우 비밀번호 로그인 요청
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checkBiometricStatus,
  getBiometricTypeName,
  authenticateWithBiometric,
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,
  setBiometricEnabled,
  isBiometricEnabled,
  type BiometricStatus,
  type BiometricAuthResult,
} from '@/services/biometricService';
import { getFirebaseAuth } from '@/lib/firebase';
import { getUserProfile } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError, requireAuth } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface UseBiometricAuthReturn {
  /** 생체 인증 상태 */
  status: BiometricStatus | null;
  /** 생체 인증 활성화 여부 */
  isEnabled: boolean;
  /** 생체 인증 사용 가능 여부 (하드웨어 + 등록) */
  isAvailable: boolean;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 인증 중 상태 */
  isAuthenticating: boolean;
  /** 생체 인증 타입 이름 (Face ID, Touch ID 등) */
  biometricTypeName: string;
  /** 생체 인증 활성화/비활성화 */
  setEnabled: (enabled: boolean) => Promise<void>;
  /** 생체 인증 수행 */
  authenticate: (options?: { promptMessage?: string }) => Promise<BiometricAuthResult>;
  /** 생체 인증으로 로그인 시도 */
  loginWithBiometric: () => Promise<boolean>;
  /** 생체 인증 자격 증명 삭제 */
  clearCredentials: () => Promise<void>;
  /**
   * 생체 인증 자격 증명 갱신
   * 일반 로그인(이메일/소셜) 성공 후 호출하여 자격 증명을 최신 상태로 유지
   */
  updateCredentials: () => Promise<void>;
  /** 상태 새로고침 */
  refresh: () => Promise<void>;
}

// ============================================================================
// Query Keys
// ============================================================================

const biometricQueryKeys = {
  status: ['biometric', 'status'] as const,
  enabled: ['biometric', 'enabled'] as const,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * 생체 인증 훅
 *
 * @example
 * ```tsx
 * const {
 *   isEnabled,
 *   isAvailable,
 *   biometricTypeName,
 *   setEnabled,
 *   loginWithBiometric,
 * } = useBiometricAuth();
 *
 * // 설정에서 토글
 * <Switch
 *   value={isEnabled}
 *   onValueChange={setEnabled}
 *   disabled={!isAvailable}
 * />
 *
 * // 로그인 화면에서
 * {isEnabled && isAvailable && (
 *   <BiometricButton onPress={loginWithBiometric} />
 * )}
 * ```
 */
export function useBiometricAuth(): UseBiometricAuthReturn {
  const queryClient = useQueryClient();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // 생체 인증 상태 조회
  const {
    data: status,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: biometricQueryKeys.status,
    queryFn: checkBiometricStatus,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 생체 인증 활성화 상태 조회
  const {
    data: isEnabled,
    isLoading: isEnabledLoading,
    refetch: refetchEnabled,
  } = useQuery({
    queryKey: biometricQueryKeys.enabled,
    queryFn: isBiometricEnabled,
    staleTime: 0, // 항상 fresh
  });

  // 생체 인증 활성화 mutation
  const enableMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        // 현재 로그인된 사용자 확인
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        requireAuth(currentUser?.uid, 'useBiometricAuth.enableBiometric');

        // Refresh Token 가져오기
        const refreshToken = currentUser.refreshToken;
        if (!refreshToken) {
          throw new Error('인증 토큰을 가져올 수 없습니다');
        }

        // 자격 증명 저장
        await saveBiometricCredentials(currentUser.uid, refreshToken);
      }

      await setBiometricEnabled(enabled);
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: biometricQueryKeys.enabled });
      useToastStore
        .getState()
        .success(enabled ? '생체 인증이 활성화되었습니다' : '생체 인증이 비활성화되었습니다');
    },
    onError: (error) => {
      logger.error('생체 인증 설정 변경 실패', toError(error));
      useToastStore.getState().error('생체 인증 설정 변경에 실패했습니다');
    },
  });

  // 생체 인증 자격 증명 삭제 mutation
  const clearMutation = useMutation({
    mutationFn: clearBiometricCredentials,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biometricQueryKeys.enabled });
    },
  });

  /**
   * 생체 인증 활성화/비활성화
   */
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // 활성화 시 먼저 생체 인증 수행
        setIsAuthenticating(true);
        try {
          const result = await authenticateWithBiometric({
            promptMessage: '생체 인증을 활성화합니다',
          });

          if (!result.success) {
            if (result.errorCode !== 'USER_CANCELLED') {
              useToastStore.getState().error(result.error || '생체 인증에 실패했습니다');
            }
            return;
          }

          // 인증 성공 후 활성화
          await enableMutation.mutateAsync(true);
        } finally {
          setIsAuthenticating(false);
        }
      } else {
        // 비활성화
        await enableMutation.mutateAsync(false);
      }
    },
    [enableMutation]
  );

  /**
   * 생체 인증 수행
   */
  const authenticate = useCallback(
    async (options?: { promptMessage?: string }): Promise<BiometricAuthResult> => {
      setIsAuthenticating(true);
      try {
        return await authenticateWithBiometric(options);
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  /**
   * 생체 인증으로 로그인
   *
   * Firebase Auth 세션이 유효한 경우에만 동작합니다.
   * 세션이 만료된 경우 비밀번호 로그인을 요청합니다.
   */
  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    try {
      // 1. 저장된 자격 증명 확인
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        useToastStore.getState().error('저장된 인증 정보가 없습니다. 비밀번호로 로그인해주세요.');
        await setBiometricEnabled(false);
        queryClient.invalidateQueries({ queryKey: biometricQueryKeys.enabled });
        return false;
      }

      // 2. 생체 인증 수행
      const authResult = await authenticateWithBiometric({
        promptMessage: 'UNIQN 로그인',
      });

      if (!authResult.success) {
        if (authResult.errorCode !== 'USER_CANCELLED') {
          useToastStore.getState().error(authResult.error || '생체 인증에 실패했습니다');
        }
        return false;
      }

      // 3. Firebase Auth 세션 확인
      const auth = getFirebaseAuth();

      // Firebase Auth 세션 복원 대기
      const currentUser = await new Promise<typeof auth.currentUser>((resolve) => {
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }

        // Auth 상태 변경 리스너로 세션 복원 대기
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });

        // 타임아웃 (2초)
        setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 2000);
      });

      if (!currentUser) {
        useToastStore
          .getState()
          .error('인증 세션이 만료되었습니다. 비밀번호로 다시 로그인해주세요.');
        await clearBiometricCredentials();
        await setBiometricEnabled(false);
        queryClient.invalidateQueries({ queryKey: biometricQueryKeys.enabled });
        return false;
      }

      // 4. 저장된 사용자 ID와 현재 세션 비교
      if (currentUser.uid !== credentials.userId) {
        useToastStore
          .getState()
          .error('다른 계정으로 로그인되어 있습니다. 비밀번호로 로그인해주세요.');
        await clearBiometricCredentials();
        await setBiometricEnabled(false);
        queryClient.invalidateQueries({ queryKey: biometricQueryKeys.enabled });
        return false;
      }

      // 5. 토큰 갱신 및 프로필 로드
      try {
        await currentUser.getIdToken(true);

        // Firestore에서 최신 프로필 가져오기
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          useAuthStore.getState().setUser(currentUser);
          useAuthStore.getState().setProfile({
            ...profile,
            createdAt: profile.createdAt?.toDate?.() ?? new Date(),
            updatedAt: profile.updatedAt?.toDate?.() ?? new Date(),
            employerAgreements: profile.employerAgreements
              ? {
                  termsAgreedAt: profile.employerAgreements.termsAgreedAt?.toDate?.() ?? new Date(),
                  liabilityWaiverAgreedAt:
                    profile.employerAgreements.liabilityWaiverAgreedAt?.toDate?.() ?? new Date(),
                }
              : undefined,
            employerRegisteredAt: profile.employerRegisteredAt?.toDate?.() ?? undefined,
          });
        }
      } catch (tokenError) {
        logger.warn('토큰 갱신 실패', { error: tokenError });
        // 토큰 갱신 실패해도 기존 세션은 유효할 수 있으므로 계속 진행
      }

      useToastStore.getState().success('로그인되었습니다');
      logger.info('생체 인증 로그인 성공', { userId: credentials.userId });
      return true;
    } catch (error) {
      logger.error('생체 인증 로그인 실패', toError(error));
      useToastStore.getState().error('로그인에 실패했습니다');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [queryClient]);

  /**
   * 자격 증명 삭제
   */
  const clearCredentials = useCallback(async () => {
    await clearMutation.mutateAsync();
  }, [clearMutation]);

  /**
   * 자격 증명 갱신
   * 일반 로그인(이메일/소셜) 성공 후 호출하여 자격 증명을 최신 상태로 유지
   */
  const updateCredentials = useCallback(async () => {
    try {
      // 생체 인증이 활성화되어 있지 않으면 무시
      const enabled = await isBiometricEnabled();
      if (!enabled) {
        return;
      }

      // 현재 로그인된 사용자 확인
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        logger.debug('생체 인증 자격 증명 갱신 건너뜀: 로그인된 사용자 없음');
        return;
      }

      // Refresh Token 가져오기
      const refreshToken = currentUser.refreshToken;
      if (!refreshToken) {
        logger.warn('생체 인증 자격 증명 갱신 실패: 토큰 없음');
        return;
      }

      // 자격 증명 저장 (갱신)
      await saveBiometricCredentials(currentUser.uid, refreshToken);
      logger.info('생체 인증 자격 증명 갱신 완료', { userId: currentUser.uid });
    } catch (error) {
      // 갱신 실패는 치명적이지 않으므로 경고만 로깅
      logger.warn('생체 인증 자격 증명 갱신 실패', { error });
    }
  }, []);

  /**
   * 상태 새로고침
   */
  const refresh = useCallback(async () => {
    await Promise.all([refetchStatus(), refetchEnabled()]);
  }, [refetchStatus, refetchEnabled]);

  // 생체 인증 타입 이름
  const biometricTypeName = status ? getBiometricTypeName(status.biometricTypes) : '생체 인증';

  return {
    status: status ?? null,
    isEnabled: isEnabled ?? false,
    isAvailable: status?.isAvailable ?? false,
    isLoading: isStatusLoading || isEnabledLoading,
    isAuthenticating,
    biometricTypeName,
    setEnabled,
    authenticate,
    loginWithBiometric,
    clearCredentials,
    updateCredentials,
    refresh,
  };
}

export default useBiometricAuth;
