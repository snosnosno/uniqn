/**
 * UNIQN Mobile - 인증 서비스 공유 타입 & 헬퍼
 *
 * @description authService 분할 시 여러 모듈에서 공유하는 타입과 유틸리티
 * @version 2.0.0 - Supabase Auth 전환
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { logger } from '@/utils/logger';
import { isRetryableError } from '@/errors';
import type { FirestoreUserProfile } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * UserProfile 타입 (하위 호환성을 위해 re-export)
 * @see FirestoreUserProfile from '@/types/user'
 */
export type UserProfile = FirestoreUserProfile;

export interface AuthResult {
  user: SupabaseUser;
  profile: UserProfile;
}

/**
 * 소셜 로그인 프로필 완성 데이터
 *
 * 소셜 로그인 후 본인인증 + 약관 데이터로 프로필 업데이트
 * 프로필(닉네임 등)은 가입 후 profile-setup 화면에서 입력
 */
export interface SocialProfileData {
  // 본인인증
  name: string;
  birthDate: string;
  gender: 'male' | 'female';
  /** 전화번호 (E.164 형식: +821012345678) */
  phone: string;
  /** 포트원 본인인증 ID */
  identityVerificationId?: string;
  // 약관
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed?: boolean;
  /** 서버사이드 OTP 검증용 verificationId (소셜 로그인 시) */
  verificationId?: string;
  /** 서버사이드 OTP 검증용 인증번호 (소셜 로그인 시) */
  otpCode?: string;
}

// ============================================================================
// Shared Helpers
// ============================================================================

/** Supabase Edge Function verifyAndSaveProfile 요청 페이로드 */
export interface VerifyAndSavePayload {
  verifiedPhone: string;
  name: string;
  birthDate: string;
  gender: 'male' | 'female';
  nickname?: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  email?: string;
  mode: 'signup' | 'social';
  /** 서버사이드 OTP 검증용 verificationId (소셜 로그인 시) */
  verificationId?: string;
  /** 서버사이드 OTP 검증용 인증번호 (소셜 로그인 시) */
  otpCode?: string;
}

/**
 * verifyAndSaveProfile Supabase Edge Function 호출 (일반 가입 / 소셜 프로필 완성 공통)
 *
 * 서버사이드에서 전화번호 검증, XSS 검증, 중복 검사, DB Write,
 * role 설정, displayName 설정을 모두 처리합니다.
 *
 * 네트워크 에러에 한해 1회 재시도 (2초 대기).
 */
export async function callVerifyAndSaveProfile(
  payload: VerifyAndSavePayload,
  accessToken?: string
): Promise<void> {
  // supabase.functions.invoke는 signUp 직후 onAuthStateChange 타이밍 이슈로
  // functions.headers.Authorization이 anon key로 고정될 수 있어 raw fetch 사용
  const invoke = async () => {
    const env = getEnv();
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;

    logger.info('callVerifyAndSaveProfile 호출', {
      component: 'authService',
      hasToken: Boolean(token),
      tokenPrefix: token ? token.substring(0, 20) + '...' : 'NONE',
    });

    const res = await fetch(
      `${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-and-save-profile`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        body = '(response body unavailable)';
      }
      logger.error('verify-and-save-profile 실패', new Error(`${res.status}: ${body}`), {
        component: 'authService',
        status: res.status,
        body,
        hasToken: Boolean(token),
      });
      throw new Error(body || `HTTP ${res.status}`);
    }
  };

  try {
    await invoke();
  } catch (error) {
    if (!isRetryableError(error)) throw error;

    logger.warn('verifyAndSaveProfile 네트워크 에러 - 2초 후 재시도', {
      component: 'authService',
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((r) => setTimeout(r, 2000));
    await invoke();
  }
}
