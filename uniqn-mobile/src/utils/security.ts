/**
 * 보안 유틸리티
 *
 * XSS, SQL Injection 등 보안 위협 탐지 및 입력 검증
 * 모든 스키마 및 입력 검증에서 공통으로 사용
 *
 * @module utils/security
 */

import { logger } from '@/utils/logger';

/**
 * 위험한 XSS 패턴 목록
 *
 * 다음 패턴을 차단:
 * - <script> 태그
 * - javascript: 프로토콜
 * - on* 이벤트 핸들러 (onclick, onerror 등)
 * - data:text/html URL
 * - <iframe>, <object>, <embed> 태그
 * - vbscript: 프로토콜
 * - expression() CSS
 */
export const XSS_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /expression\s*\(/gi,
];

/**
 * SQL Injection 패턴 목록
 *
 * Firebase/Firestore 사용 시 직접적인 SQL Injection은 없지만,
 * 추가 보안 계층으로 유지
 */
export const SQL_INJECTION_PATTERNS: RegExp[] = [
  /union.*select/gi,
  /select.*from/gi,
  /insert.*into/gi,
  /delete.*from/gi,
  /drop.*table/gi,
  /update.*set/gi,
  /exec\s*\(/gi,
  /;.*--/gi,
];

/**
 * XSS 공격 패턴 검사
 *
 * @param text - 검사할 텍스트
 * @returns XSS 패턴이 발견되면 true
 *
 * @example
 * ```ts
 * hasXSSPattern('안전한 텍스트');                    // false
 * hasXSSPattern('<script>alert("XSS")</script>');  // true
 * hasXSSPattern('onclick=alert(1)');               // true
 * ```
 */
export function hasXSSPattern(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return XSS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * SQL Injection 패턴 검사
 *
 * @param text - 검사할 텍스트
 * @returns SQL Injection 패턴이 발견되면 true
 */
export function hasSQLInjectionPattern(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * XSS 패턴이 없는지 검증 (Zod refine용)
 *
 * @param text - 검증할 텍스트
 * @returns XSS 패턴이 없으면 true
 *
 * @example
 * ```ts
 * // Zod 스키마에서 사용
 * z.string().refine(xssValidation, {
 *   message: '위험한 문자열이 포함되어 있습니다'
 * })
 * ```
 */
export function xssValidation(text: string): boolean {
  return !hasXSSPattern(text);
}

/**
 * 안전한 텍스트 검증 (XSS + SQL Injection + 길이)
 *
 * @param text - 검증할 텍스트
 * @param maxLength - 최대 길이 (기본값: 500)
 * @returns 안전하면 true
 */
export function isSafeText(text: string, maxLength: number = 500): boolean {
  if (!text || typeof text !== 'string') return false;
  if (text.length > maxLength) return false;
  if (hasXSSPattern(text)) return false;
  if (hasSQLInjectionPattern(text)) return false;
  return true;
}

/**
 * 입력 텍스트에서 위험한 패턴 제거 (간단한 sanitize)
 *
 * @param input - 정제할 텍스트
 * @returns 정제된 텍스트
 *
 * @note React Native에서는 DOMPurify를 직접 사용할 수 없음
 *       브라우저 DOM API에 의존하기 때문
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * HTML 엔티티 이스케이프
 *
 * @param text - 이스케이프할 텍스트
 * @returns 이스케이프된 텍스트
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * 안전한 URL 검증
 *
 * @param url - 검증할 URL
 * @returns 안전한 URL이면 true
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // javascript:, vbscript:, data: 프로토콜 차단
  const dangerousProtocols = /^(javascript|vbscript|data):/i;
  if (dangerousProtocols.test(url.trim())) return false;

  // 허용된 프로토콜만 허용
  const safeProtocols = /^(https?|mailto|tel):/i;
  const isRelative = /^[./]/.test(url) || !url.includes(':');

  return safeProtocols.test(url) || isRelative;
}

/**
 * 전화번호 형식 검증
 *
 * @param phone - 검증할 전화번호
 * @returns 유효한 전화번호면 true
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // 한국 휴대폰 번호 형식 (010-XXXX-XXXX 또는 01XXXXXXXXX)
  const phonePattern = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return phonePattern.test(phone.replace(/\s/g, ''));
}

/**
 * 이메일 형식 검증
 *
 * @param email - 검증할 이메일
 * @returns 유효한 이메일이면 true
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 기반 간소화된 이메일 패턴
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && !hasXSSPattern(email);
}

/**
 * 보안 로깅 (민감 정보 마스킹)
 *
 * @param message - 로그 메시지
 * @param data - 로그 데이터
 */
export function secureLog(message: string, data?: Record<string, unknown>): void {
  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'credential',
  ];

  const maskedData = data
    ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))
            ? '***REDACTED***'
            : value,
        ])
      )
    : undefined;

  if (__DEV__) {
    logger.debug(`[Security] ${message}`, maskedData ? { data: maskedData } : undefined);
  }
}

/**
 * Rate limiting을 위한 시간 체크
 *
 * @param lastAttempt - 마지막 시도 시간 (timestamp)
 * @param cooldownMs - 쿨다운 시간 (밀리초)
 * @returns 쿨다운 중이면 true
 */
export function isRateLimited(lastAttempt: number | null, cooldownMs: number = 60000): boolean {
  if (!lastAttempt) return false;
  return Date.now() - lastAttempt < cooldownMs;
}

/**
 * 비밀번호 강도 검증
 *
 * @param password - 검증할 비밀번호
 * @returns 강도 점수 (0-5)
 */
export function getPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password || password.length < 8) {
    feedback.push('최소 8자 이상이어야 합니다');
  } else {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('소문자를 포함해야 합니다');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('대문자를 포함해야 합니다');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('숫자를 포함해야 합니다');
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('특수문자를 포함해야 합니다');
  }

  // 연속 문자 체크
  if (
    /(.)\1{2,}/.test(password) ||
    /012|123|234|345|456|567|678|789|890/.test(password) ||
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(
      password
    )
  ) {
    score = Math.max(0, score - 1);
    feedback.push('연속된 문자나 숫자는 피해주세요');
  }

  return { score, feedback };
}

// ============================================================================
// Logging Masking Utilities
// ============================================================================

/**
 * 민감한 ID를 마스킹 (앞 2자리 + *** + 뒤 2자리)
 *
 * 로그에 사용자 ID, 스태프 ID 등 민감한 식별자를 기록할 때 사용
 *
 * @param id - 마스킹할 ID
 * @returns 마스킹된 ID
 *
 * @example
 * ```ts
 * maskSensitiveId('abc123xyz');  // 'ab***yz'
 * maskSensitiveId('short');      // '****'
 * maskSensitiveId('');           // '****'
 * ```
 */
export function maskSensitiveId(id: string): string {
  if (!id || id.length < 5) return '****';
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}

/**
 * 로그용 업데이트 객체에서 민감한 필드 제거
 *
 * @param updates - 업데이트 객체
 * @param sensitiveKeys - 제거할 필드 키 목록
 * @returns 민감 필드가 제거된 객체
 *
 * @example
 * ```ts
 * sanitizeLogData({ name: 'John', notes: 'private' }, ['notes']);
 * // { name: 'John', notes: '[REDACTED]' }
 * ```
 */
export function sanitizeLogData<T extends Record<string, unknown>>(
  data: T,
  sensitiveKeys: string[] = ['notes', 'message', 'content', 'password']
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      sensitiveKeys.includes(key) ? '[REDACTED]' : value,
    ])
  );
}
