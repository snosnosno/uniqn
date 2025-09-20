import { logger } from '../logger';

/**
 * CSRF (Cross-Site Request Forgery) 보호를 위한 토큰 관리 유틸리티
 */

// CSRF 토큰 저장 키
const CSRF_TOKEN_KEY = 't-holdem-csrf-token';
const CSRF_TOKEN_EXPIRY_KEY = 't-holdem-csrf-expiry';

// 토큰 유효 시간 (1시간)
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/**
 * 안전한 랜덤 토큰 생성
 * @returns 생성된 CSRF 토큰
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * CSRF 토큰을 세션 스토리지에 저장
 * @param token CSRF 토큰
 */
export function storeCsrfToken(token: string): void {
  try {
    const expiry = Date.now() + TOKEN_LIFETIME_MS;
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
    sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, expiry.toString());
    
    logger.debug('CSRF 토큰이 저장되었습니다', { 
      component: 'csrf',
      data: { tokenLength: token.length, expiryTime: new Date(expiry).toISOString() }
    });
  } catch (error) {
    logger.error('CSRF 토큰 저장 오류', error instanceof Error ? error : new Error(String(error)), { 
      component: 'csrf' 
    });
  }
}

/**
 * 저장된 CSRF 토큰 가져오기
 * @returns CSRF 토큰 또는 null
 */
export function getCsrfToken(): string | null {
  try {
    const token = sessionStorage.getItem(CSRF_TOKEN_KEY);
    const expiry = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
    
    if (!token || !expiry) {
      return null;
    }
    
    // 토큰 만료 확인
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() > expiryTime) {
      logger.info('CSRF 토큰이 만료되었습니다', { component: 'csrf' });
      clearCsrfToken();
      return null;
    }
    
    return token;
  } catch (error) {
    logger.error('CSRF 토큰 가져오기 오류', error instanceof Error ? error : new Error(String(error)), { 
      component: 'csrf' 
    });
    return null;
  }
}

/**
 * CSRF 토큰 삭제
 */
export function clearCsrfToken(): void {
  try {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
    sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);

  } catch (error) {
    logger.error('CSRF 토큰 삭제 오류', error instanceof Error ? error : new Error(String(error)), { 
      component: 'csrf' 
    });
  }
}

/**
 * 새로운 CSRF 토큰 생성 및 저장
 * @returns 생성된 CSRF 토큰
 */
export function refreshCsrfToken(): string {
  const token = generateCsrfToken();
  storeCsrfToken(token);
  return token;
}

/**
 * 현재 CSRF 토큰 가져오기 (없으면 새로 생성)
 * @returns CSRF 토큰
 */
export function ensureCsrfToken(): string {
  const existingToken = getCsrfToken();
  if (existingToken) {
    return existingToken;
  }
  
  return refreshCsrfToken();
}

/**
 * CSRF 토큰 검증
 * @param token 검증할 토큰
 * @returns 유효한 토큰이면 true
 */
export function validateCsrfToken(token: string | null | undefined): boolean {
  if (!token) {
    logger.warn('CSRF 토큰이 제공되지 않았습니다', { component: 'csrf' });
    return false;
  }
  
  const storedToken = getCsrfToken();
  if (!storedToken) {
    logger.warn('저장된 CSRF 토큰이 없습니다', { component: 'csrf' });
    return false;
  }
  
  const isValid = token === storedToken;
  if (!isValid) {
    logger.warn('유효하지 않은 CSRF 토큰', { 
      component: 'csrf',
      data: { 
        providedLength: token.length,
        storedLength: storedToken.length
      }
    });
  }
  
  return isValid;
}

/**
 * HTTP 요청에 CSRF 토큰 헤더 추가
 * @param headers 기존 헤더 객체
 * @returns CSRF 토큰이 추가된 헤더
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = ensureCsrfToken();
  
  if (headers instanceof Headers) {
    headers.set('X-CSRF-Token', token);
    return headers;
  }
  
  return {
    ...headers,
    'X-CSRF-Token': token
  };
}

/**
 * Axios 인터셉터를 위한 CSRF 설정
 * @param config Axios 요청 설정
 * @returns 수정된 설정
 */
export function addCsrfToAxiosConfig(config: any): any {
  const token = ensureCsrfToken();
  
  return {
    ...config,
    headers: {
      ...config.headers,
      'X-CSRF-Token': token
    }
  };
}

// 브라우저 환경에서 자동으로 CSRF 토큰 초기화
if (typeof window !== 'undefined') {
  // 페이지 로드 시 토큰 확인/생성
  window.addEventListener('load', () => {
    ensureCsrfToken();
  });
  
  // 인증 상태 변경 시 토큰 갱신
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth-state-changed') {
      refreshCsrfToken();
    }
  });
}

// 기본 export
export default {
  generateCsrfToken,
  storeCsrfToken,
  getCsrfToken,
  clearCsrfToken,
  refreshCsrfToken,
  ensureCsrfToken,
  validateCsrfToken,
  addCsrfHeader,
  addCsrfToAxiosConfig
};