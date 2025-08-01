import DOMPurify from 'dompurify';
import { logger } from '../logger';

/**
 * XSS 공격을 방지하기 위한 텍스트 sanitize 유틸리티
 */

// 기본 설정
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
  ALLOWED_ATTR: ['class'],
  KEEP_CONTENT: true,
  RETURN_DOM: false
};

// 엄격한 설정 (태그 완전 제거)
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  RETURN_DOM: false
};

/**
 * HTML 태그가 포함된 텍스트를 안전하게 sanitize
 * @param dirty 정제되지 않은 입력 텍스트
 * @param config DOMPurify 설정 (선택사항)
 * @returns 안전한 텍스트
 */
export function sanitizeHtml(dirty: string, config = DEFAULT_CONFIG): string {
  try {
    if (!dirty || typeof dirty !== 'string') {
      return '';
    }

    const clean = DOMPurify.sanitize(dirty, config);
    
    // XSS 시도가 감지된 경우 로깅
    if (clean !== dirty) {
      logger.warn('XSS 시도가 감지되어 제거되었습니다', { 
        component: 'sanitizer',
        data: {
          original: dirty.substring(0, 100) + '...',
          sanitized: clean.substring(0, 100) + '...'
        }
      });
    }
    
    return clean;
  } catch (error) {
    logger.error('Sanitize 오류', error instanceof Error ? error : new Error(String(error)), { 
      component: 'sanitizer' 
    });
    return '';
  }
}

/**
 * 텍스트에서 모든 HTML 태그 제거
 * @param dirty 정제되지 않은 입력 텍스트
 * @returns HTML 태그가 제거된 순수 텍스트
 */
export function sanitizeText(dirty: string): string {
  return sanitizeHtml(dirty, STRICT_CONFIG);
}

/**
 * URL이 안전한지 검증
 * @param url 검증할 URL
 * @returns 안전한 URL이면 true
 */
export function isSafeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // 허용된 프로토콜만 허용
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      logger.warn('안전하지 않은 URL 프로토콜', { 
        component: 'sanitizer',
        data: { protocol: urlObj.protocol, url }
      });
      return false;
    }
    
    // JavaScript URL 차단
    if (url.toLowerCase().includes('javascript:')) {
      logger.warn('JavaScript URL 시도가 차단되었습니다', { 
        component: 'sanitizer',
        data: { url }
      });
      return false;
    }
    
    return true;
  } catch (error) {
    // 유효하지 않은 URL
    return false;
  }
}

/**
 * 안전한 URL 생성
 * @param url 검증할 URL
 * @param defaultUrl 기본 URL (선택사항)
 * @returns 안전한 URL 또는 기본값
 */
export function sanitizeUrl(url: string, defaultUrl: string = '#'): string {
  if (!url || !isSafeUrl(url)) {
    return defaultUrl;
  }
  return url;
}

/**
 * JSON 문자열을 안전하게 파싱
 * @param jsonString JSON 문자열
 * @param defaultValue 파싱 실패 시 반환할 기본값
 * @returns 파싱된 객체 또는 기본값
 */
export function safeJsonParse<T = any>(jsonString: string, defaultValue: T): T {
  try {
    // JSON 파싱 전에 XSS 패턴 검사
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(jsonString)) {
        logger.warn('JSON에서 XSS 패턴이 감지되었습니다', { 
          component: 'sanitizer',
          data: { pattern: pattern.toString() }
        });
        return defaultValue;
      }
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    logger.debug('JSON 파싱 오류', { 
      component: 'sanitizer',
      data: { error: error instanceof Error ? error.message : String(error) }
    });
    return defaultValue;
  }
}

/**
 * 폼 입력값 sanitize
 * @param formData 폼 데이터 객체
 * @returns Sanitize된 폼 데이터
 */
export function sanitizeFormData<T extends Record<string, any>>(formData: T): T {
  const sanitized = {} as T;
  
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      // 문자열 값은 sanitize
      sanitized[key as keyof T] = sanitizeText(value) as T[keyof T];
    } else if (Array.isArray(value)) {
      // 배열인 경우 각 요소를 처리
      sanitized[key as keyof T] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      ) as T[keyof T];
    } else if (value && typeof value === 'object') {
      // 중첩된 객체인 경우 재귀적으로 처리
      sanitized[key as keyof T] = sanitizeFormData(value) as T[keyof T];
    } else {
      // 그 외의 값은 그대로 사용
      sanitized[key as keyof T] = value;
    }
  }
  
  return sanitized;
}

// 기본 export
export default {
  sanitizeHtml,
  sanitizeText,
  isSafeUrl,
  sanitizeUrl,
  safeJsonParse,
  sanitizeFormData
};