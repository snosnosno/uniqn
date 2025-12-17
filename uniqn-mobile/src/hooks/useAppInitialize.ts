/**
 * UNIQN Mobile - useAppInitialize Hook
 *
 * @description 앱 초기화 상태 관리
 * @version 1.0.0
 *
 * TODO [출시 전]: 폰트 로딩 추가 (expo-font)
 * TODO [출시 전]: 푸시 알림 권한 확인 로직 추가
 * TODO [출시 전]: 강제 업데이트 체크 로직 추가
 * TODO [출시 전]: 네트워크 상태 확인 로직 추가
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/authStore';
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

      // 2. 인증 상태 초기화 (AsyncStorage에서 복원)
      await initializeAuth();

      // 3. 인증 상태 확인 (Firebase Auth)
      await checkAuthState();

      // 4. 기타 초기화 작업 (필요 시 추가)
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
