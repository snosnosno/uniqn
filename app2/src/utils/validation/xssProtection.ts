/**
 * XSS 방지 유틸리티
 *
 * DOMPurify 기반 HTML sanitizer 및 정규식 검증
 *
 * @see https://github.com/cure53/DOMPurify
 */

import DOMPurify from 'dompurify';

/**
 * 위험한 XSS 패턴 정규식
 *
 * 다음 패턴을 차단:
 * - <script> 태그
 * - javascript: 프로토콜
 * - on* 이벤트 핸들러 (onclick, onerror 등)
 * - data: URL (base64 인코딩된 스크립트)
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // <script> 태그
  /javascript:/gi, // javascript: 프로토콜
  /on\w+\s*=/gi, // on* 이벤트 핸들러
  /data:text\/html/gi, // data:text/html URL
  /<iframe/gi, // <iframe> 태그
  /<object/gi, // <object> 태그
  /<embed/gi // <embed> 태그
];

/**
 * HTML 문자열을 sanitize하여 XSS 공격 방지
 *
 * @param dirty - Sanitize할 HTML 문자열
 * @returns Sanitize된 안전한 HTML 문자열
 *
 * @example
 * ```ts
 * const unsafe = '<script>alert("XSS")</script>Hello';
 * const safe = sanitizeHtml(unsafe);
 * // 결과: 'Hello'
 * ```
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'], // 허용할 태그 (최소한으로 제한)
    ALLOWED_ATTR: ['href'], // 허용할 속성 (링크만)
    ALLOW_DATA_ATTR: false, // data-* 속성 차단
    ALLOW_UNKNOWN_PROTOCOLS: false, // 알 수 없는 프로토콜 차단
    RETURN_DOM: false, // 문자열 반환
    RETURN_DOM_FRAGMENT: false, // DocumentFragment 반환 안 함
    RETURN_TRUSTED_TYPE: false // TrustedHTML 반환 안 함
  });
}

/**
 * 텍스트 입력값에서 위험한 XSS 패턴 검증
 *
 * @param text - 검증할 텍스트
 * @returns 위험한 패턴이 없으면 true, 있으면 false
 *
 * @example
 * ```ts
 * validateNoXssPatterns('안전한 텍스트'); // true
 * validateNoXssPatterns('<script>alert("XSS")</script>'); // false
 * ```
 */
export function validateNoXssPatterns(text: string): boolean {
  return !DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Zod 스키마용 XSS 검증 함수
 *
 * `.refine()`에서 사용하여 입력값 검증
 *
 * @param value - 검증할 값
 * @returns 위험한 패턴이 없으면 true, 있으면 false
 *
 * @example
 * ```ts
 * z.string().refine(xssValidation, {
 *   message: '위험한 문자열이 포함되어 있습니다'
 * })
 * ```
 */
export function xssValidation(value: string): boolean {
  return validateNoXssPatterns(value);
}

/**
 * 배열 내 모든 문자열에서 XSS 패턴 검증
 *
 * @param values - 검증할 문자열 배열
 * @returns 모든 문자열이 안전하면 true, 하나라도 위험하면 false
 *
 * @example
 * ```ts
 * validateArrayNoXss(['안전한 텍스트 1', '안전한 텍스트 2']); // true
 * validateArrayNoXss(['안전한 텍스트', '<script>XSS</script>']); // false
 * ```
 */
export function validateArrayNoXss(values: string[]): boolean {
  return values.every((value) => validateNoXssPatterns(value));
}

/**
 * 객체 내 모든 문자열 값에서 XSS 패턴 검증
 *
 * @param obj - 검증할 객체
 * @returns 모든 문자열 값이 안전하면 true, 하나라도 위험하면 false
 *
 * @example
 * ```ts
 * validateObjectNoXss({ title: '안전한 제목', desc: '안전한 설명' }); // true
 * validateObjectNoXss({ title: '<script>XSS</script>' }); // false
 * ```
 */
export function validateObjectNoXss(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((value) => {
    if (typeof value === 'string') {
      return validateNoXssPatterns(value);
    }
    if (Array.isArray(value)) {
      return value.every((item) => {
        if (typeof item === 'string') {
          return validateNoXssPatterns(item);
        }
        if (typeof item === 'object' && item !== null) {
          return validateObjectNoXss(item as Record<string, unknown>);
        }
        return true;
      });
    }
    if (typeof value === 'object' && value !== null) {
      return validateObjectNoXss(value as Record<string, unknown>);
    }
    return true;
  });
}
