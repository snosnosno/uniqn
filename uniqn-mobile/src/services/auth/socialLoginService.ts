/**
 * UNIQN Mobile - 소셜 로그인 서비스
 *
 * @description Apple/Google/카카오 소셜 로그인 및 프로필 완성
 * @version 1.0.0
 *
 * ============================================================================
 * 소셜 로그인 구현 상태
 * ============================================================================
 * ✅ Apple: 실제 구현 완료 (expo-apple-authentication, iOS 전용)
 * 🔲 Google: Mock 구현 (개발 모드에서만 동작)
 * 🔲 카카오: Mock 구현 (개발 모드에서만 동작)
 *
 * TODO [P1]: Google 소셜 로그인 구현 (@react-native-google-signin/google-signin)
 * TODO [P2]: 카카오 소셜 로그인 구현 (@react-native-seoul/kakao-login + Cloud Functions)
 * ============================================================================
 */

import {
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  OAuthProvider,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseAuth } from '@/lib/firebase';
import { syncSignOut } from '@/lib/authBridge';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AuthError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { withTimeout } from '@/utils/timeout';
import { sanitizeInput } from '@/utils/security';
import { clearProtectedAuthFlow, protectAuthFlow } from '@/shared/auth/protectedAuthFlow';
import {
  trackLogin,
  trackSignup,
  setUserId,
  setUserProperties,
} from '@/services/observability/analyticsService';
import {
  type UserProfile,
  type AuthResult,
  type SocialProfileData,
  callVerifyAndSaveProfile,
} from './authTypes';
import { callVerifyAndSavePortOneProfile } from './portOneIdentityService';
import { requestAppleAuthorization } from './appleAuthService';
import { getUserProfile } from './userProfileService';

// ============================================================================
// Internal Helpers
// ============================================================================

/** 개발 모드 여부 확인 */
const IS_DEV_MODE = __DEV__;
const APPLE_FIREBASE_AUTH_TIMEOUT_MS = 30_000;
const APPLE_FIREBASE_AUTH_RETRY_DELAY_MS = 1_000;
const APPLE_PROFILE_LOOKUP_TIMEOUT_MS = 15_000;
const APPLE_PROFILE_WRITE_TIMEOUT_MS = 15_000;
const APPLE_ID_TOKEN_REFRESH_TIMEOUT_MS = 15_000;
const APPLE_PROFILE_WRITE_RETRY_DELAY_MS = 1_000;
const APPLE_PROFILE_CREATE_VERIFICATION_ATTEMPTS = 2;
const APPLE_PROFILE_CREATE_VERIFICATION_DELAY_MS = 1_000;
const SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS = 15 * 60 * 1000;

type AppleLoginStage =
  | 'native_authorization'
  | 'identity_token'
  | 'firebase_sign_in'
  | 'profile_lookup'
  | 'profile_create'
  | 'claims_refresh';

function createAppleLoginFlowId(): string {
  return `apple-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAppleErrorContext(error: unknown) {
  return {
    errorCode: (error as { code?: string })?.code ?? '',
    errorName: (error as { name?: string })?.name ?? '',
    errorMessage: (error as { message?: string })?.message ?? '',
  };
}

function toAppleBreadcrumbData(
  context?: Record<string, unknown>
): Record<string, string | number | boolean | undefined> {
  return Object.fromEntries(
    Object.entries(context ?? {}).map(([key, value]) => [
      key,
      value === null ? undefined : String(value),
    ])
  );
}

function leaveAppleLoginBreadcrumb(
  event: string,
  data: Record<string, string | number | boolean | undefined>
): void {
  void import('@/services/observability/sentryService')
    .then(({ sentryService }) => sentryService.leaveBreadcrumb(event, data))
    .catch(() => {
      // Breadcrumb recording is best-effort only.
    });
}

function logAppleStageStart(
  flowId: string,
  stage: AppleLoginStage,
  context?: Record<string, unknown>
): number {
  leaveAppleLoginBreadcrumb('apple_login_stage', {
    flowId,
    stage,
    status: 'start',
    ...toAppleBreadcrumbData(context),
  });
  logger.info('Apple 로그인 단계 시작', {
    component: 'authService',
    provider: 'apple',
    flowId,
    stage,
    ...context,
  });
  return Date.now();
}

function logAppleStageSuccess(
  flowId: string,
  stage: AppleLoginStage,
  startedAt: number,
  context?: Record<string, unknown>
): void {
  leaveAppleLoginBreadcrumb('apple_login_stage', {
    flowId,
    stage,
    status: 'success',
    elapsedMs: Date.now() - startedAt,
    ...toAppleBreadcrumbData(context),
  });
  logger.info('Apple 로그인 단계 완료', {
    component: 'authService',
    provider: 'apple',
    flowId,
    stage,
    elapsedMs: Date.now() - startedAt,
    ...context,
  });
}

function logAppleStageFailure(
  flowId: string,
  stage: AppleLoginStage,
  startedAt: number,
  error: unknown,
  context?: Record<string, unknown>
): void {
  leaveAppleLoginBreadcrumb('apple_login_stage', {
    flowId,
    stage,
    status: 'failure',
    elapsedMs: Date.now() - startedAt,
    errorCode: (error as { code?: string })?.code ?? '',
    errorName: (error as { name?: string })?.name ?? '',
    ...toAppleBreadcrumbData(context),
  });
  logger.warn('Apple 로그인 단계 실패', {
    component: 'authService',
    provider: 'apple',
    flowId,
    stage,
    elapsedMs: Date.now() - startedAt,
    ...getAppleErrorContext(error),
    ...context,
  });
}

/**
 * Mock 소셜 로그인 결과 생성
 *
 * @description 개발 환경에서 소셜 로그인 테스트용 Mock 데이터 생성
 * @warning 프로덕션에서는 실제 SDK 연동 필요 (파일 상단 구현 가이드 참조)
 */
async function createMockSocialLoginResult(
  provider: 'apple' | 'google' | 'kakao',
  mockEmail: string,
  mockName: string
): Promise<AuthResult> {
  logger.warn(`[MOCK] ${provider} 소셜 로그인 - 개발 모드`, { provider });

  // Mock 이메일로 실제 Firebase 계정 생성/로그인 시도
  const mockPassword = `MockSocial_${provider}_12345!`;

  try {
    // 기존 계정으로 로그인 시도
    const userCredential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      mockEmail,
      mockPassword
    );

    const profile = await getUserProfile(userCredential.user.uid);

    if (profile) {
      logger.info(`[MOCK] ${provider} 기존 계정 로그인 성공`, {
        uid: userCredential.user.uid,
      });
      return { user: userCredential.user, profile };
    }

    // 프로필이 없으면 생성
    const newProfile = await createMockProfile(
      userCredential.user.uid,
      mockEmail,
      mockName,
      provider
    );
    return { user: userCredential.user, profile: newProfile };
  } catch (error) {
    // Firebase Auth 에러 코드 확인
    const firebaseError = error as { code?: string; message?: string };
    const errorCode = firebaseError.code ?? '';

    // 계정이 없는 경우: 신규 생성
    if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
      logger.info(`[MOCK] ${provider} 신규 계정 생성`, { email: mockEmail, errorCode });

      const userCredential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        mockEmail,
        mockPassword
      );

      await updateProfile(userCredential.user, { displayName: mockName });

      const newProfile = await createMockProfile(
        userCredential.user.uid,
        mockEmail,
        mockName,
        provider
      );

      return { user: userCredential.user, profile: newProfile };
    }

    // 비밀번호 오류 (이미 계정이 있지만 비밀번호가 다른 경우 - 기존 Mock 비밀번호 변경됨)
    if (errorCode === 'auth/wrong-password') {
      logger.warn(`[MOCK] ${provider} 비밀번호 불일치 - 비밀번호 재설정 필요`, {
        email: mockEmail,
        errorCode,
      });
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage:
          'Mock 계정 비밀번호가 변경되었습니다. Firebase Console에서 비밀번호를 재설정하거나 계정을 삭제해주세요.',
      });
    }

    // 이메일 중복 (계정 생성 시)
    if (errorCode === 'auth/email-already-in-use') {
      logger.warn(`[MOCK] ${provider} 이메일 중복`, { email: mockEmail, errorCode });
      throw new AuthError(ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS, {
        userMessage: '이미 등록된 이메일입니다. 다른 로그인 방법을 시도해주세요.',
      });
    }

    // 기타 에러: 상세 로깅 후 재throw
    logger.error(
      `[MOCK] ${provider} 소셜 로그인 실패`,
      error instanceof Error ? error : new Error(String(error)),
      {
        email: mockEmail,
        errorCode,
        errorMessage: firebaseError.message,
      }
    );
    throw error;
  }
}

/**
 * Mock 프로필 생성
 */
async function createMockProfile(
  uid: string,
  email: string,
  name: string,
  provider: 'apple' | 'google' | 'kakao'
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email,
    name,
    nickname: name,
    role: 'staff',
    status: 'active',
    phoneVerified: false, // Mock이므로 전화번호 인증 미완료
    termsAgreed: true,
    privacyAgreed: true,
    marketingAgreed: false,
    profileCompleted: false,
    isActive: true,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await userRepository.createOrMerge(uid, {
    ...profile,
    socialProvider: provider, // 소셜 로그인 제공자 기록
  });

  logger.info(`[MOCK] 프로필 생성 완료`, { uid, provider });

  return profile;
}

// ============================================================================
// Social Login
// ============================================================================

/**
 * Apple 소셜 로그인 (iOS 전용)
 *
 * @description
 * 핵심: Web SDK로만 인증 (Apple credential 1회용 특성상 Native SDK 동기화 생략)
 * Firestore Security Rules는 Web SDK 토큰으로 동작하므로 문제 없음
 *
 * @returns AuthResult (신규 사용자: phoneVerified=false, 기존 사용자: phoneVerified=true)
 */
export async function signInWithApple(): Promise<AuthResult> {
  const flowId = createAppleLoginFlowId();
  let protectedAuthFlowUid: string | null = null;
  let preserveProtectedAuthFlow = false;

  try {
    leaveAppleLoginBreadcrumb('apple_login_flow', {
      flowId,
      status: 'start',
      platform: Platform.OS,
    });
    logger.info('Apple 로그인 흐름 시작', {
      component: 'authService',
      provider: 'apple',
      flowId,
      platform: Platform.OS,
    });

    // 2. Apple 네이티브 인증 다이얼로그 (사용자 입력 대기)
    const requestedScopes = [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ];
    const nativeAuthorizationStartedAt = logAppleStageStart(flowId, 'native_authorization', {
      requestedScopeCount: requestedScopes.length,
    });

    let appleCredential;
    let rawNonce;
    try {
      const authorization = await requestAppleAuthorization({
        requestedScopes,
        operation: 'login',
      });
      appleCredential = authorization.credential;
      rawNonce = authorization.rawNonce;
      logAppleStageSuccess(flowId, 'native_authorization', nativeAuthorizationStartedAt, {
        hasIdentityToken: Boolean(appleCredential.identityToken),
        hasAuthorizationCode: Boolean(appleCredential.authorizationCode),
        hasEmail: Boolean(appleCredential.email),
        hasFullName: Boolean(appleCredential.fullName),
        hasUserIdentifier: Boolean(appleCredential.user),
      });
    } catch (error) {
      logAppleStageFailure(flowId, 'native_authorization', nativeAuthorizationStartedAt, error, {
        operation: 'login',
      });
      throw error;
    }

    const { identityToken } = appleCredential;
    const identityTokenStageStartedAt = logAppleStageStart(flowId, 'identity_token');
    if (!identityToken) {
      const identityTokenError = new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: 'Apple 인증 정보를 받지 못했습니다. 다시 시도해주세요.',
      });
      logAppleStageFailure(
        flowId,
        'identity_token',
        identityTokenStageStartedAt,
        identityTokenError,
        {
          hasAuthorizationCode: Boolean(appleCredential.authorizationCode),
          hasUserIdentifier: Boolean(appleCredential.user),
        }
      );
      throw identityTokenError;
    }
    logAppleStageSuccess(flowId, 'identity_token', identityTokenStageStartedAt, {
      hasAuthorizationCode: Boolean(appleCredential.authorizationCode),
      hasEmail: Boolean(appleCredential.email),
    });

    // Apple이 제공하는 이름 (최초 로그인 시에만 제공)
    // MMKV 실패 시에도 로그인 흐름은 계속 진행 (이름은 빈 문자열 fallback)
    let appleName = '';
    try {
      const appleNameCacheKey = `apple_name_cache_${appleCredential.user}`;
      const mmkv = getMMKVInstance();

      if (appleCredential.fullName) {
        const nameFromApple = [
          appleCredential.fullName.familyName,
          appleCredential.fullName.givenName,
        ]
          .filter(Boolean)
          .join('');
        if (nameFromApple) {
          appleName = nameFromApple;
          mmkv.set(appleNameCacheKey, appleName);
          logger.debug('Apple 이름 MMKV 캐시 저장', { component: 'authService' });
        } else {
          appleName = mmkv.getString(appleNameCacheKey) ?? '';
        }
      } else {
        const cachedName = mmkv.getString(appleNameCacheKey);
        appleName = cachedName ?? '';
        if (cachedName) {
          logger.debug('Apple 이름 MMKV 캐시에서 복구', { component: 'authService' });
        }
      }
    } catch (cacheError) {
      logger.warn('Apple 이름 캐시 처리 실패 (무시)', {
        component: 'authService',
        flowId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    // XSS 방어: Apple 이름 sanitization (CF 최종 검증 전 임시 보호)
    appleName = sanitizeInput(appleName).slice(0, 20);
    logger.info('Apple 로그인 이름 처리 완료', {
      component: 'authService',
      provider: 'apple',
      flowId,
      hasName: appleName.length > 0,
      nameLength: appleName.length,
      usedFullNamePayload: Boolean(appleCredential.fullName),
    });

    // 3. Web SDK 인증 (Firestore Security Rules용 — 반드시 먼저 실행)
    // Apple credential은 1회용이므로 Web SDK를 우선 인증
    const webOAuthCredential = new OAuthProvider('apple.com').credential({
      idToken: identityToken,
      rawNonce,
    });

    // 일시적 네트워크 오류 대응: 1회 재시도 (Apple credential은 1회용이지만 Firebase 토큰은 재사용 가능)
    const signInWithAppleCredential = () =>
      withTimeout(
        signInWithCredential(getFirebaseAuth(), webOAuthCredential),
        APPLE_FIREBASE_AUTH_TIMEOUT_MS,
        'Apple 로그인 서버 인증이 지연되고 있습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
      );

    let webResult;
    let firebaseAuthAttempts = 1;
    const firebaseAuthStartedAt = logAppleStageStart(flowId, 'firebase_sign_in');
    try {
      webResult = await signInWithAppleCredential();
    } catch (credentialError) {
      const credCode = (credentialError as { code?: string })?.code ?? '';
      const isRetryable =
        credCode === 'auth/network-request-failed' ||
        credCode === 'auth/timeout' ||
        credCode === ERROR_CODES.NETWORK_TIMEOUT ||
        !credCode.startsWith('auth/');
      if (!isRetryable) {
        logAppleStageFailure(flowId, 'firebase_sign_in', firebaseAuthStartedAt, credentialError, {
          attempts: firebaseAuthAttempts,
          retryable: false,
        });
        throw credentialError;
      }

      logger.warn('Apple 로그인: Firebase 인증 1차 실패, 1초 후 재시도', {
        component: 'authService',
        provider: 'apple',
        flowId,
        errorCode: credCode,
        attempt: firebaseAuthAttempts,
        retryDelayMs: APPLE_FIREBASE_AUTH_RETRY_DELAY_MS,
        errorMessage:
          credentialError instanceof Error ? credentialError.message : String(credentialError),
      });
      await new Promise((r) => setTimeout(r, APPLE_FIREBASE_AUTH_RETRY_DELAY_MS));
      firebaseAuthAttempts += 1;
      try {
        webResult = await signInWithAppleCredential();
      } catch (retryError) {
        logAppleStageFailure(flowId, 'firebase_sign_in', firebaseAuthStartedAt, retryError, {
          attempts: firebaseAuthAttempts,
          retryable: true,
        });
        throw retryError;
      }
    }
    logger.info('Apple 로그인 Firebase 인증 성공 사용자 확인', {
      component: 'authService',
      provider: 'apple',
      flowId,
      hasEmail: Boolean(webResult.user.email),
      attempts: firebaseAuthAttempts,
    });
    logAppleStageSuccess(flowId, 'firebase_sign_in', firebaseAuthStartedAt, {
      attempts: firebaseAuthAttempts,
    });

    // 4. Firestore 프로필 확인
    // 서버사이드 OTP 검증으로 전환했으므로 Native SDK 동기화 불필요
    const user = webResult.user;
    protectAuthFlow(user.uid, 'apple_login');
    protectedAuthFlowUid = user.uid;

    const profileLookupStartedAt = logAppleStageStart(flowId, 'profile_lookup');
    let existingProfile;
    try {
      existingProfile = await withTimeout(
        getUserProfile(user.uid),
        APPLE_PROFILE_LOOKUP_TIMEOUT_MS,
        'Apple 로그인 처리 중 사용자 정보를 확인하는 데 시간이 오래 걸리고 있습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
      );
      logAppleStageSuccess(flowId, 'profile_lookup', profileLookupStartedAt, {
        profileFound: Boolean(existingProfile),
        phoneVerified: existingProfile?.phoneVerified ?? null,
        isActive: existingProfile?.isActive ?? null,
      });
    } catch (error) {
      logAppleStageFailure(flowId, 'profile_lookup', profileLookupStartedAt, error);
      throw error;
    }

    if (existingProfile && existingProfile.phoneVerified) {
      // 기존 사용자 (프로필 완성됨)
      const claimsRefreshStartedAt = logAppleStageStart(flowId, 'claims_refresh', {
        profileState: 'verified',
      });
      try {
        await withTimeout(
          user.getIdToken(true),
          APPLE_ID_TOKEN_REFRESH_TIMEOUT_MS,
          'Apple 로그인 후 권한 정보를 불러오는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.'
        );
        logAppleStageSuccess(flowId, 'claims_refresh', claimsRefreshStartedAt, {
          profileState: 'verified',
        });
      } catch (error) {
        logAppleStageFailure(flowId, 'claims_refresh', claimsRefreshStartedAt, error, {
          profileState: 'verified',
        });
        throw error;
      }

      // 비활성화된 계정 체크 (명시적으로 false인 경우만)
      if (existingProfile.isActive === false) {
        throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
          userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
        });
      }

      logger.info('Apple 로그인 성공 (기존 사용자)', { uid: user.uid });
      logger.info('Apple 로그인 흐름 완료', {
        component: 'authService',
        provider: 'apple',
        flowId,
        resultType: 'existing_verified_profile',
      });
      leaveAppleLoginBreadcrumb('apple_login_flow', {
        flowId,
        status: 'success',
        resultType: 'existing_verified_profile',
      });
      trackLogin('apple');
      setUserId(user.uid);
      setUserProperties({
        user_role: existingProfile.role,
        has_verified_phone: true,
      });
      return { user, profile: existingProfile };
    }

    // 5. 신규/미완성 사용자 → 최소 프로필 생성
    if (!existingProfile) {
      const now = Timestamp.now();

      // Firestore에 저장할 데이터 (serverTimestamp 사용)
      const createProfileDocument = async (attempt: number) => {
        const profileCreateStartedAt = logAppleStageStart(flowId, 'profile_create', { attempt });
        try {
          await withTimeout(
            userRepository.createOrMerge(user.uid, {
              uid: user.uid,
              email: user.email || '',
              name: appleName,
              role: 'staff',
              status: 'active',
              socialProvider: 'apple',
              phoneVerified: false,
              profileCompleted: false,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
            APPLE_PROFILE_WRITE_TIMEOUT_MS,
            'Apple 로그인 후 프로필 생성이 지연되고 있습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
          );
          logAppleStageSuccess(flowId, 'profile_create', profileCreateStartedAt, {
            attempt,
            profileCreated: true,
            hasEmail: Boolean(user.email),
            hasName: appleName.length > 0,
          });
        } catch (createError) {
          logAppleStageFailure(flowId, 'profile_create', profileCreateStartedAt, createError, {
            attempt,
            hasEmail: Boolean(user.email),
            hasName: appleName.length > 0,
          });
          throw createError;
        }
      };

      const failProfileCreateAndSignOut = async (error: unknown): Promise<never> => {
        logger.error('Apple 로그인 프로필 생성 실패 - 세션 정리', {
          component: 'authService',
          flowId,
          uid: user.uid,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          await syncSignOut();
        } catch {
          // Cleanup failures are ignored because the original error is more important.
        }
        throw error;
      };

      const verifyProfileCreationSettled = async (sourceAttempt: number): Promise<boolean> => {
        for (
          let verificationAttempt = 1;
          verificationAttempt <= APPLE_PROFILE_CREATE_VERIFICATION_ATTEMPTS;
          verificationAttempt += 1
        ) {
          await sleep(APPLE_PROFILE_CREATE_VERIFICATION_DELAY_MS);
          leaveAppleLoginBreadcrumb('apple_login_profile_create_verification', {
            flowId,
            sourceAttempt,
            verificationAttempt,
            status: 'start',
          });

          try {
            const verifiedProfile = await withTimeout(
              getUserProfile(user.uid),
              APPLE_PROFILE_LOOKUP_TIMEOUT_MS,
              'Apple 로그인 후 프로필 생성 상태를 확인하는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.'
            );
            const profileFound = Boolean(verifiedProfile);

            logger.info('Apple 로그인 프로필 생성 후속 확인 완료', {
              component: 'authService',
              provider: 'apple',
              flowId,
              sourceAttempt,
              verificationAttempt,
              profileFound,
            });
            leaveAppleLoginBreadcrumb('apple_login_profile_create_verification', {
              flowId,
              sourceAttempt,
              verificationAttempt,
              status: 'completed',
              profileFound,
            });

            if (profileFound) {
              return true;
            }
          } catch (verificationError) {
            const verificationErrorCode =
              (verificationError as { code?: string })?.code ?? 'unknown';

            logger.warn('Apple 로그인 프로필 생성 후속 확인 실패', {
              component: 'authService',
              provider: 'apple',
              flowId,
              sourceAttempt,
              verificationAttempt,
              errorCode: verificationErrorCode,
            });
            leaveAppleLoginBreadcrumb('apple_login_profile_create_verification', {
              flowId,
              sourceAttempt,
              verificationAttempt,
              status: 'failed',
              errorCode: verificationErrorCode,
            });
          }
        }

        return false;
      };

      try {
        await createProfileDocument(1);
      } catch (createError) {
        const createErrorCode = (createError as { code?: string })?.code ?? '';
        const isRetryableCreateError =
          createErrorCode === ERROR_CODES.NETWORK_TIMEOUT ||
          createErrorCode === 'auth/network-request-failed';

        if (!isRetryableCreateError) {
          await failProfileCreateAndSignOut(createError);
        }

        const profileCreatedAfterFirstTimeout = await verifyProfileCreationSettled(1);
        if (profileCreatedAfterFirstTimeout) {
          logger.info('Apple 로그인 프로필 생성 지연 후 확인 성공', {
            component: 'authService',
            provider: 'apple',
            flowId,
            sourceAttempt: 1,
          });
        } else {
          logger.warn('Apple 로그인 프로필 생성 1차 실패, 1초 후 재시도', {
            component: 'authService',
            provider: 'apple',
            flowId,
            errorCode: createErrorCode,
            retryDelayMs: APPLE_PROFILE_WRITE_RETRY_DELAY_MS,
          });
          leaveAppleLoginBreadcrumb('apple_login_stage_retry', {
            flowId,
            stage: 'profile_create',
            errorCode: createErrorCode,
            retryDelayMs: APPLE_PROFILE_WRITE_RETRY_DELAY_MS,
          });
          await sleep(APPLE_PROFILE_WRITE_RETRY_DELAY_MS);

          try {
            await createProfileDocument(2);
            logger.info('Apple 로그인 프로필 생성 재시도 성공', {
              component: 'authService',
              provider: 'apple',
              flowId,
            });
          } catch (retryCreateError) {
            const retryCreateErrorCode = (retryCreateError as { code?: string })?.code ?? '';
            const isRetryableRetryCreateError =
              retryCreateErrorCode === ERROR_CODES.NETWORK_TIMEOUT ||
              retryCreateErrorCode === 'auth/network-request-failed';

            if (isRetryableRetryCreateError) {
              const profileCreatedAfterRetryTimeout = await verifyProfileCreationSettled(2);
              if (profileCreatedAfterRetryTimeout) {
                logger.info('Apple 로그인 프로필 생성 재시도 지연 후 확인 성공', {
                  component: 'authService',
                  provider: 'apple',
                  flowId,
                  sourceAttempt: 2,
                });
              } else {
                logger.warn('Apple 로그인 프로필 생성이 지연되어 가입 플로우로 우회합니다', {
                  component: 'authService',
                  provider: 'apple',
                  flowId,
                  errorCode: retryCreateErrorCode,
                });
                leaveAppleLoginBreadcrumb('apple_login_profile_create_deferred', {
                  flowId,
                  errorCode: retryCreateErrorCode,
                  fallback: 'social_signup_without_profile_doc',
                });
                protectAuthFlow(user.uid, 'social_signup', SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS);
                preserveProtectedAuthFlow = true;
              }
            } else {
              await failProfileCreateAndSignOut(retryCreateError);
            }
          }
        }
      }

      // 프로필 생성 후 best-effort 토큰 갱신 (onUserRoleChange 트리거가 Claims 설정)
      const claimsRefreshStartedAt = logAppleStageStart(flowId, 'claims_refresh', {
        profileState: 'new_profile',
      });
      try {
        await withTimeout(
          user.getIdToken(true),
          APPLE_ID_TOKEN_REFRESH_TIMEOUT_MS,
          'Apple 로그인 후 권한 정보를 불러오는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.'
        );
        logAppleStageSuccess(flowId, 'claims_refresh', claimsRefreshStartedAt, {
          profileState: 'new_profile',
        });
      } catch (claimsError) {
        logAppleStageFailure(flowId, 'claims_refresh', claimsRefreshStartedAt, claimsError, {
          profileState: 'new_profile',
          tolerated: true,
        });
        // Claims 미설정이어도 signup 플로우 진행 가능
      }

      // 클라이언트 반환용 프로필 (Timestamp.now() — serverTimestamp는 FieldValue이므로 직접 사용 불가)
      const minimalProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: appleName,
        role: 'staff',
        status: 'active',
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      logger.info('Apple 신규 사용자 최소 프로필 생성', { uid: user.uid });
      logger.info('Apple 로그인 흐름 완료', {
        component: 'authService',
        provider: 'apple',
        flowId,
        resultType: 'new_minimal_profile',
      });
      leaveAppleLoginBreadcrumb('apple_login_flow', {
        flowId,
        status: 'success',
        resultType: 'new_minimal_profile',
      });
      return { user, profile: minimalProfile };
    }

    // 기존 프로필 있지만 phoneVerified=false (이전에 중단된 가입)
    // 비활성화된 계정 체크 (명시적으로 false인 경우만)
    if (existingProfile.isActive === false) {
      await syncSignOut();
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
      });
    }

    const claimsRefreshStartedAt = logAppleStageStart(flowId, 'claims_refresh', {
      profileState: 'incomplete_existing_profile',
    });
    try {
      await withTimeout(
        user.getIdToken(true),
        APPLE_ID_TOKEN_REFRESH_TIMEOUT_MS,
        'Apple 로그인 후 권한 정보를 불러오는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.'
      );
      logAppleStageSuccess(flowId, 'claims_refresh', claimsRefreshStartedAt, {
        profileState: 'incomplete_existing_profile',
      });
    } catch (error) {
      logAppleStageFailure(flowId, 'claims_refresh', claimsRefreshStartedAt, error, {
        profileState: 'incomplete_existing_profile',
      });
      throw error;
    }
    logger.info('Apple 로그인 성공 (미완성 프로필)', { uid: user.uid });
    logger.info('Apple 로그인 흐름 완료', {
      component: 'authService',
      provider: 'apple',
      flowId,
      resultType: 'existing_incomplete_profile',
    });
    leaveAppleLoginBreadcrumb('apple_login_flow', {
      flowId,
      status: 'success',
      resultType: 'existing_incomplete_profile',
    });
    return { user, profile: existingProfile };
  } catch (error) {
    if ((error as { userMessage?: string }).userMessage === '') {
      leaveAppleLoginBreadcrumb('apple_login_flow', {
        flowId,
        status: 'cancelled',
      });
      throw error;
    }

    leaveAppleLoginBreadcrumb('apple_login_flow', {
      flowId,
      status: 'failure',
      errorCode: (error as { code?: string })?.code ?? '',
      errorName: (error as { name?: string })?.name ?? '',
    });

    // 에러 진단 정보 추출
    const errorCode = (error as { code?: string }).code ?? '';
    const errorMessage = (error as { message?: string }).message ?? '';
    const errorName = (error as { name?: string }).name ?? '';

    // 4. 상세 진단 로깅 (Sentry — 원인 파악용 전체 에러 정보)
    logger.error(
      'Apple 로그인 실패 상세',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'authService',
        provider: 'apple',
        flowId,
        errorCode,
        errorName,
        errorMessage,
        errorType: typeof error,
        platform: Platform.OS,
      }
    );

    // 5. 부분 인증 상태 정리
    try {
      await syncSignOut();
    } catch {
      // 정리 실패 무시
    }

    if (isAppError(error)) {
      throw error;
    }

    // 6. Firebase Auth 에러
    if (errorCode.startsWith('auth/')) {
      if (
        errorCode === 'auth/account-exists-with-different-credential' ||
        errorCode === 'auth/credential-already-in-use'
      ) {
        throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL, {
          userMessage:
            '이미 다른 로그인 방식으로 가입된 계정입니다. 기존 로그인 방법으로 먼저 로그인해주세요.',
          metadata: { errorCode, provider: 'apple' },
        });
      }

      const userMsg =
        errorCode === 'auth/operation-not-allowed'
          ? 'Apple 로그인이 현재 비활성화되어 있습니다. 다른 로그인 방법을 이용해주세요.'
          : 'Apple 로그인에 실패했습니다. 다시 시도해주세요.';
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: userMsg,
        metadata: { errorCode, provider: 'apple' },
      });
    }

    // 7. Firebase Firestore/Functions 에러 (코드가 있지만 auth/ 아닌 경우)
    if (errorCode) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: 'Apple 로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        metadata: { errorCode, errorName, provider: 'apple' },
      });
    }

    // 8. 코드 없는 에러 (JS Error, TypeError 등)
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: 'Apple 로그인에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.',
      metadata: {
        errorName,
        errorMessage: errorMessage.slice(0, 200),
        provider: 'apple',
      },
    });
  } finally {
    if (!preserveProtectedAuthFlow) {
      clearProtectedAuthFlow(protectedAuthFlowUid);
    }
  }
}

/**
 * 소셜 로그인 프로필 완성
 *
 * @description Apple 로그인 후 기존 회원가입 Step 2→3→4 데이터로 프로필 업데이트
 *
 * @param uid - Firebase Auth UID
 * @param data - Step 2(본인인증) + Step 3(프로필) + Step 4(약관) 데이터
 * @returns 업데이트된 AuthResult
 */
export async function completeSocialProfile(
  uid: string,
  data: SocialProfileData
): Promise<AuthResult> {
  let shouldClearProtectedAuthFlow = false;

  try {
    logger.info('소셜 프로필 완성 시도', { uid });

    // 공통 CF 호출: 서버사이드 phone 검증 + Firestore 저장 + Claims 설정
    // 프로필(닉네임 등)은 가입 후 profile-setup 화면에서 입력
    protectAuthFlow(uid, 'social_signup', SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS);
    if (data.identityVerificationId) {
      await callVerifyAndSavePortOneProfile({
        identityVerificationId: data.identityVerificationId,
        termsAgreed: data.termsAgreed,
        privacyAgreed: data.privacyAgreed,
        marketingAgreed: data.marketingAgreed ?? false,
        mode: 'social',
      });
    } else {
      await callVerifyAndSaveProfile({
        verifiedPhone: data.phone,
        name: data.name,
        birthDate: data.birthDate,
        gender: data.gender,
        termsAgreed: data.termsAgreed,
        privacyAgreed: data.privacyAgreed,
        marketingAgreed: data.marketingAgreed ?? false,
        mode: 'social',
        verificationId: data.verificationId,
        otpCode: data.otpCode,
      });
    }

    // Custom Claims 갱신 (CF가 setCustomUserClaims 호출 후, 클라이언트 토큰 새로고침)
    try {
      const claimsUser = getFirebaseAuth().currentUser;
      if (claimsUser) {
        await claimsUser.getIdToken(true);
        logger.info('소셜 프로필 완성 후 Custom Claims 갱신 완료', { uid });
      }
    } catch (claimsError) {
      logger.warn('소셜 프로필 완성 후 Claims 갱신 실패 (무시)', {
        uid,
        error: claimsError instanceof Error ? claimsError.message : String(claimsError),
      });
    }

    // 업데이트된 프로필 조회
    const updatedProfile = await getUserProfile(uid);
    if (!updatedProfile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '프로필 업데이트 후 조회에 실패했습니다.',
      });
    }

    logger.info('소셜 프로필 완성 성공', { uid });

    // 반환 시점에 user 확인
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '인증 정보가 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // Analytics — Firestore에서 socialProvider 조회하여 정확한 provider 기록
    const provider = updatedProfile.socialProvider;
    if (provider === 'apple' || provider === 'google' || provider === 'kakao') {
      trackSignup(provider);
    }
    setUserId(uid);
    setUserProperties({
      user_role: 'staff',
      account_created_date: new Date().toISOString().split('T')[0],
      has_verified_phone: true,
    });

    shouldClearProtectedAuthFlow = true;
    return { user: currentUser, profile: updatedProfile };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '소셜 프로필 완성',
      component: 'authService',
      context: { uid },
    });
  } finally {
    if (shouldClearProtectedAuthFlow) {
      clearProtectedAuthFlow(uid);
    }
  }
}

/**
 * Google 소셜 로그인
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: @react-native-google-signin/google-signin 필요
 *
 * 구현 가이드:
 * 1. @react-native-google-signin/google-signin 설치
 * 2. google-services.json (Android) / GoogleService-Info.plist (iOS) 추가
 * 3. EAS Build 실행
 * 4. Firebase Console에서 Google 로그인 활성화
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('google', 'mock-google@uniqn.dev', 'Google 테스트 사용자');
  }

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: 'Google 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}

/**
 * 카카오 소셜 로그인
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: @react-native-seoul/kakao-login + Cloud Functions 필요
 *
 * 구현 가이드:
 * 1. @react-native-seoul/kakao-login 설치
 * 2. Kakao Developers에서 앱 등록 및 네이티브 키 발급
 * 3. Cloud Functions에서 Custom Token 발급 엔드포인트 구현
 * 4. EAS Build 실행
 */
export async function signInWithKakao(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('kakao', 'mock-kakao@uniqn.dev', '카카오 테스트 사용자');
  }

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: '카카오 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}
