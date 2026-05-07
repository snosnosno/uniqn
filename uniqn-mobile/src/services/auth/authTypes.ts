/**
 * UNIQN Mobile - 인증 서비스 공유 타입
 *
 * @description authService 분할 시 여러 모듈에서 공유하는 타입.
 * @version 3.0.0 - PortOne 본인인증 단일 경로
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
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
 * 소셜 로그인 후 PortOne 본인인증 + 약관 데이터로 프로필 업데이트.
 * 닉네임 등은 가입 후 profile-setup 화면에서 입력한다.
 */
export interface SocialProfileData {
  /** 포트원 본인인증 ID (필수) */
  identityVerificationId: string;
  /** 본인인증 결과 사본 — 서버는 PortOne API로 재조회하므로 표시용 */
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
