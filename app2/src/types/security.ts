/**
 * 보안 관련 타입 정의
 *
 * @description
 * 로그인 알림, 비밀번호 변경 등 보안 기능을 위한 타입 정의
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

/**
 * 로그인 알림 설정 (Firestore: users/{userId}/securitySettings/loginNotifications)
 */
export interface LoginNotificationSettings {
  enabled: boolean;
  notifyOnNewDevice: boolean; // 새 기기 로그인 시
  notifyOnNewLocation: boolean; // 새 IP 로그인 시
  notifyOnSuspiciousActivity: boolean; // 의심스러운 활동
  updatedAt: FirebaseTimestamp | Date;
}

/**
 * 로그인 기록 확장 (기존 loginAttempts 확장)
 */
export interface LoginAttempt {
  id: string;
  ip: string;
  email?: string;
  timestamp: FirebaseTimestamp | Date;
  success: boolean;
  userAgent: string;
  attempts: number;
  blockedUntil?: FirebaseTimestamp | Date;

  // 신규: 알림 발송 기록
  notificationSent?: boolean;
  notificationSentAt?: FirebaseTimestamp | Date;

  // 신규: 디바이스 정보
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
  };
}

/**
 * 비밀번호 변경 입력
 */
export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * 비밀번호 강도
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

/**
 * 비밀번호 검증 결과
 */
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  suggestions: string[];
}

/**
 * 보안 설정
 */
export interface SecuritySettings {
  loginNotifications: LoginNotificationSettings;
  twoFactorEnabled?: boolean; // 향후 구현
  trustedDevices?: string[]; // 신뢰할 수 있는 기기 목록
}

/**
 * 로그인 기록 필터
 */
export interface LoginHistoryFilter {
  startDate?: Date;
  endDate?: Date;
  successOnly?: boolean;
  failedOnly?: boolean;
  limit?: number;
}

/**
 * 디바이스 정보
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  os: string;
  isMobile: boolean;
}

/**
 * User Agent 파싱
 */
export const parseUserAgent = (userAgent: string): DeviceInfo => {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const platform = /Windows|Mac|Linux|Android|iOS/i.exec(userAgent)?.[0] || 'Unknown';
  const browser = /Chrome|Firefox|Safari|Edge|Opera/i.exec(userAgent)?.[0] || 'Unknown';
  const os = /Windows NT|Mac OS X|Linux|Android|iOS/i.exec(userAgent)?.[0] || 'Unknown';

  return {
    userAgent,
    platform,
    browser,
    os,
    isMobile,
  };
};
