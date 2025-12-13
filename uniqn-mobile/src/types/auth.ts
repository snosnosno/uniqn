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
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
}

/**
 * 로그인 요청
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 회원가입 요청 (3단계)
 */
export interface SignUpRequest {
  // Step 1: 기본 정보
  email: string;
  password: string;
  name: string;
  nickname?: string;

  // Step 2: 연락처
  phone: string;

  // Step 3: 역할 선택
  role: 'staff' | 'manager';

  // 동의 정보
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed?: boolean;
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
 * 전화번호 인증
 */
export interface PhoneVerification {
  id: string;
  userId: string;
  phoneNumber: string;
  verificationCode: string;
  status: VerificationStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Timestamp;
  verifiedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 사용자 인증 상태
 */
export interface UserVerificationStatus {
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneNumber?: string;
  verifiedAt?: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 소셜 로그인 제공자
 */
export type SocialProvider = 'google' | 'apple';

/**
 * 동의 항목
 */
export interface ConsentItems {
  terms: boolean; // 이용약관 (필수)
  privacy: boolean; // 개인정보처리방침 (필수)
  marketing: boolean; // 마케팅 수신 동의 (선택)
  push: boolean; // 푸시 알림 동의 (선택)
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
