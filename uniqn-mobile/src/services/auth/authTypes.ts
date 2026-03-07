/**
 * UNIQN Mobile - 인증 서비스 공유 타입 & 헬퍼
 *
 * @description authService 분할 시 여러 모듈에서 공유하는 타입과 유틸리티
 * @version 1.0.0
 */

import { httpsCallable } from 'firebase/functions';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirebaseFunctions } from '@/lib/firebase';
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
  user: FirebaseUser;
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
  // 약관
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed?: boolean;
}

// ============================================================================
// Shared Helpers
// ============================================================================

/** CF verifyAndSaveProfile 요청 페이로드 */
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
}

/**
 * verifyAndSaveProfile CF 호출 (일반 가입 / 소셜 프로필 완성 공통)
 *
 * 서버사이드에서 전화번호 검증, XSS 검증, 중복 검사, Batch Write,
 * Custom Claims 설정, displayName 설정을 모두 처리합니다.
 *
 * 네트워크 에러에 한해 1회 재시도 (2초 대기).
 * CF 내부 Transaction이 중복 실행을 방지하므로 재시도해도 데이터 무결성 보장.
 */
export async function callVerifyAndSaveProfile(payload: VerifyAndSavePayload): Promise<void> {
  const verifyAndSave = httpsCallable<VerifyAndSavePayload, { success: boolean; uid: string }>(
    getFirebaseFunctions(),
    'verifyAndSaveProfile'
  );

  try {
    await verifyAndSave(payload);
  } catch (error) {
    if (!isRetryableError(error)) throw error;

    logger.warn('verifyAndSaveProfile 네트워크 에러 - 2초 후 재시도', {
      component: 'authService',
      error: error instanceof Error ? error.message : String(error),
    });
    await new Promise((r) => setTimeout(r, 2000));
    await verifyAndSave(payload);
  }
}
