/**
 * UNIQN Mobile - 인증 코어 서비스
 *
 * @description 로그인, 회원가입, 세션 관리, 전화번호/이메일/닉네임 중복 확인
 * @version 2.0.0 - Supabase Auth 전환
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { clearProtectedAuthFlow, protectAuthFlow } from '@/shared/auth/protectedAuthFlow';
import { RealtimeManager } from '@/shared/realtime';
import { userSessionStorage } from '@/lib/secureStorage';
import { clearBiometricCredentials } from './biometricService';
import {
  clearPortOneIdentityBindingToken,
  callVerifyAndSavePortOneProfile,
} from './portOneIdentityService';
import { AuthError, ERROR_CODES, isRetryableError } from '@/errors';
import { createClientRateLimiter } from '@/utils/security';
import { handleServiceError, maskValue } from '@/errors/serviceErrorHandler';
import {
  trackLogin,
  trackSignup,
  trackLogout,
  setUserId,
  setUserProperties,
} from '@/services/observability/analyticsService';
import {
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
} from './loginAttemptService';
import type { SignUpFormData, LoginFormData } from '@/schemas';
import { type UserProfile, type AuthResult } from './authTypes';
import { getUserProfile as fetchUserProfile } from './userProfileService';

// ============================================================================
// Internal Helpers
// ============================================================================

/** 이메일 마스킹 (로깅용) - maskValue 래퍼 */
const maskEmail = (email: string) => maskValue(email, 'email');

/** Email Enumeration 완화: 분당 5회 제한 (클라이언트측) */
const emailCheckLimiter = createClientRateLimiter(5, 60_000);
/** Email 존재 확인 최소 응답 시간 (타이밍 공격 완화) */
const EMAIL_CHECK_MIN_RESPONSE_MS = 300;

/** 회원가입 Analytics 이벤트 */
function trackSignupAnalytics(uid: string, role: 'staff' | 'employer' | 'admin'): void {
  trackSignup('email');
  setUserId(uid);
  setUserProperties({
    user_role: role,
    account_created_date: new Date().toISOString().split('T')[0],
    has_verified_phone: true,
  });
}

// ============================================================================
// Auth Service - Login / SignUp / Session
// ============================================================================

/**
 * 이메일/비밀번호 로그인
 */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    await checkLoginAttempts(data.email);

    logger.info('로그인 시도', { email: maskEmail(data.email), platform: Platform.OS });

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError || !authData.user) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: '이메일 또는 비밀번호가 올바르지 않습니다.',
        originalError: signInError ? new Error(signInError.message) : undefined,
      });
    }

    const user = authData.user;

    // 사용자 프로필 조회
    const profile = await getUserProfile(user.id);

    if (!profile) {
      // 세션은 이미 생성됐지만 public.users 프로필이 없는 orphan 계정.
      // 잔존 세션을 정리해 authStore 가 끌려가지 않게 한다 (signUp/Apple 경로와 일관).
      try {
        await supabase.auth.signOut();
      } catch {
        // cleanup failure 무시 — 원래 에러가 우선
      }
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '가입이 완료되지 않은 계정이에요. 다시 회원가입을 진행해주세요.',
      });
    }

    // 비활성화된 계정 체크 (명시적으로 false인 경우만)
    if (profile.isActive === false) {
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '비활성화된 계정입니다. 고객센터로 문의해주세요',
      });
    }

    logger.info('로그인 성공', { uid: user.id });

    // 로그인 성공 시도 횟수 초기화
    await resetLoginAttempts(data.email);

    // Analytics 이벤트
    trackLogin('email');
    setUserId(user.id);
    setUserProperties({
      user_role: profile.role,
      has_verified_phone: !!profile.phoneVerified,
    });

    return { user, profile };
  } catch (error) {
    // 로그인 실패 시 시도 횟수 증가
    const skipIncrement =
      error instanceof AuthError &&
      (error.code === ERROR_CODES.AUTH_RATE_LIMITED ||
        error.code === ERROR_CODES.AUTH_USER_NOT_FOUND);
    if (!skipIncrement) {
      try {
        await incrementLoginAttempts(data.email);
      } catch {
        // Rate limiting 업데이트 실패는 무시 (원래 에러가 우선)
      }
    }

    throw handleServiceError(error, {
      operation: '로그인',
      component: 'authService',
      context: { email: maskEmail(data.email) },
    });
  }
}

/**
 * 이메일 중복 확인
 *
 * @description Step 1에서 다음 단계로 넘어가기 전에 이메일 중복 여부 확인
 * Supabase RPC를 통해 서버 측에서 확인합니다.
 *
 * @param email 확인할 이메일
 * @returns 이메일이 이미 존재하면 true, 없으면 false
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  // 클라이언트측 Rate Limit (자동화 공격 시간 벌기)
  if (!emailCheckLimiter.tryAcquire()) {
    throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      metadata: { waitMs: emailCheckLimiter.getWaitTime() },
    });
  }

  const startTime = Date.now();

  try {
    logger.info('이메일 중복 확인', { email: maskEmail(email) });

    const { data, error } = await supabase.rpc('check_email_exists', {
      p_email: email.trim().toLowerCase(),
    });

    if (error) {
      if (!isRetryableError(error)) throw error;

      logger.warn('이메일 중복 확인 네트워크 에러 - 2초 후 재시도', {
        component: 'authService',
        error: error.message,
      });
      await new Promise((r) => setTimeout(r, 2000));

      const { data: retryData, error: retryError } = await supabase.rpc('check_email_exists', {
        p_email: email.trim().toLowerCase(),
      });
      if (retryError) throw retryError;

      const elapsed = Date.now() - startTime;
      if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
        await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
      }

      return retryData as boolean;
    }

    logger.info('이메일 중복 확인 완료', {
      email: maskEmail(email),
      exists: data,
    });

    // 타이밍 공격 완화
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    return data as boolean;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    if (error instanceof AuthError && error.code === ERROR_CODES.AUTH_RATE_LIMITED) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '이메일 중복 확인',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * 닉네임 중복 확인
 */
export async function checkNicknameExists(nickname: string, excludeUid?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_nickname_exists', {
      p_nickname: nickname.trim(),
      p_exclude_uid: excludeUid ?? null,
    });

    if (error) throw error;
    return data as boolean;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '닉네임 중복 확인',
      component: 'authService',
      context: { nickname },
    });
  }
}

/**
 * 회원가입 (PortOne 본인인증 필수)
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
    const identityVerificationId = data.identityVerificationId;
    if (!identityVerificationId) {
      throw new AuthError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '본인인증을 완료해주세요.',
      });
    }

    logger.info('회원가입 시도', {
      email: maskEmail(data.email),
      platform: Platform.OS,
    });

    // 1. Supabase Auth 계정 생성
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    });

    // 이미 가입된 이메일 처리 (orphan 락아웃 근본 해결):
    //  - 이메일 확인 OFF 환경: 중복 이메일은 하드 422 user_already_exists 에러로 옴
    //  - 이메일 확인 ON 환경: 에러 없이 session=null(obfuscated)로 옴
    // 두 경우 모두 dead-end("회원가입 실패") 대신 기존 계정으로 signIn 해서,
    // 프로필 미완성(orphan)이면 본인인증 저장을 이어 완료(self-heal)하고,
    // 완성됐으면 edge function이 PROFILE_ALREADY_COMPLETED → 로그인 안내로 분기.
    const alreadyExists =
      !!signUpError &&
      ((signUpError as { code?: string }).code === 'user_already_exists' ||
        (signUpError as { status?: number }).status === 422 ||
        /already\s*(registered|exists)/i.test(signUpError.message ?? ''));

    if (signUpError && !alreadyExists) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: '회원가입에 실패했습니다. 다시 시도해주세요.',
        originalError: new Error(signUpError.message),
      });
    }

    // functions.invoke는 functions.headers.Authorization을 사용하는데,
    // SupabaseClient v2에서 onAuthStateChange가 functions.setAuth를 호출하지 않아
    // signUp 직후 항상 anon key로 요청됨 → 명시적으로 access token 전달 필요.
    let user = signUpData?.user ?? null;
    let accessToken = signUpData?.session?.access_token;

    // user/세션이 없으면(이미 가입된 이메일) 기존 계정으로 로그인해 이어서 진행.
    if (!user || !accessToken) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError || !signInData.user || !signInData.session) {
        // 기존 계정이지만 비밀번호 불일치 → 클라이언트에서 복구 불가, 로그인 안내.
        throw new AuthError(ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS, {
          userMessage: '이미 가입된 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해주세요.',
          originalError: signInError ? new Error(signInError.message) : undefined,
        });
      }
      user = signInData.user;
      accessToken = signInData.session.access_token;
    }

    if (!user) {
      // 도달 불가 — 위 분기에서 user 확정 (TS narrowing 보조).
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: '회원가입에 실패했습니다. 다시 시도해주세요.',
      });
    }
    protectAuthFlow(user.id, 'email_signup');

    try {
      // 2. Edge Function 호출: 서버사이드 PortOne 재조회 + DB 저장 + role 설정
      await callVerifyAndSavePortOneProfile(
        {
          identityVerificationId,
          // 2026-05-16: PortOne 이니시스 통합인증이 gender 를 응답하지 않는 경우 client fallback.
          // 서버는 PortOne 응답 우선, 없을 때만 이 값 사용.
          gender: data.gender,
          termsAgreed: data.termsAgreed,
          privacyAgreed: data.privacyAgreed,
          thirdPartyAgreed: data.thirdPartyAgreed,
          marketingAgreed: data.marketingAgreed,
          email: data.email,
          mode: 'signup',
        },
        accessToken
      );

      // 3. 저장된 프로필 조회
      const profile = await getUserProfile(user.id);
      if (!profile) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '회원가입은 완료되었지만 프로필 정보를 가져오지 못했습니다.',
        });
      }

      logger.info('회원가입 성공', { uid: user.id });
      trackSignupAnalytics(user.id, 'staff');

      return { user, profile };
    } catch (error) {
      // 실패 시 세션 정리: signOut. orphan auth 계정은 다음 시도에서 signUp 422 →
      // signIn 재개로 self-heal 되고, 7일 후 cleanup-orphan-accounts cron 이 정리한다.
      try {
        await supabase.auth.signOut();
      } catch {
        // cleanup failure 무시
      }
      throw error;
    } finally {
      clearProtectedAuthFlow(user.id);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '회원가입',
      component: 'authService',
      context: { email: maskEmail(data.email) },
    });
  }
}

/**
 * 로그아웃
 *
 * 세션·Realtime·캐시·Analytics를 정리하지만, 라우터 이동은 수행하지 않는다.
 * 호출자가 signOut 완료 후 `router.replace('/(auth)/login')` 등 진입 경로를 명시해야 한다.
 */
export async function signOut(): Promise<void> {
  try {
    logger.info('로그아웃 시도');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      clearProtectedAuthFlow(user.id);
    }

    RealtimeManager.unsubscribeAll();
    clearCounterSyncCache();

    // P0 #3 — 공용 디바이스 다음 사용자에게 자격증명 잔존 방지
    // C4 fix — bindingToken도 함께 정리 (PortOne 본인인증 도중 강제 signOut 대비)
    // 모두 idempotent. 한쪽 실패해도 signOut 계속 진행 (SecureStore 일시적 잠금 등)
    await Promise.allSettled([
      clearPortOneIdentityBindingToken(),
      clearBiometricCredentials(),
      userSessionStorage.clearSession(),
    ]);

    await supabase.auth.signOut();

    trackLogout();
    setUserId(null);

    logger.info('로그아웃 성공');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '로그아웃',
      component: 'authService',
    });
  }
}

/**
 * 비밀번호 재설정 이메일 전송
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    logger.info('비밀번호 재설정 이메일 전송', { email: maskEmail(email) });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    logger.info('비밀번호 재설정 이메일 전송 성공', { email: maskEmail(email) });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '비밀번호 재설정',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * 사용자 프로필 가져오기
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return fetchUserProfile(uid);
}

/**
 * 비밀번호 재인증 (민감한 작업 시 필요)
 *
 * Supabase에서는 비밀번호 재인증 개념이 다름.
 * signInWithPassword로 재인증 수행.
 */
export async function reauthenticate(password: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: '비밀번호가 올바르지 않습니다.',
        originalError: new Error(error.message),
      });
    }

    logger.info('재인증 성공', { uid: user.id });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '재인증',
      component: 'authService',
    });
  }
}

/**
 * 현재 로그인된 사용자 가져오기 (동기 - Zustand store에서 읽기)
 *
 * Supabase의 getUser()는 async이므로, 동기적으로 필요한 경우
 * authStore에서 읽습니다. 신선한 데이터가 필요하면 getCurrentUserAsync()를 사용.
 */
export function getCurrentUser(): SupabaseUser | null {
  // 동기적 접근이 필요한 경우를 위해 store에서 읽되,
  // 호출 시점에 store가 이미 세팅되어 있어야 합니다.
  // 대부분의 caller는 이미 인증된 상태에서 호출합니다.
  return null; // Deprecated: use authStore or getCurrentUserAsync()
}

/**
 * 현재 로그인된 사용자 가져오기 (비동기)
 */
export async function getCurrentUserAsync(): Promise<SupabaseUser | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * 현재 로그인된 사용자 가져오기 (필수, 비동기)
 *
 * @throws {AuthError} 로그인되지 않은 경우
 */
export async function requireCurrentUser(): Promise<SupabaseUser> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다.',
    });
  }
  return data.user;
}

/**
 * 인증 상태 변경 리스너
 *
 * Supabase auth state change를 구독하고, 정리 함수를 반환합니다.
 */
export function onAuthStateChanged(callback: (user: SupabaseUser | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * 전화번호 중복 확인 (Supabase RPC 호출)
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_phone_exists', {
      p_phone: phone,
    });

    if (error) throw error;
    return data as boolean;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전화번호 중복 확인',
      component: 'authService',
      context: { phone: maskValue(phone, 'phone') },
    });
  }
}

/**
 * 현재 사용자에게 설정된 전화번호 반환
 */
export async function getLinkedPhoneNumber(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.phone ?? null;
}
