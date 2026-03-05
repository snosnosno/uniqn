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
 * 7. Dual SDK 상태 일치 확인
 * 8-12. 인증 상태 확인 및 프로필 로드
 *
 * TODO [출시 후]: 폰트 로딩 추가 (expo-font) - 기본 폰트 사용 시 불필요
 * NOTE: 푸시 알림 권한은 useNotificationHandler에서 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase, getFirebaseAuth } from '@/lib/firebase';
import { ensureDualSdkSync } from '@/lib/authBridge';
import { migrateFromAsyncStorage } from '@/lib/mmkvStorage';
import { getUnreadCounterFromCache } from '@/services/notifications/notificationService';
import { logger } from '@/utils/logger';
import { startTrace } from '@/services/observability';
import { getUserProfile, signOut as authSignOut } from '@/services/auth';
import { toStoreProfile } from '@/utils/profileConverter';
import {
  checkForceUpdate,
  ForceUpdateError,
  MaintenanceError,
  isForceUpdateError,
  isMaintenanceError,
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

      // 7. Dual SDK 상태 일치 확인 (native ↔ web)
      await ensureDualSdkSync();

      // 8. 인증 상태 초기화 (복원된 상태 활용)
      // getState()로 안정적인 함수 참조 획득
      await useAuthStore.getState().initialize();

      // 9. 인증 상태 확인 (Firebase Auth 리스너 등록)
      await useAuthStore.getState().checkAuthState();

      // 10. 자동 로그인 설정 확인
      logger.debug('자동 로그인 설정 확인 중...', { component: 'useAppInitialize' });
      const autoLoginEnabled = await checkAutoLoginEnabled();
      logger.debug('자동 로그인 설정', { autoLoginEnabled, component: 'useAppInitialize' });

      // 11. Firebase Auth 상태 확정 대기 및 토큰 갱신
      // 웹앱에서 가입한 계정도 모바일앱에서 최신 Custom Claims를 가져옴
      logger.debug('Firebase Auth 상태 확정 대기 중...', { component: 'useAppInitialize' });

      const auth = getFirebaseAuth();
      const authUser = await new Promise<typeof auth.currentUser>((resolve) => {
        // 이미 세션이 복원된 경우
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }

        // 타임아웃 ID 저장 (cleanup용)
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 3000);

        // Auth 상태 변경 리스너로 세션 복원 대기
        const unsubscribe = auth.onAuthStateChanged((user) => {
          clearTimeout(timeoutId); // 성공 시 타이머 정리
          unsubscribe();
          resolve(user);
        });
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
          let tokenResult = await authUser.getIdTokenResult();
          let claims = tokenResult.claims;

          logger.info('토큰 강제 갱신 완료', {
            component: 'useAppInitialize',
            uid: authUser.uid,
            email: authUser.email,
            hasRole: !!claims.role,
            role: claims.role || 'NOT_SET',
            allClaims: JSON.stringify(claims),
          });

          // Custom Claims 미설정 시 1초 대기 후 1회 재시도
          if (!claims.role) {
            logger.warn('Custom Claims 미설정 - 1초 후 재시도', {
              component: 'useAppInitialize',
              uid: authUser.uid,
            });
            await new Promise((r) => setTimeout(r, 1000));
            try {
              await authUser.getIdToken(true);
              tokenResult = await authUser.getIdTokenResult();
              if (tokenResult.claims.role) {
                claims = tokenResult.claims;
                logger.info('Custom Claims 재시도 성공', {
                  component: 'useAppInitialize',
                  role: tokenResult.claims.role,
                });
              } else {
                logger.warn(
                  'Custom Claims 재시도 후에도 미설정 - Firestore Rules에서 거부될 수 있습니다.',
                  {
                    component: 'useAppInitialize',
                    uid: authUser.uid,
                  }
                );
              }
            } catch {
              logger.warn('Custom Claims 재시도 실패', {
                component: 'useAppInitialize',
              });
            }
          }

          // Firestore에서 최신 프로필 가져오기 (setUser보다 먼저 — 부분 인증 상태 방지)
          logger.debug('Firestore에서 최신 프로필 가져오는 중...', {
            component: 'useAppInitialize',
          });
          let freshProfile = await getUserProfile(authUser.uid);
          // 일시적 Firestore 캐시 miss 대비: null 시 1.5초 후 1회 재시도
          if (!freshProfile) {
            logger.info('프로필 미발견 - 1.5초 후 재시도', {
              component: 'useAppInitialize',
              uid: authUser.uid,
            });
            await new Promise((r) => setTimeout(r, 1500));
            freshProfile = await getUserProfile(authUser.uid);
          }
          if (freshProfile) {
            // 소셜 로그인 미완성 프로필 → setProfile + setUser 후 useAuthGuard가 signup 리다이렉트
            if (freshProfile.socialProvider && !freshProfile.phoneVerified) {
              logger.info('소셜 로그인 미완성 프로필 감지 - signup 리다이렉트 대기', {
                component: 'useAppInitialize',
                uid: authUser.uid,
                socialProvider: freshProfile.socialProvider,
              });
              // setProfile → setUser 순서: profile 먼저 설정하여 useAuthGuard가 정확한 상태 감지
              useAuthStore.getState().setProfile(toStoreProfile(freshProfile));
              useAuthStore.getState().setUser(authUser);
              // 알림 카운터 등 불필요한 초기화 건너뛰기
            } else {
              // 완성된 프로필: setProfile → setUser 순서 (profile 준비 후 인증 상태 전환)
              // Timestamp를 Date로 변환하여 authStore에 저장
              useAuthStore.getState().setProfile(toStoreProfile(freshProfile));
              useAuthStore.getState().setUser(authUser);
              logger.info('최신 프로필 로드 완료', {
                component: 'useAppInitialize',
                uid: authUser.uid,
                nickname: freshProfile.nickname,
              });
            }
          } else {
            // Firestore 프로필 문서 없는 고아 계정 → 로그아웃 처리
            logger.warn('Firestore 프로필 문서 없음 (고아 계정) - 로그아웃 처리', {
              component: 'useAppInitialize',
              uid: authUser.uid,
              email: authUser.email,
            });
            await authSignOut();
            useAuthStore.getState().reset();
          }

          // 완성된 프로필이 있을 때만 알림 카운터 로드
          if (freshProfile && freshProfile.phoneVerified) {
            // 🆕 미읽음 알림 카운터 로드 (Firestore 실시간 리스너 대체)
            try {
              // Service를 통해 캐시된 카운터 조회
              const cachedCount = await getUnreadCounterFromCache(authUser.uid);

              let unreadCount: number;

              if (cachedCount !== null) {
                // 카운터 문서가 있으면 그 값 사용
                unreadCount = cachedCount;
                logger.info('미읽음 알림 카운터 로드 완료', {
                  component: 'useAppInitialize',
                  unreadCount,
                  source: 'counter_document',
                });
              } else {
                // 🆕 카운터 문서가 없으면 (기존 사용자) 실제 미읽음 수 계산
                // 클라이언트 debounce: 최근 10초 내 초기화 요청 여부 확인
                const { getMMKVInstance } = await import('@/lib/mmkvStorage');
                const storage = getMMKVInstance();
                const DEBOUNCE_KEY = `counter_init_${authUser.uid}`;
                const lastInitTimeStr = storage.getString(DEBOUNCE_KEY);
                const lastInitTime = lastInitTimeStr ? parseInt(lastInitTimeStr, 10) : 0;
                const now = Date.now();
                const DEBOUNCE_MS = 10000; // 10초

                if (now - lastInitTime < DEBOUNCE_MS) {
                  logger.info('카운터 초기화 debounce - 최근 요청됨', {
                    component: 'useAppInitialize',
                    uid: authUser.uid,
                    lastInitAgo: now - lastInitTime,
                  });
                  unreadCount = 0; // debounce 중에는 0으로 시작
                } else {
                  logger.info('카운터 문서 없음 - 미읽음 알림 수 계산 중...', {
                    component: 'useAppInitialize',
                    uid: authUser.uid,
                  });

                  // Cloud Function으로 카운터 초기화 요청 (실제 미읽음 수 계산)
                  const { httpsCallable } = await import('firebase/functions');
                  const { getFirebaseFunctions } = await import('@/lib/firebase');
                  const functions = getFirebaseFunctions();
                  const initializeCounter = httpsCallable<void, { unreadCount: number }>(
                    functions,
                    'initializeUnreadCounter'
                  );

                  // debounce 타임스탬프 먼저 저장 (중복 호출 방지)
                  storage.set(DEBOUNCE_KEY, String(now));

                  try {
                    const result = await initializeCounter();
                    unreadCount = result.data.unreadCount;
                    logger.info('미읽음 카운터 초기화 완료', {
                      component: 'useAppInitialize',
                      unreadCount,
                      source: 'calculated',
                    });
                  } catch (initError) {
                    // Cloud Function 실패 시 0으로 시작 (다음 FCM에서 업데이트됨)
                    logger.warn('카운터 초기화 실패 - 0으로 시작', {
                      component: 'useAppInitialize',
                      error: initError instanceof Error ? initError.message : String(initError),
                    });
                    unreadCount = 0;
                    // 실패 시 debounce 타임스탬프 제거 (재시도 가능하도록)
                    storage.delete(DEBOUNCE_KEY);
                  }
                }
              }

              useNotificationStore.getState().setUnreadCount(unreadCount);
            } catch (counterError) {
              logger.warn('미읽음 카운터 로드 실패', {
                component: 'useAppInitialize',
                error: counterError instanceof Error ? counterError.message : String(counterError),
              });
              // 카운터 로드 실패해도 앱은 계속 진행
            }
          } // end: if (freshProfile) - 알림 카운터 블록
        } catch (tokenError) {
          // 치명적 에러 vs 일시적 에러 분기
          const errorCode = (tokenError as { code?: string }).code;
          const fatalCodes = [
            'auth/user-token-expired',
            'auth/user-disabled',
            'auth/user-not-found',
          ];

          if (fatalCodes.includes(errorCode ?? '')) {
            // 치명적 에러: 재인증 필요 → 로그아웃 + 상태 초기화
            logger.warn('치명적 토큰 에러 - 로그아웃 처리', {
              component: 'useAppInitialize',
              errorCode,
              error: tokenError instanceof Error ? tokenError.message : String(tokenError),
            });
            await authSignOut();
            useAuthStore.getState().reset();
          } else {
            // 일시적 에러 (네트워크 등): 앱 계속 진행
            logger.warn('토큰 갱신 실패 (일시적) - 앱 계속 진행', {
              component: 'useAppInitialize',
              errorCode,
              error: tokenError instanceof Error ? tokenError.message : String(tokenError),
            });
          }
        }
      } else {
        // Firebase Auth에 사용자가 없으면 MMKV에서 복원된 stale 인증 상태 정리
        const currentStatus = useAuthStore.getState().status;
        if (currentStatus === 'authenticated') {
          logger.info('Firebase Auth 사용자 없음 - stale 인증 상태 정리', {
            component: 'useAppInitialize',
            previousStatus: currentStatus,
          });
          useAuthStore.getState().clearAuthState();
        } else {
          logger.debug('로그인된 사용자 없음', { component: 'useAppInitialize' });
        }
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
      if (isForceUpdateError(err)) {
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
      if (isMaintenanceError(err)) {
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
      appInitTrace.putAttribute('error_message', (err as Error).message);
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
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && state.isInitialized) {
        logger.debug('앱 포그라운드 복귀', { component: 'useAppInitialize' });
        // getState()로 안정적인 함수 참조 획득
        useAuthStore.getState().checkAuthState();
      }
    });

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
