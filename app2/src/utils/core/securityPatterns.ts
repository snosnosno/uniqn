/**
 * 보안 패턴 정의
 *
 * XSS, SQL Injection 등 보안 위협 탐지를 위한 패턴
 * 모든 보안/검증 유틸리티에서 공통으로 사용
 *
 * @module utils/core/securityPatterns
 */

/**
 * 위험한 XSS 패턴 목록
 *
 * 다음 패턴을 차단:
 * - <script> 태그
 * - javascript: 프로토콜
 * - on* 이벤트 핸들러 (onclick, onerror 등)
 * - data:text/html URL
 * - <iframe>, <object>, <embed> 태그
 */
export const XSS_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // <script> 태그 (복잡한 매칭)
  /<script[^>]*>.*?<\/script>/gi, // <script> 태그 (간단한 매칭)
  /javascript:/gi, // javascript: 프로토콜
  /on\w+\s*=/gi, // on* 이벤트 핸들러
  /data:text\/html/gi, // data:text/html URL
  /<iframe[^>]*>/gi, // <iframe> 태그
  /<object[^>]*>/gi, // <object> 태그
  /<embed[^>]*>/gi, // <embed> 태그
];

/**
 * SQL Injection 패턴 목록
 *
 * Firebase/Firestore 사용 시 직접적인 SQL Injection은 없지만,
 * 로깅 및 추가 보안 계층으로 유지
 */
export const SQL_INJECTION_PATTERNS: RegExp[] = [
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
 *
 * @example
 * ```ts
 * hasSQLInjectionPattern('안전한 텍스트');           // false
 * hasSQLInjectionPattern('SELECT * FROM users');   // true
 * hasSQLInjectionPattern("'; DROP TABLE users;--"); // true
 * ```
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
 * z.string().refine(validateNoXSSPatterns, {
 *   message: '위험한 문자열이 포함되어 있습니다'
 * })
 * ```
 */
export function validateNoXSSPatterns(text: string): boolean {
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
 * @note DOMPurify 기반 sanitize가 필요하면 security/sanitizer.ts 사용
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
