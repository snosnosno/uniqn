/**
 * UNIQN Mobile - 에러 핸들링 래퍼
 *
 * @description 비동기 함수에 대한 표준화된 에러 처리
 * @version 1.0.0
 */

import { logger } from './logger';
import { normalizeError, type AppError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface ErrorHandlingOptions {
  /** 에러 발생 시 로깅 여부 */
  logError?: boolean;
  /** 커스텀 에러 메시지 */
  errorMessage?: string;
  /** 에러 발생 시 기본값 반환 */
  defaultValue?: unknown;
  /** 컨텍스트 정보 */
  context?: Record<string, unknown>;
  /** 재시도 횟수 */
  retryCount?: number;
  /** 재시도 딜레이 (ms) */
  retryDelay?: number;
}

// ============================================================================
// Error Handling Wrapper
// ============================================================================

/**
 * 비동기 함수에 대한 에러 처리 래퍼
 *
 * @example
 * ```typescript
 * // 간단한 사용법 (레이블만)
 * const result = await withErrorHandling(
 *   async () => await fetchData(),
 *   'fetchData'
 * );
 *
 * // 상세 옵션
 * const result = await withErrorHandling(
 *   async () => await fetchData(),
 *   { logError: true, context: { userId } }
 * );
 * ```
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  optionsOrLabel: ErrorHandlingOptions | string = {}
): Promise<T> {
  // 문자열인 경우 레이블로 처리
  const options: ErrorHandlingOptions =
    typeof optionsOrLabel === 'string' ? { errorMessage: optionsOrLabel } : optionsOrLabel;

  const {
    logError = true,
    errorMessage,
    defaultValue,
    context = {},
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeError(error);

      if (logError) {
        logger.error(errorMessage || '작업 실패', lastError, {
          ...context,
          attempt: attempt + 1,
          maxAttempts: retryCount + 1,
          errorCode: lastError.code,
        });
      }

      // 재시도 가능한 에러인 경우에만 재시도
      if (attempt < retryCount && lastError.category === 'network') {
        await sleep(retryDelay * (attempt + 1)); // 점진적 딜레이
        continue;
      }

      break;
    }
  }

  // 기본값이 제공된 경우 반환
  if (defaultValue !== undefined) {
    return defaultValue as T;
  }

  // 에러 던지기
  throw lastError || new Error(errorMessage || '알 수 없는 오류');
}

/**
 * 동기 함수에 대한 에러 처리 래퍼
 */
export function withErrorHandlingSync<T>(
  fn: () => T,
  options: Omit<ErrorHandlingOptions, 'retryCount' | 'retryDelay'> = {}
): T {
  const { logError = true, errorMessage, defaultValue, context = {} } = options;

  try {
    return fn();
  } catch (error) {
    const normalized = normalizeError(error);

    if (logError) {
      logger.error(errorMessage || '작업 실패', normalized, {
        ...context,
        errorCode: normalized.code,
      });
    }

    if (defaultValue !== undefined) {
      return defaultValue as T;
    }

    throw error;
  }
}

// ============================================================================
// Utility
// ============================================================================

/**
 * 비동기 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
