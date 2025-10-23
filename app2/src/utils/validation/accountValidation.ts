/**
 * 계정 관리 관련 검증 유틸리티
 *
 * @description
 * XSS, SQL Injection 방지, 입력 검증 등 보안 강화
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import type {
  ConsentCreateInput,
  ConsentUpdateInput,
} from '../../types/consent';
import type { DeletionRequestInput } from '../../types/accountDeletion';
import type { PasswordChangeInput } from '../../types/security';

/**
 * XSS 패턴 검사
 */
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
];

/**
 * SQL Injection 패턴 검사
 */
const SQL_INJECTION_PATTERNS = [
  /union.*select/gi,
  /select.*from/gi,
  /insert.*into/gi,
  /delete.*from/gi,
  /drop.*table/gi,
  /update.*set/gi,
  /exec\s*\(/gi,
];

/**
 * XSS 공격 패턴 검사
 */
export const hasXSSPattern = (text: string): boolean => {
  return XSS_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * SQL Injection 패턴 검사
 */
export const hasSQLInjectionPattern = (text: string): boolean => {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * 안전한 텍스트 검증
 */
export const isSafeText = (text: string, maxLength: number = 500): boolean => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  if (text.length > maxLength) {
    return false;
  }

  if (hasXSSPattern(text)) {
    return false;
  }

  if (hasSQLInjectionPattern(text)) {
    return false;
  }

  return true;
};

/**
 * 입력 텍스트 정제 (XSS 방지)
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

/**
 * 이메일 검증
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * IP 주소 검증
 */
export const isValidIP = (ip: string): boolean => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * 약관 버전 검증
 */
export const isValidVersion = (version: string): boolean => {
  const versionRegex = /^\d+\.\d+$/;
  return versionRegex.test(version);
};

/**
 * 동의 생성 데이터 검증
 */
export const validateConsentCreate = (
  data: ConsentCreateInput
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // userId 검증
  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('유효하지 않은 사용자 ID입니다.');
  }

  // 이용약관 검증
  if (!data.termsOfService?.agreed) {
    errors.push('이용약관에 동의해야 합니다.');
  }
  if (!data.termsOfService?.version || !isValidVersion(data.termsOfService.version)) {
    errors.push('유효하지 않은 이용약관 버전입니다.');
  }
  if (data.termsOfService?.ipAddress && !isValidIP(data.termsOfService.ipAddress)) {
    errors.push('유효하지 않은 IP 주소입니다.');
  }

  // 개인정보 처리방침 검증
  if (!data.privacyPolicy?.agreed) {
    errors.push('개인정보 처리방침에 동의해야 합니다.');
  }
  if (!data.privacyPolicy?.version || !isValidVersion(data.privacyPolicy.version)) {
    errors.push('유효하지 않은 개인정보 처리방침 버전입니다.');
  }
  if (data.privacyPolicy?.ipAddress && !isValidIP(data.privacyPolicy.ipAddress)) {
    errors.push('유효하지 않은 IP 주소입니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 동의 업데이트 데이터 검증
 */
export const validateConsentUpdate = (
  data: ConsentUpdateInput
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 선택 동의는 boolean 타입 확인만
  if (data.marketing !== undefined && typeof data.marketing.agreed !== 'boolean') {
    errors.push('유효하지 않은 마케팅 동의 값입니다.');
  }

  if (data.locationService !== undefined && typeof data.locationService.agreed !== 'boolean') {
    errors.push('유효하지 않은 위치 서비스 동의 값입니다.');
  }

  if (data.pushNotification !== undefined && typeof data.pushNotification.agreed !== 'boolean') {
    errors.push('유효하지 않은 푸시 알림 동의 값입니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 계정 삭제 요청 데이터 검증
 */
export const validateDeletionRequest = (
  data: DeletionRequestInput
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // password 검증
  if (!data.password || typeof data.password !== 'string') {
    errors.push('비밀번호를 입력해주세요.');
  }

  // reason 검증 (선택사항, XSS 체크)
  if (data.reason && !isSafeText(data.reason, 500)) {
    errors.push('탈퇴 사유에 유효하지 않은 문자가 포함되어 있습니다.');
  }

  // reasonCategory 검증
  const validCategories = [
    'not_useful',
    'privacy_concerns',
    'switching_service',
    'too_many_emails',
    'difficult_to_use',
    'other',
  ];
  if (data.reasonCategory && !validCategories.includes(data.reasonCategory)) {
    errors.push('유효하지 않은 탈퇴 사유 카테고리입니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 비밀번호 변경 데이터 검증
 */
export const validatePasswordChange = (
  data: PasswordChangeInput
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // currentPassword 검증
  if (!data.currentPassword || typeof data.currentPassword !== 'string') {
    errors.push('현재 비밀번호를 입력해주세요.');
  }

  // newPassword 검증
  if (!data.newPassword || typeof data.newPassword !== 'string') {
    errors.push('새 비밀번호를 입력해주세요.');
  }

  // 비밀번호 강도 검증 (최소 8자, 숫자, 특수문자 포함)
  if (data.newPassword) {
    const hasMinLength = data.newPassword.length >= 8;
    const hasNumber = /\d/.test(data.newPassword);
    const hasSpecialChar = /[@$!%*?&]/.test(data.newPassword);

    if (!hasMinLength) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
    }
    if (!hasNumber) {
      errors.push('비밀번호는 숫자를 포함해야 합니다.');
    }
    if (!hasSpecialChar) {
      errors.push('비밀번호는 특수문자(@$!%*?&)를 포함해야 합니다.');
    }
  }

  // 같은 비밀번호 사용 금지
  if (data.currentPassword === data.newPassword) {
    errors.push('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 검증 에러 클래스
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 권한 에러 클래스
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * 서비스 에러 클래스
 */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}
