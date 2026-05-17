/**
 * UNIQN Mobile - 소셜 로그인 서비스
 *
 * @description Apple 소셜 로그인 및 프로필 완성
 * @version 2.0.0 - Supabase Auth 전환
 *
 * ============================================================================
 * 소셜 로그인 구현 상태
 * ============================================================================
 * ✅ Apple: Supabase signInWithIdToken 구현
 * 🔲 Google: 미구현 (throw)
 * 🔲 카카오: 미구현 (throw)
 * ============================================================================
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
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
import { type UserProfile, type AuthResult, type SocialProfileData } from './authTypes';
import { callVerifyAndSavePortOneProfile } from './portOneIdentityService';
import { requestAppleAuthorization } from './appleAuthService';
import { getUserProfile } from './userProfileService';

// ============================================================================
// Internal Helpers
// ============================================================================

const APPLE_SUPABASE_AUTH_TIMEOUT_MS = 30_000;
const APPLE_SUPABASE_AUTH_RETRY_DELAY_MS = 1_000;
const APPLE_PROFILE_LOOKUP_TIMEOUT_MS = 15_000;
const APPLE_PROFILE_WRITE_TIMEOUT_MS = 15_000;
const APPLE_PROFILE_WRITE_RETRY_DELAY_MS = 1_000;
const APPLE_PROFILE_CREATE_VERIFICATION_ATTEMPTS = 2;
const APPLE_PROFILE_CREATE_VERIFICATION_DELAY_MS = 1_000;
const SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS = 15 * 60 * 1000;

type AppleLoginStage =
  | 'native_authorization'
  | 'identity_token'
  | 'supabase_sign_in'
  | 'profile_lookup'
  | 'profile_create';

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

// ============================================================================
// Social Login
// ============================================================================

/**
 * Apple 소셜 로그인 (iOS 전용)
 *
 * @description Supabase signInWithIdToken으로 Apple 로그인 처리
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

    // 1. Apple 네이티브 인증 다이얼로그
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

    // 2. Identity Token 검증
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
        identityTokenError
      );
      throw identityTokenError;
    }
    logAppleStageSuccess(flowId, 'identity_token', identityTokenStageStartedAt);

    // Apple 이름 캐싱 처리
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
        } else {
          appleName = mmkv.getString(appleNameCacheKey) ?? '';
        }
      } else {
        appleName = mmkv.getString(appleNameCacheKey) ?? '';
      }
    } catch (cacheError) {
      logger.warn('Apple 이름 캐시 처리 실패 (무시)', {
        component: 'authService',
        flowId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    appleName = sanitizeInput(appleName).slice(0, 20);

    // 3. Supabase signInWithIdToken
    const signInWithAppleToken = () =>
      withTimeout(
        supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
          nonce: rawNonce,
        }),
        APPLE_SUPABASE_AUTH_TIMEOUT_MS,
        'Apple 로그인 서버 인증이 지연되고 있습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
      );

    let authResult;
    let supabaseAuthAttempts = 1;
    const supabaseAuthStartedAt = logAppleStageStart(flowId, 'supabase_sign_in');
    try {
      authResult = await signInWithAppleToken();
    } catch (credentialError) {
      logger.warn('Apple 로그인: Supabase 인증 1차 실패, 1초 후 재시도', {
        component: 'authService',
        provider: 'apple',
        flowId,
        attempt: supabaseAuthAttempts,
        retryDelayMs: APPLE_SUPABASE_AUTH_RETRY_DELAY_MS,
        errorMessage:
          credentialError instanceof Error ? credentialError.message : String(credentialError),
      });
      await new Promise((r) => setTimeout(r, APPLE_SUPABASE_AUTH_RETRY_DELAY_MS));
      supabaseAuthAttempts += 1;
      try {
        authResult = await signInWithAppleToken();
      } catch (retryError) {
        logAppleStageFailure(flowId, 'supabase_sign_in', supabaseAuthStartedAt, retryError, {
          attempts: supabaseAuthAttempts,
        });
        throw retryError;
      }
    }

    if (authResult.error || !authResult.data.user) {
      const signInError = authResult.error;
      logAppleStageFailure(flowId, 'supabase_sign_in', supabaseAuthStartedAt, signInError, {
        attempts: supabaseAuthAttempts,
      });
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: 'Apple 로그인에 실패했습니다. 다시 시도해주세요.',
        originalError: signInError ? new Error(signInError.message) : undefined,
      });
    }

    logAppleStageSuccess(flowId, 'supabase_sign_in', supabaseAuthStartedAt, {
      attempts: supabaseAuthAttempts,
    });

    const user = authResult.data.user;
    protectAuthFlow(user.id, 'apple_login');
    protectedAuthFlowUid = user.id;

    // 4. Firestore 프로필 확인
    const profileLookupStartedAt = logAppleStageStart(flowId, 'profile_lookup');
    let existingProfile;
    try {
      existingProfile = await withTimeout(
        getUserProfile(user.id),
        APPLE_PROFILE_LOOKUP_TIMEOUT_MS,
        'Apple 로그인 처리 중 사용자 정보를 확인하는 데 시간이 오래 걸리고 있습니다.'
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
      if (existingProfile.isActive === false) {
        throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
          userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
        });
      }

      logger.info('Apple 로그인 성공 (기존 사용자)', { uid: user.id });
      leaveAppleLoginBreadcrumb('apple_login_flow', {
        flowId,
        status: 'success',
        resultType: 'existing_verified_profile',
      });
      trackLogin('apple');
      setUserId(user.id);
      setUserProperties({
        user_role: existingProfile.role,
        has_verified_phone: true,
      });
      return { user, profile: existingProfile };
    }

    // 5. 신규/미완성 사용자 → 최소 프로필 생성
    if (!existingProfile) {
      const now = new Date();

      const createProfileDocument = async (attempt: number) => {
        const profileCreateStartedAt = logAppleStageStart(flowId, 'profile_create', { attempt });
        try {
          await withTimeout(
            userRepository.createOrMerge(user.id, {
              uid: user.id,
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
            }),
            APPLE_PROFILE_WRITE_TIMEOUT_MS,
            'Apple 로그인 후 프로필 생성이 지연되고 있습니다.'
          );
          logAppleStageSuccess(flowId, 'profile_create', profileCreateStartedAt, {
            attempt,
            profileCreated: true,
          });
        } catch (createError) {
          logAppleStageFailure(flowId, 'profile_create', profileCreateStartedAt, createError, {
            attempt,
          });
          throw createError;
        }
      };

      const failProfileCreateAndSignOut = async (error: unknown): Promise<never> => {
        logger.error('Apple 로그인 프로필 생성 실패 - 세션 정리', {
          component: 'authService',
          flowId,
          uid: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          await supabase.auth.signOut();
        } catch {
          // Cleanup failures are ignored.
        }
        throw error;
      };

      const verifyProfileCreationSettled = async (_sourceAttempt: number): Promise<boolean> => {
        for (
          let verificationAttempt = 1;
          verificationAttempt <= APPLE_PROFILE_CREATE_VERIFICATION_ATTEMPTS;
          verificationAttempt += 1
        ) {
          await sleep(APPLE_PROFILE_CREATE_VERIFICATION_DELAY_MS);
          try {
            const verifiedProfile = await withTimeout(
              getUserProfile(user.id),
              APPLE_PROFILE_LOOKUP_TIMEOUT_MS,
              'Apple 로그인 후 프로필 생성 상태 확인 지연'
            );
            if (verifiedProfile) return true;
          } catch {
            // verification failure, continue
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
        if (!profileCreatedAfterFirstTimeout) {
          await sleep(APPLE_PROFILE_WRITE_RETRY_DELAY_MS);
          try {
            await createProfileDocument(2);
          } catch (retryCreateError) {
            const retryCode = (retryCreateError as { code?: string })?.code ?? '';
            const isRetryableRetry =
              retryCode === ERROR_CODES.NETWORK_TIMEOUT ||
              retryCode === 'auth/network-request-failed';

            if (isRetryableRetry) {
              const settled = await verifyProfileCreationSettled(2);
              if (!settled) {
                protectAuthFlow(user.id, 'social_signup', SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS);
                preserveProtectedAuthFlow = true;
              }
            } else {
              await failProfileCreateAndSignOut(retryCreateError);
            }
          }
        }
      }

      const minimalProfile: UserProfile = {
        uid: user.id,
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

      logger.info('Apple 신규 사용자 최소 프로필 생성', { uid: user.id });
      leaveAppleLoginBreadcrumb('apple_login_flow', {
        flowId,
        status: 'success',
        resultType: 'new_minimal_profile',
      });
      return { user, profile: minimalProfile };
    }

    // 기존 프로필 있지만 phoneVerified=false (이전에 중단된 가입)
    if (existingProfile.isActive === false) {
      await supabase.auth.signOut();
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
      });
    }

    logger.info('Apple 로그인 성공 (미완성 프로필)', { uid: user.id });
    leaveAppleLoginBreadcrumb('apple_login_flow', {
      flowId,
      status: 'success',
      resultType: 'existing_incomplete_profile',
    });
    return { user, profile: existingProfile };
  } catch (error) {
    if ((error as { userMessage?: string }).userMessage === '') {
      leaveAppleLoginBreadcrumb('apple_login_flow', { flowId, status: 'cancelled' });
      throw error;
    }

    leaveAppleLoginBreadcrumb('apple_login_flow', {
      flowId,
      status: 'failure',
      errorCode: (error as { code?: string })?.code ?? '',
      errorName: (error as { name?: string })?.name ?? '',
    });

    logger.error(
      'Apple 로그인 실패 상세',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'authService',
        provider: 'apple',
        flowId,
        platform: Platform.OS,
      }
    );

    // 부분 인증 상태 정리
    try {
      await supabase.auth.signOut();
    } catch {
      // 정리 실패 무시
    }

    if (isAppError(error)) throw error;

    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: 'Apple 로그인에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.',
      metadata: {
        errorName: (error as { name?: string })?.name ?? '',
        errorMessage: ((error as { message?: string })?.message ?? '').slice(0, 200),
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
 * @description Apple 로그인 후 본인인증 + 약관 데이터로 프로필 업데이트
 */
export async function completeSocialProfile(
  uid: string,
  data: SocialProfileData
): Promise<AuthResult> {
  let shouldClearProtectedAuthFlow = false;

  try {
    logger.info('소셜 프로필 완성 시도', { uid });

    protectAuthFlow(uid, 'social_signup', SOCIAL_SIGNUP_FLOW_PROTECTION_TTL_MS);

    await callVerifyAndSavePortOneProfile({
      identityVerificationId: data.identityVerificationId,
      // 2026-05-16: PortOne 이니시스 통합인증이 gender 를 응답하지 않는 경우 client fallback.
      gender: data.gender,
      termsAgreed: data.termsAgreed,
      privacyAgreed: data.privacyAgreed,
      thirdPartyAgreed: data.thirdPartyAgreed,
      marketingAgreed: data.marketingAgreed ?? false,
      mode: 'social',
    });

    // 업데이트된 프로필 조회
    const updatedProfile = await getUserProfile(uid);
    if (!updatedProfile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '프로필 업데이트 후 조회에 실패했습니다.',
      });
    }

    logger.info('소셜 프로필 완성 성공', { uid });

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '인증 정보가 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // Analytics
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
 * Google 소셜 로그인 (미구현)
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: 'Google 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}

/**
 * 카카오 소셜 로그인 (미구현)
 */
export async function signInWithKakao(): Promise<AuthResult> {
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: '카카오 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}
