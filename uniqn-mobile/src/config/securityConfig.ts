/**
 * UNIQN Mobile - 보안 설정
 *
 * @description 보안 관련 상수 및 설정 중앙 관리
 * @version 1.0.0
 */

// ============================================================================
// Sensitive Keys Configuration
// ============================================================================

/**
 * 민감한 키 목록 - 웹에서 sessionStorage 사용
 *
 * XSS 공격 시 탈취 방지를 위해 세션 종료 시 삭제됨
 * 이 키들은 브라우저 탭이 닫히면 자동으로 삭제됩니다.
 *
 * @see src/lib/secureStorage.ts - getWebStorage()
 */
export const SENSITIVE_STORAGE_KEYS = [
  'authToken',
  'refreshToken',
  'userId',
  'sessionId',
  'fcmToken', // 푸시 토큰 (사용자 식별 가능)
] as const;

export type SensitiveStorageKey = (typeof SENSITIVE_STORAGE_KEYS)[number];

/**
 * 민감한 키인지 확인
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_STORAGE_KEYS.includes(key as SensitiveStorageKey);
}

// ============================================================================
// Known Storage Keys (for clearAll)
// ============================================================================

/**
 * 네이티브에서 삭제할 알려진 키 목록
 * SecureStore는 전체 목록 조회 불가하므로 명시적으로 관리
 */
export const KNOWN_STORAGE_KEYS = [
  'authToken',
  'refreshToken',
  'userId',
  'fcmToken',
  'sessionId',
  'biometricEnabled',
  'theme',
  'autoLoginEnabled',
] as const;

// ============================================================================
// Token Configuration
// ============================================================================

/**
 * 토큰 관련 설정
 */
export const TOKEN_CONFIG = {
  /** Access Token 기본 만료 시간 (초) - 1시간 */
  ACCESS_TOKEN_EXPIRY: 60 * 60,

  /** Refresh Token 기본 만료 시간 (초) - 7일 */
  REFRESH_TOKEN_EXPIRY: 60 * 60 * 24 * 7,

  /** 토큰 갱신 여유 시간 (초) - 만료 5분 전 갱신 */
  TOKEN_REFRESH_BUFFER: 60 * 5,
} as const;

// ============================================================================
// Password Policy
// ============================================================================

/**
 * 비밀번호 정책
 */
export const PASSWORD_POLICY = {
  /** 최소 길이 */
  MIN_LENGTH: 8,

  /** 최대 길이 */
  MAX_LENGTH: 128,

  /** 대문자 필수 */
  REQUIRE_UPPERCASE: true,

  /** 소문자 필수 */
  REQUIRE_LOWERCASE: true,

  /** 숫자 필수 */
  REQUIRE_NUMBER: true,

  /** 특수문자 필수 */
  REQUIRE_SPECIAL: true,

  /** 연속 문자 최대 허용 (예: 'aaa', '123') */
  MAX_CONSECUTIVE: 2,
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * 요청 제한 설정
 */
export const RATE_LIMIT_CONFIG = {
  /** 로그인 시도 최대 횟수 */
  MAX_LOGIN_ATTEMPTS: 5,

  /** 잠금 시간 (초) - 15분 */
  LOCKOUT_DURATION: 60 * 15,

  /** 비밀번호 재설정 요청 간격 (초) - 1분 */
  PASSWORD_RESET_INTERVAL: 60,
} as const;
