/**
 * UNIQN Mobile - useAppInitialize Hook
 *
 * @description 앱 초기화 상태 관리
 * @version 1.1.0
 *
 * 초기화 순서:
 * 1. 환경변수 검증
 * 2. Zustand hydration 대기 (AsyncStorage 복원)
 * 3. Firebase 초기화
 * 4. 인증 상태 확인
 *
 * TODO [출시 전]: 폰트 로딩 추가 (expo-font)
 * TODO [출시 전]: 푸시 알림 권한 확인 로직 추가
 * TODO [출시 전]: 강제 업데이트 체크 로직 추가
 * TODO [출시 전]: 네트워크 상태 확인 로직 추가
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase } from '@/lib/firebase';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface AppInitState {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
}

interface UseAppInitializeReturn extends AppInitState {
  retry: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAppInitialize(): UseAppInitializeReturn {
  const [state, setState] = useState<AppInitState>({
    isInitialized: false,
    isLoading: true,
    error: null,
  });

  const { initialize: initializeAuth, checkAuthState } = useAuthStore();

  /**
   * 앱 초기화 수행
   */
  const initialize = useCallback(async () => {
    logger.info('앱 초기화 시작', { component: 'useAppInitialize' });

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. 스플래시 화면 유지
      await SplashScreen.preventAutoHideAsync();

      // 2. 환경변수 검증
      logger.debug('환경변수 검증 중...', { component: 'useAppInitialize' });
      const envResult = validateEnv();
      if (!envResult.success) {
        throw new Error(envResult.error);
      }
      logger.debug('환경변수 검증 완료', { component: 'useAppInitialize' });

      // 3. Zustand hydration 대기 (AsyncStorage에서 상태 복원)
      logger.debug('Hydration 대기 중...', { component: 'useAppInitialize' });
      const hydrated = await waitForHydration(5000);
      if (!hydrated) {
        logger.warn('Hydration 타임아웃', { component: 'useAppInitialize' });
        // 타임아웃되어도 계속 진행 (초기 상태로 시작)
      }
      logger.debug('Hydration 완료', { component: 'useAppInitialize' });

      // 4. Firebase 초기화 (지연 초기화)
      logger.debug('Firebase 초기화 중...', { component: 'useAppInitialize' });
      const firebaseResult = tryInitializeFirebase();
      if (!firebaseResult.success) {
        throw new Error(firebaseResult.error);
      }
      logger.debug('Firebase 초기화 완료', { component: 'useAppInitialize' });

      // 5. 인증 상태 초기화 (복원된 상태 활용)
      await initializeAuth();

      // 6. 인증 상태 확인 (Firebase Auth 리스너 등록)
      await checkAuthState();

      // 7. 기타 초기화 작업 (필요 시 추가)
      // - 폰트 로딩
      // - 설정 데이터 로딩
      // - 푸시 알림 권한 확인

      setState({
        isInitialized: true,
        isLoading: false,
        error: null,
      });

      logger.info('앱 초기화 완료', { component: 'useAppInitialize' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('앱 초기화 실패', err, { component: 'useAppInitialize' });

      setState({
        isInitialized: false,
        isLoading: false,
        error: err,
      });
    } finally {
      // 스플래시 화면 숨기기
      await SplashScreen.hideAsync();
    }
  }, [initializeAuth, checkAuthState]);

  /**
   * 재시도
   */
  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // 초기 실행
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 앱 상태 변화 감지 (포그라운드 복귀 시 인증 상태 확인)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && state.isInitialized) {
          logger.debug('앱 포그라운드 복귀', { component: 'useAppInitialize' });
          checkAuthState();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isInitialized, checkAuthState]);

  return {
    ...state,
    retry,
  };
}

export default useAppInitialize;
