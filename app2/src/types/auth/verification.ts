/**
 * 본인 인증 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 인증 타입
 */
export type VerificationType = 'email' | 'phone' | 'both';

/**
 * 인증 상태
 */
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';

/**
 * 전화번호 인증 기록
 */
export interface PhoneVerification {
  id: string;
  userId: string;
  phoneNumber: string;
  verificationCode: string;
  status: VerificationStatus;
  attempts: number; // 시도 횟수
  maxAttempts: number; // 최대 시도 횟수 (기본 3회)
  expiresAt: Timestamp; // 만료 시간 (기본 5분)
  verifiedAt?: Timestamp; // 인증 완료 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 이메일 인증 기록
 */
export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  status: VerificationStatus;
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
 * 인증 코드 발송 요청
 */
export interface SendVerificationCodeRequest {
  phoneNumber: string;
  userId: string;
}

/**
 * 인증 코드 확인 요청
 */
export interface VerifyCodeRequest {
  phoneNumber: string;
  userId: string;
  code: string;
}
