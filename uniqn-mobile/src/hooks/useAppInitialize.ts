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

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase, getFirebaseAuth } from '@/lib/firebase';
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

  // 무한 루프 방지를 위해 초기화 실행 여부 추적
  const isInitializing = useRef(false);

  /**
   * 앱 초기화 수행
   * NOTE: useAuthStore.getState()를 사용하여 안정적인 함수 참조 획득
   * (destructuring으로 가져오면 매 렌더마다 새 참조가 생성되어 무한 루프 발생)
   */
  const initialize = useCallback(async () => {
    // 이미 초기화 중이면 중복 실행 방지
    if (isInitializing.current) {
      return;
    }
    isInitializing.current = true;

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
      // getState()로 안정적인 함수 참조 획득
      await useAuthStore.getState().initialize();

      // 6. 인증 상태 확인 (Firebase Auth 리스너 등록)
      await useAuthStore.getState().checkAuthState();

      // 7. Firebase Auth 상태 확정 대기 및 토큰 갱신
      // 웹앱에서 가입한 계정도 모바일앱에서 최신 Custom Claims를 가져옴
      logger.debug('Firebase Auth 상태 확정 대기 중...', { component: 'useAppInitialize' });

      const auth = getFirebaseAuth();
      const authUser = await new Promise<typeof auth.currentUser>((resolve) => {
        // 이미 세션이 복원된 경우
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }

        // Auth 상태 변경 리스너로 세션 복원 대기
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });

        // 타임아웃 (3초)
        setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 3000);
      });

      if (authUser) {
        try {
          await authUser.getIdToken(true);

          // 토큰 결과 확인 (Custom Claims 포함 여부)
          const tokenResult = await authUser.getIdTokenResult();
          const claims = tokenResult.claims;

          logger.info('토큰 강제 갱신 완료', {
            component: 'useAppInitialize',
            uid: authUser.uid,
            email: authUser.email,
            hasRole: !!claims.role,
            role: claims.role || 'NOT_SET',
            allClaims: JSON.stringify(claims),
          });

          // Custom Claims가 없으면 경고
          if (!claims.role) {
            logger.warn('Custom Claims에 role이 없습니다! Firestore Rules에서 거부될 수 있습니다.', {
              component: 'useAppInitialize',
              uid: authUser.uid,
            });
          }
        } catch (tokenError) {
          // 토큰 갱신 실패해도 앱은 계속 진행
          logger.warn('토큰 갱신 실패', {
            component: 'useAppInitialize',
            error: tokenError instanceof Error ? tokenError.message : String(tokenError),
          });
        }
      } else {
        logger.debug('로그인된 사용자 없음', { component: 'useAppInitialize' });
      }

      // 8. 기타 초기화 작업 (필요 시 추가)
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
      isInitializing.current = false;
    }
  }, []); // 의존성 배열 비움 - getState()는 안정적인 참조

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
          // getState()로 안정적인 함수 참조 획득
          useAuthStore.getState().checkAuthState();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isInitialized]);

  return {
    ...state,
    retry,
  };
}

export default useAppInitialize;
