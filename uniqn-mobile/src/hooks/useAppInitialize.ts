/**
 * UNIQN Mobile - useAppInitialize Hook
 *
 * @description 앱 초기화 상태 관리
 * @version 1.2.0
 *
 * 초기화 순서:
 * 1. 환경변수 검증
 * 2. 스플래시 화면 유지
 * 3. AsyncStorage → MMKV 마이그레이션 (일회성)
 * 4. Zustand hydration 대기 (MMKV 복원)
 * 5. Firebase 초기화
 * 6. 강제 업데이트 체크
 * 7-11. 인증 상태 확인 및 프로필 로드
 *
 * TODO [출시 후]: 폰트 로딩 추가 (expo-font) - 기본 폰트 사용 시 불필요
 * NOTE: 푸시 알림 권한은 useNotificationHandler에서 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase, getFirebaseAuth } from '@/lib/firebase';
import { migrateFromAsyncStorage } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { startTrace } from '@/services/performanceService';
import { getUserProfile } from '@/services/authService';
import {
  checkForceUpdate,
  ForceUpdateError,
  MaintenanceError,
  type VersionCheckResult,
} from '@/services/versionService';
import { checkAutoLoginEnabled } from './useAutoLogin';

// ============================================================================
// Types
// ============================================================================

interface AppInitState {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  /** 강제 업데이트 필요 여부 */
  requiresUpdate: boolean;
  /** 점검 모드 여부 */
  isMaintenanceMode: boolean;
  /** 버전 체크 결과 */
  versionCheckResult: VersionCheckResult | null;
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
    requiresUpdate: false,
    isMaintenanceMode: false,
    versionCheckResult: null,
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

    // 성능 추적: 앱 초기화 전체 시간 측정
    const appInitTrace = startTrace('app_initialization');
    appInitTrace.putAttribute('platform', 'react-native');

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

      // 3. AsyncStorage → MMKV 마이그레이션 (일회성)
      logger.debug('스토리지 마이그레이션 체크 중...', { component: 'useAppInitialize' });
      await migrateFromAsyncStorage();

      // 4. Zustand hydration 대기 (MMKV에서 상태 복원)
      logger.debug('Hydration 대기 중...', { component: 'useAppInitialize' });
      const hydrated = await waitForHydration(5000);
      if (!hydrated) {
        logger.warn('Hydration 타임아웃', { component: 'useAppInitialize' });
        // 타임아웃되어도 계속 진행 (초기 상태로 시작)
      }
      logger.debug('Hydration 완료', { component: 'useAppInitialize' });

      // 5. Firebase 초기화 (지연 초기화)
      logger.debug('Firebase 초기화 중...', { component: 'useAppInitialize' });
      const firebaseResult = tryInitializeFirebase();
      if (!firebaseResult.success) {
        throw new Error(firebaseResult.error);
      }
      logger.debug('Firebase 초기화 완료', { component: 'useAppInitialize' });

      // 6. 강제 업데이트 체크
      logger.debug('버전 체크 중...', { component: 'useAppInitialize' });
      const versionResult = await checkForceUpdate();

      // 점검 모드인 경우
      if (versionResult.isMaintenanceMode) {
        throw new MaintenanceError(
          versionResult.maintenanceMessage || '서버 점검 중입니다. 잠시 후 다시 시도해주세요.'
        );
      }

      // 강제 업데이트 필요한 경우
      if (versionResult.mustUpdate) {
        throw new ForceUpdateError(
          '앱을 최신 버전으로 업데이트해주세요.',
          versionResult.latestVersion,
          versionResult.releaseNotes
        );
      }

      logger.debug('버전 체크 완료', {
        component: 'useAppInitialize',
        updateType: versionResult.updateType,
        currentVersion: versionResult.currentVersion,
      });

      // 7. 인증 상태 초기화 (복원된 상태 활용)
      // getState()로 안정적인 함수 참조 획득
      await useAuthStore.getState().initialize();

      // 8. 인증 상태 확인 (Firebase Auth 리스너 등록)
      await useAuthStore.getState().checkAuthState();

      // 9. 자동 로그인 설정 확인
      logger.debug('자동 로그인 설정 확인 중...', { component: 'useAppInitialize' });
      const autoLoginEnabled = await checkAutoLoginEnabled();
      logger.debug('자동 로그인 설정', { autoLoginEnabled, component: 'useAppInitialize' });

      // 10. Firebase Auth 상태 확정 대기 및 토큰 갱신
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

      // 자동 로그인 비활성화 시: Firebase Auth 상태는 유지하되 UI는 로그인 화면 표시
      if (authUser && !autoLoginEnabled) {
        logger.info('자동 로그인 비활성화됨 - 로그인 화면으로 이동', {
          component: 'useAppInitialize',
          uid: authUser.uid,
        });
        // authStore의 상태를 unauthenticated로 설정 (Firebase에서 로그아웃하지 않음)
        useAuthStore.getState().clearAuthState();
      } else if (authUser) {
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

          // Firestore에서 최신 프로필 가져오기
          logger.debug('Firestore에서 최신 프로필 가져오는 중...', { component: 'useAppInitialize' });
          const freshProfile = await getUserProfile(authUser.uid);
          if (freshProfile) {
            // Timestamp를 Date로 변환하여 authStore에 저장
            useAuthStore.getState().setProfile({
              ...freshProfile,
              createdAt: freshProfile.createdAt?.toDate?.() ?? new Date(),
              updatedAt: freshProfile.updatedAt?.toDate?.() ?? new Date(),
              employerAgreements: freshProfile.employerAgreements ? {
                termsAgreedAt: freshProfile.employerAgreements.termsAgreedAt?.toDate?.() ?? new Date(),
                liabilityWaiverAgreedAt: freshProfile.employerAgreements.liabilityWaiverAgreedAt?.toDate?.() ?? new Date(),
              } : undefined,
              employerRegisteredAt: freshProfile.employerRegisteredAt?.toDate?.() ?? undefined,
            });
            logger.info('최신 프로필 로드 완료', {
              component: 'useAppInitialize',
              uid: authUser.uid,
              nickname: freshProfile.nickname,
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

      // 11. 기타 초기화 작업 (필요 시 추가)
      // - 폰트 로딩 (기본 폰트 사용 시 불필요)
      // NOTE: 푸시 알림 권한은 useNotificationHandler에서 처리

      setState({
        isInitialized: true,
        isLoading: false,
        error: null,
        requiresUpdate: versionResult.shouldUpdate,
        isMaintenanceMode: false,
        versionCheckResult: versionResult,
      });

      // 성능 추적: 초기화 성공
      appInitTrace.putAttribute('status', 'success');
      appInitTrace.stop();

      logger.info('앱 초기화 완료', { component: 'useAppInitialize' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 강제 업데이트 에러 처리
      if (err instanceof ForceUpdateError) {
        logger.warn('강제 업데이트 필요', {
          component: 'useAppInitialize',
          latestVersion: err.latestVersion,
        });

        appInitTrace.putAttribute('status', 'force_update');
        appInitTrace.stop();

        setState({
          isInitialized: false,
          isLoading: false,
          error: err,
          requiresUpdate: true,
          isMaintenanceMode: false,
          versionCheckResult: null,
        });
        return;
      }

      // 점검 모드 에러 처리
      if (err instanceof MaintenanceError) {
        logger.warn('점검 모드', {
          component: 'useAppInitialize',
          message: err.message,
        });

        appInitTrace.putAttribute('status', 'maintenance');
        appInitTrace.stop();

        setState({
          isInitialized: false,
          isLoading: false,
          error: err,
          requiresUpdate: false,
          isMaintenanceMode: true,
          versionCheckResult: null,
        });
        return;
      }

      // 일반 에러 처리
      logger.error('앱 초기화 실패', err, { component: 'useAppInitialize' });

      // 성능 추적: 초기화 실패
      appInitTrace.putAttribute('status', 'error');
      appInitTrace.putAttribute('error_message', err.message);
      appInitTrace.stop();

      setState({
        isInitialized: false,
        isLoading: false,
        error: err,
        requiresUpdate: false,
        isMaintenanceMode: false,
        versionCheckResult: null,
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
