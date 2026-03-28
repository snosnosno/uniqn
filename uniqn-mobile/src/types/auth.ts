/**
 * UNIQN Mobile - 인증 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 인증 상태
 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 인증된 사용자 정보
 *
 * ⚠️ 이메일 인증은 사용하지 않음 - 휴대폰 본인인증으로 대체
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean; // Firebase 기본 필드 (미사용, 휴대폰 본인인증으로 대체)
  phoneNumber: string | null;
  providerIds?: string[];
}

/**
 * 로그인 요청
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 회원가입 요청 (4단계)
 *
 * 플로우: 약관동의 → 계정 → 본인인증 → 프로필
 */
export interface SignUpRequest {
  // Step 1: 약관 동의
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;

  // Step 2: 계정 정보
  email: string;
  password: string;

  // Step 3: 본인인증 (이름/생년월일/성별 + 전화번호 SMS 인증)
  name: string;
  birthDate: string; // YYYYMMDD
  gender: 'male' | 'female';
  phoneVerified: true;
  verifiedPhone: string;

  // Step 4: 프로필 정보
  nickname: string;
  role: 'staff';
}

/**
 * 비밀번호 재설정 요청
 */
export interface ResetPasswordRequest {
  email: string;
}

/**
 * 인증 검증 상태
 */
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';

/**
 * 소셜 로그인 제공자
 */
export type SocialProvider = 'google' | 'apple' | 'kakao';

/**
 * 동의 항목
 */
export interface ConsentItems {
  terms: boolean; // 이용약관 (필수)
  privacy: boolean; // 개인정보처리방침 (필수)
  marketing: boolean; // 마케팅 수신 동의 (선택)
}

/**
 * 세션 정보
 */
export interface SessionInfo {
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  lastActiveAt: Timestamp;
  createdAt: Timestamp;
}
