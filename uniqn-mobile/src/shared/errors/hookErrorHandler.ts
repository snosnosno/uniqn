/**
 * UNIQN Mobile - 훅용 에러 핸들러
 *
 * @description React Query 뮤테이션 등 훅에서 사용하는 표준 에러 처리 유틸리티
 * @version 1.0.0 - Phase 11
 *
 * @example
 * // 기본 사용
 * const handleError = createMutationErrorHandler('지원 처리', addToast);
 * useMutation({ onError: handleError });
 *
 * @example
 * // 인증 체크
 * requireAuth(user);
 */

import { normalizeError, AppError, AuthError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import type { User } from 'firebase/auth';

// ============================================================================
// Types
// ============================================================================

interface ToastInput {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

type AddToastFn = (toast: ToastInput) => void;

interface ErrorHandlerOptions {
  /** 에러 발생 시 토스트 표시 여부 (기본: true) */
  showToast?: boolean;
  /** 추가 컨텍스트 데이터 */
  context?: Record<string, unknown>;
  /** 특정 에러 코드에 대한 커스텀 메시지 */
  customMessages?: Record<string, string>;
}

// ============================================================================
// Main Handlers
// ============================================================================

/**
 * 뮤테이션용 표준 에러 핸들러 생성
 *
 * @description normalizeError로 에러를 AppError로 변환 후 로깅 및 토스트 표시
 *
 * @param context - 에러 발생 위치/작업 설명 (예: '지원 처리', '확정 처리')
 * @param addToast - 토스트 추가 함수
 * @param options - 추가 옵션
 * @returns 에러 핸들러 함수
 *
 * @example
 * const handleError = createMutationErrorHandler('지원 확정', addToast);
 *
 * useMutation({
 *   mutationFn: confirmApplication,
 *   onError: handleError,
 * });
 */
export function createMutationErrorHandler(
  context: string,
  addToast: AddToastFn,
  options: ErrorHandlerOptions = {}
): (error: unknown) => void {
  const { showToast = true, context: extraContext, customMessages } = options;

  return (error: unknown) => {
    const appError = normalizeError(error);

    // 로깅
    logger.error(`${context} 실패`, appError, {
      code: appError.code,
      category: appError.category,
      ...extraContext,
    });

    // 토스트 표시
    if (showToast) {
      // 커스텀 메시지 확인
      const customMessage = customMessages?.[appError.code];
      const message = customMessage ?? appError.userMessage;

      addToast({
        type: 'error',
        message,
      });
    }
  };
}

/**
 * 사일런트 에러 핸들러 (토스트 없이 로깅만)
 *
 * @param context - 에러 발생 위치
 * @param extraContext - 추가 컨텍스트
 * @returns AppError
 */
export function handleSilentError(
  error: unknown,
  context: string,
  extraContext?: Record<string, unknown>
): AppError {
  const appError = normalizeError(error);

  logger.error(`${context} 실패 (silent)`, appError, {
    code: appError.code,
    category: appError.category,
    ...extraContext,
  });

  return appError;
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * 인증 상태 필수 체크 (Type Guard)
 *
 * @description 인증되지 않은 경우 AuthError 발생
 *
 * @param user - Firebase User 또는 null
 * @throws AuthError - 인증되지 않은 경우
 *
 * @example
 * function useMyMutation() {
 *   const { user } = useAuthStore();
 *
 *   return useMutation({
 *     mutationFn: async (input) => {
 *       requireAuth(user);
 *       return await myService.doSomething(input, user.uid);
 *     },
 *   });
 * }
 */
export function requireAuth(user: User | null | undefined): asserts user is User {
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '로그인이 필요합니다.',
    });
  }
}

/**
 * 인증 상태 체크 (옵셔널)
 *
 * @param user - Firebase User 또는 null
 * @returns User ID 또는 null
 */
export function getAuthUserId(user: User | null | undefined): string | null {
  return user?.uid ?? null;
}

// ============================================================================
// Error Utilities for Hooks
// ============================================================================

/**
 * 에러에서 사용자 친화적 메시지 추출
 *
 * @param error - 에러 객체
 * @param fallbackMessage - 폴백 메시지
 * @returns 사용자 친화적 메시지
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage: string = '처리 중 오류가 발생했습니다.'
): string {
  const appError = normalizeError(error);
  return appError.userMessage || fallbackMessage;
}

/**
 * 에러가 재시도 가능한지 확인
 *
 * @param error - 에러 객체
 * @returns 재시도 가능 여부
 */
export function canRetry(error: unknown): boolean {
  const appError = normalizeError(error);
  return appError.isRetryable && appError.category !== 'business';
}

/**
 * 에러가 재인증을 필요로 하는지 확인
 *
 * @param error - 에러 객체
 * @returns 재인증 필요 여부
 */
export function needsReauth(error: unknown): boolean {
  const appError = normalizeError(error);
  return (
    appError.code === ERROR_CODES.AUTH_TOKEN_EXPIRED ||
    appError.code === ERROR_CODES.AUTH_SESSION_EXPIRED
  );
}
