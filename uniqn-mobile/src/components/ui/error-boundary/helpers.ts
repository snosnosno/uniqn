/**
 * ErrorBoundary 에러 타입 감지 헬퍼
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * AppError 타입 기반 + 레거시 폴백 패턴 매칭
 */

import { isAppError } from '@/errors';

/**
 * 네트워크 관련 에러인지 확인
 *
 * @param error - 확인할 에러
 * @returns 네트워크 관련 에러 여부
 */
export function isNetworkRelatedError(error: Error): boolean {
  // AppError 타입 체크 우선
  if (isAppError(error)) {
    return error.category === 'network';
  }
  // 레거시 폴백: 문자열 패턴 매칭
  const patterns = ['network', 'fetch', 'timeout', 'connection', 'offline'];
  const lowerMessage = error.message.toLowerCase();
  return patterns.some((p) => lowerMessage.includes(p)) || error.name === 'NetworkError';
}

/**
 * 인증 관련 에러인지 확인
 *
 * @param error - 확인할 에러
 * @returns 인증 관련 에러 여부
 */
export function isAuthRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'auth' || error.category === 'permission';
  }
  const patterns = ['auth', 'permission', 'unauthorized', '로그인', '권한', '만료', 'expired'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'AuthError' ||
    error.name === 'PermissionError'
  );
}

/**
 * 폼/검증 관련 에러인지 확인
 *
 * @param error - 확인할 에러
 * @returns 폼/검증 관련 에러 여부
 */
export function isFormRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'validation';
  }
  const patterns = ['form', 'validation', 'submit', '검증', '입력'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'ValidationError' ||
    error.name === 'FormError'
  );
}

/**
 * 데이터 페칭 관련 에러인지 확인
 *
 * @param error - 확인할 에러
 * @returns 데이터 페칭 관련 에러 여부
 */
export function isDataFetchRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'firebase' || error.code.includes('DOCUMENT_NOT_FOUND');
  }
  const patterns = ['fetch', 'data', 'load', 'not found', '404', '500'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'FetchError' ||
    error.name === 'DataError'
  );
}
