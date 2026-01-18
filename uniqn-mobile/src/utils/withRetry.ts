/**
 * UNIQN Mobile - 재시도 유틸리티
 *
 * @description Exponential Backoff + Jitter를 지원하는 고급 재시도 유틸리티
 * @version 1.0.0
 *
 * 사용 사례:
 * - 네트워크 요청 재시도
 * - Firebase 일시적 오류 복구
 * - 외부 API 호출 안정성 향상
 */

import { logger } from './logger';
import { normalizeError, AppError, type ErrorCategory } from '@/errors';

// ============================================================================
// Types
// ============================================================================

/**
 * 재시도 설정
 */
export interface RetryOptions {
  /**
   * 최대 재시도 횟수 (기본: 3)
   * 0이면 재시도 없음, 원래 함수만 실행
   */
  maxRetries?: number;

  /**
   * 초기 딜레이 (ms, 기본: 1000)
   * 첫 번째 재시도 전 대기 시간
   */
  initialDelay?: number;

  /**
   * 최대 딜레이 (ms, 기본: 30000)
   * 지수 증가 시 최대 대기 시간
   */
  maxDelay?: number;

  /**
   * 딜레이 배수 (기본: 2)
   * 각 재시도마다 딜레이가 이 값만큼 곱해짐
   */
  backoffMultiplier?: number;

  /**
   * 지터 사용 여부 (기본: true)
   * 서버 부하 분산을 위해 딜레이에 무작위 변동 추가
   */
  useJitter?: boolean;

  /**
   * 재시도 가능 여부 판별 함수
   * true 반환 시 재시도, false 반환 시 즉시 실패
   */
  shouldRetry?: (error: Error | AppError, attempt: number) => boolean;

  /**
   * 재시도 시 콜백
   */
  onRetry?: (error: Error | AppError, attempt: number, delay: number) => void;

  /**
   * 컨텍스트 (로깅용)
   */
  context?: string;
}

/**
 * 재시도 결과
 */
export interface RetryResult<T> {
  /** 성공 여부 */
  success: boolean;
  /** 결과값 (성공 시) */
  data?: T;
  /** 에러 (실패 시) */
  error?: Error | AppError;
  /** 시도 횟수 */
  attempts: number;
  /** 총 소요 시간 (ms) */
  totalTime: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry' | 'context'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  useJitter: true,
};

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Exponential Backoff + Jitter로 재시도
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, context: 'fetchData' }
 * );
 *
 * // 커스텀 재시도 조건
 * const result = await withRetry(
 *   () => apiCall(),
 *   {
 *     maxRetries: 5,
 *     shouldRetry: (error) => error instanceof NetworkError,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`재시도 ${attempt}회, ${delay}ms 후...`);
 *     },
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    useJitter,
    shouldRetry = defaultShouldRetry,
    onRetry,
    context,
  } = config;

  let lastError: Error | AppError | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error | AppError;
      attempt++;

      // 최대 재시도 횟수 초과
      if (attempt > maxRetries) {
        break;
      }

      // 재시도 가능 여부 확인
      if (!shouldRetry(lastError, attempt)) {
        logger.debug('재시도 불가능한 에러', {
          context,
          errorName: lastError.name,
          attempt,
        });
        break;
      }

      // 딜레이 계산
      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffMultiplier,
        useJitter
      );

      // 재시도 콜백
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      logger.info('재시도 예정', {
        context,
        attempt,
        maxRetries,
        delay,
        errorMessage: lastError.message,
      });

      // 대기
      await sleep(delay);
    }
  }

  // 모든 재시도 실패
  logger.error('재시도 모두 실패', lastError as Error, {
    context,
    totalAttempts: attempt,
  });

  throw lastError;
}

/**
 * 결과와 메타데이터를 함께 반환하는 재시도
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const result = await withRetry(fn, {
      ...config,
      onRetry: (error, attempt, delay) => {
        attempts = attempt;
        config.onRetry?.(error, attempt, delay);
      },
    });

    return {
      success: true,
      data: result,
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error | AppError,
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 딜레이 계산 (Exponential Backoff + Jitter)
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  useJitter: boolean
): number {
  // Exponential backoff
  let delay = initialDelay * Math.pow(multiplier, attempt - 1);

  // 최대 딜레이 제한
  delay = Math.min(delay, maxDelay);

  // Jitter 추가 (±25% 변동)
  if (useJitter) {
    const jitterFactor = 0.25;
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * 기본 재시도 가능 여부 판별
 */
function defaultShouldRetry(error: Error | AppError, _attempt: number): boolean {
  // AppError인 경우 isRetryable 확인
  if (error instanceof AppError) {
    return error.isRetryable;
  }

  // 네트워크 관련 에러
  const normalized = normalizeError(error);
  if (normalized.category === 'network') {
    return true;
  }

  // Firebase 일시적 에러
  const retryableFirebaseCodes = [
    'unavailable',
    'resource-exhausted',
    'deadline-exceeded',
    'aborted',
  ];

  if ('code' in error && typeof error.code === 'string') {
    const errorCode = error.code;
    if (retryableFirebaseCodes.some((code) => errorCode.includes(code))) {
      return true;
    }
  }

  // 일반적으로 재시도 불가
  return false;
}

/**
 * 비동기 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * 빠른 재시도 (짧은 딜레이)
 */
export const FAST_RETRY: RetryOptions = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 1.5,
  useJitter: true,
};

/**
 * 표준 재시도
 */
export const STANDARD_RETRY: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  useJitter: true,
};

/**
 * 공격적 재시도 (더 많은 시도)
 */
export const AGGRESSIVE_RETRY: RetryOptions = {
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  useJitter: true,
};

/**
 * 보수적 재시도 (긴 딜레이)
 */
export const CONSERVATIVE_RETRY: RetryOptions = {
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 3,
  useJitter: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 재시도 가능한 함수 생성
 */
export function createRetryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): () => Promise<T> {
  return () => withRetry(fn, options);
}

/**
 * 특정 에러 타입에 대해서만 재시도
 */
export function retryOnErrors<T>(
  fn: () => Promise<T>,
  errorTypes: (new (...args: unknown[]) => Error)[],
  options: Omit<RetryOptions, 'shouldRetry'> = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    shouldRetry: (error) => {
      return errorTypes.some((ErrorType) => error instanceof ErrorType);
    },
  });
}

/**
 * 특정 에러 카테고리에 대해서만 재시도 (AppError용)
 */
export function retryOnCategories<T>(
  fn: () => Promise<T>,
  categories: ErrorCategory[],
  options: Omit<RetryOptions, 'shouldRetry'> = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    shouldRetry: (error) => {
      if (error instanceof AppError) {
        return categories.includes(error.category);
      }
      return false;
    },
  });
}

// ============================================================================
// Export
// ============================================================================

export default {
  withRetry,
  withRetryResult,
  createRetryable,
  retryOnErrors,
  retryOnCategories,
  presets: {
    FAST_RETRY,
    STANDARD_RETRY,
    AGGRESSIVE_RETRY,
    CONSERVATIVE_RETRY,
  },
};
