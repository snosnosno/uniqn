/**
 * XSS 방지 유틸리티
 *
 * DOMPurify 기반 HTML sanitizer 및 정규식 검증
 * Core 모듈의 통합 보안 패턴 활용
 *
 * @see https://github.com/cure53/DOMPurify
 */

import DOMPurify from 'dompurify';

// ===== Core 모듈에서 보안 패턴 import =====
import { XSS_PATTERNS, validateNoXSSPatterns as coreValidateNoXSSPatterns } from '../core';

// DANGEROUS_PATTERNS는 XSS_PATTERNS로 통합됨 (core/securityPatterns.ts)
// 하위 호환성: XSS_PATTERNS를 re-export
export { XSS_PATTERNS };

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
    RETURN_TRUSTED_TYPE: false, // TrustedHTML 반환 안 함
  });
}

/**
 * 텍스트 입력값에서 위험한 XSS 패턴 검증
 * Core 모듈의 통합 검증 함수 활용
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
  return coreValidateNoXSSPatterns(text);
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

/**
 * 전화번호 정제 (숫자와 하이픈만 허용)
 *
 * @param phone - 정제할 전화번호
 * @returns 정제된 전화번호
 *
 * @example
 * ```ts
 * sanitizePhoneNumber('010-1234-5678<script>') // '010-1234-5678'
 * sanitizePhoneNumber('abc010def1234ghi5678') // '010-1234-5678'
 * ```
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // 숫자와 하이픈만 추출
  const cleaned = phone.replace(/[^0-9-]/g, '');
  return cleaned;
}

/**
 * 고정공고 입력 데이터 정제 (XSS 방어)
 *
 * @param data - 정제할 고정공고 데이터 (부분)
 * @returns 정제된 안전한 데이터
 *
 * @description
 * 다음 필드들을 정제합니다:
 * - title: 공고 제목
 * - description: 공고 설명
 * - detailedAddress: 상세 주소
 * - phone: 전화번호
 * - requiredRoles: 필수 역할 배열 (name 필드)
 * - benefits: 복리후생 배열
 * - preQuestions: 사전 질문 배열
 *
 * @example
 * ```ts
 * const input = {
 *   title: '딜러 모집<script>alert("xss")</script>',
 *   description: '긴급 채용',
 *   phone: '010-1234-5678'
 * };
 *
 * const safe = sanitizeJobPostingInput(input);
 * // { title: '딜러 모집', description: '긴급 채용', phone: '010-1234-5678' }
 * ```
 */
export function sanitizeJobPostingInput(
  data: Partial<Record<string, unknown>>
): Partial<Record<string, unknown>> {
  const sanitized: Partial<Record<string, unknown>> = {};

  // 문자열 필드 정제
  if (data.title && typeof data.title === 'string') {
    sanitized.title = sanitizeHtml(data.title);
  }

  if (data.description && typeof data.description === 'string') {
    sanitized.description = sanitizeHtml(data.description);
  }

  if (data.detailedAddress && typeof data.detailedAddress === 'string') {
    sanitized.detailedAddress = sanitizeHtml(data.detailedAddress);
  }

  // 전화번호 정제
  if (data.phone && typeof data.phone === 'string') {
    sanitized.phone = sanitizePhoneNumber(data.phone);
  }

  // 배열 필드 정제
  if (Array.isArray(data.requiredRoles)) {
    sanitized.requiredRoles = data.requiredRoles
      .filter(
        (role): role is { name: string; count: number } =>
          typeof role === 'object' &&
          role !== null &&
          'name' in role &&
          'count' in role &&
          typeof role.name === 'string' &&
          typeof role.count === 'number'
      )
      .map((role) => ({
        name: sanitizeHtml(role.name),
        count: role.count,
      }));
  }

  if (Array.isArray(data.benefits)) {
    sanitized.benefits = (data.benefits as string[])
      .filter((item) => typeof item === 'string')
      .map((item) => sanitizeHtml(item))
      .filter((item) => item.length > 0);
  }

  if (Array.isArray(data.preQuestions)) {
    sanitized.preQuestions = (data.preQuestions as string[])
      .filter((item) => typeof item === 'string')
      .map((item) => sanitizeHtml(item))
      .filter((item) => item.length > 0);
  }

  // 기타 안전한 필드는 그대로 복사
  const safeFields = [
    'postingType',
    'status',
    'startDate',
    'endDate',
    'location',
    'salaryType',
    'salaryAmount',
    'daysPerWeek',
    'startTime',
    'endTime',
  ];

  safeFields.forEach((field) => {
    if (field in data) {
      sanitized[field] = data[field];
    }
  });

  return sanitized;
}

/**
 * URL 유효성 검증
 *
 * @param url - 검증할 URL 문자열
 * @returns 유효한 URL이면 true, 아니면 false
 *
 * @description
 * - http:// 또는 https:// 프로토콜만 허용
 * - URL 생성자로 파싱 가능한 형식인지 검증
 *
 * @example
 * ```ts
 * isValidURL('https://example.com') // true
 * isValidURL('http://example.com/path') // true
 * isValidURL('ftp://example.com') // false (프로토콜 불일치)
 * isValidURL('javascript:alert(1)') // false (악성 프로토콜)
 * isValidURL('not a url') // false
 * ```
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedURL = new URL(url);

    // http, https 프로토콜만 허용 (XSS 방지)
    if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
      return false;
    }

    // 유효한 호스트 존재 여부 확인
    if (!parsedURL.hostname || parsedURL.hostname.length === 0) {
      return false;
    }

    return true;
  } catch {
    // URL 생성자 파싱 실패
    return false;
  }
}

/**
 * 이메일 형식 검증 및 정제
 *
 * @param email - 검증할 이메일 주소
 * @returns 유효하면 정제된 이메일, 아니면 null
 *
 * @example
 * ```ts
 * sanitizeEmail('test@example.com') // 'test@example.com'
 * sanitizeEmail('Test@Example.COM') // 'test@example.com'
 * sanitizeEmail('invalid-email') // null
 * sanitizeEmail('<script>@example.com') // null
 * ```
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  // XSS 방어: HTML 태그 제거
  const cleaned = sanitizeHtml(email);

  // 이메일 형식 검증 (RFC 5322 간소화 버전)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(cleaned)) {
    return null;
  }

  // 소문자로 정규화
  return cleaned.toLowerCase();
}
