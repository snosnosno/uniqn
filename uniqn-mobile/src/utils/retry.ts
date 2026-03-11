/**
 * UNIQN Mobile - Retry with Exponential Backoff
 *
 * @description 네트워크/서버 지연에 대응하는 재시도 유틸리티.
 * 매 시도마다 대기 시간을 배수로 늘려 서버 부담을 줄이면서 성공 확률을 높인다.
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** 최대 재시도 횟수 (기본 3) */
  maxRetries?: number;
  /** 초기 대기 시간 ms (기본 1000) */
  initialDelayMs?: number;
  /** 대기 시간 배수 (기본 2) */
  backoffMultiplier?: number;
  /** 최대 대기 시간 ms (기본 30000) */
  maxDelayMs?: number;
  /** 로깅 컴포넌트명 */
  component?: string;
  /** 작업 설명 (로그용) */
  operationName?: string;
  /** 재시도 조건 판단 함수 (기본: 항상 true) */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface RetryResult<T> {
  data: T;
  attempts: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * 지수 백오프 기반 재시도 실행
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => getUserProfile(uid),
 *   { maxRetries: 3, operationName: '프로필 조회' }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30_000,
    component = 'retry',
    operationName = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { data, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        break;
      }

      const delayMs = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);

      logger.info(`${operationName} 실패 - ${delayMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`, {
        component,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
