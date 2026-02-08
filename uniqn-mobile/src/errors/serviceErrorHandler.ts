/**
 * UNIQN Mobile - 서비스 에러 핸들링 헬퍼
 *
 * @description 서비스 레이어의 일관된 에러 처리를 위한 통합 헬퍼
 * @version 1.0.0
 *
 * @example
 * // 기본 사용
 * catch (error) {
 *   throw handleServiceError(error, {
 *     operation: '공고 조회',
 *     component: 'jobService',
 *     context: { jobPostingId }
 *   });
 * }
 *
 * @example
 * // 에러 무시 (캐시 삭제 등)
 * catch (error) {
 *   handleSilentError(error, { operation: '캐시 삭제', component: 'cacheService' });
 * }
 *
 * @example
 * // 기본값 반환
 * catch (error) {
 *   return handleErrorWithDefault(error, null, { operation: '데이터 조회' });
 * }
 */

import { logger } from '@/utils/logger';
import { AppError, isAppError } from './AppError';
import { mapFirebaseError, isFirebaseError } from './firebaseErrorMapper';
import { toError, normalizeError } from './errorUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * 서비스 에러 핸들링 옵션
 */
export interface ServiceErrorOptions {
  /** 작업명 (로깅용) */
  operation: string;
  /** 컴포넌트/서비스명 */
  component?: string;
  /** 추가 컨텍스트 (민감정보 자동 마스킹) */
  context?: Record<string, unknown>;
}

/**
 * Silent 에러 핸들링 옵션
 */
export interface SilentErrorOptions extends ServiceErrorOptions {
  /** 로그 레벨 (기본: warn) */
  logLevel?: 'warn' | 'info' | 'debug';
}

// ============================================================================
// Sensitive Data Masking
// ============================================================================

/**
 * 민감 값 마스킹 유틸리티
 *
 * @description 이메일, ID, 전화번호 등 민감 값을 마스킹 처리
 *
 * @example
 * maskValue('user@example.com', 'email') // 'use***@example.com'
 * maskValue('abc123xyz', 'id')           // 'abc***xyz'
 * maskValue('01012345678', 'phone')      // '010****5678'
 */
export function maskValue(value: string, type: 'email' | 'id' | 'phone' = 'id'): string {
  if (value.length <= 6) return '***';

  switch (type) {
    case 'email': {
      const atIndex = value.indexOf('@');
      if (atIndex > 0) {
        const local = value.slice(0, atIndex);
        const domain = value.slice(atIndex);
        const visibleLen = Math.min(3, local.length);
        return `${local.slice(0, visibleLen)}***${domain}`;
      }
      return `${value.slice(0, 3)}***${value.slice(-3)}`;
    }
    case 'phone':
      return `${value.slice(0, 3)}****${value.slice(-4)}`;
    case 'id':
    default:
      return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }
}

/** 민감 정보 필드 목록 (대소문자 무시) */
const SENSITIVE_FIELDS = [
  'userid',
  'staffid',
  'uid',
  'email',
  'phone',
  'password',
  'token',
  'apikey',
  'secret',
  'credential',
  'applicantid',
  'ownerid',
];

/**
 * 민감 정보 마스킹
 *
 * @description userId, staffId, uid 등의 값을 마스킹 처리
 *
 * @example
 * maskSensitiveData({ userId: 'abc123xyz', name: 'John' })
 * // { userId: 'abc***xyz', name: 'John' }
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

    if (isSensitive) {
      if (typeof value === 'string' && value.length > 6) {
        // 앞 3자, 뒤 3자만 노출
        masked[key] = `${value.slice(0, 3)}***${value.slice(-3)}`;
      } else if (typeof value === 'string' && value.length > 0) {
        masked[key] = '***';
      } else {
        masked[key] = '[MASKED]';
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 중첩 객체 처리
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

// ============================================================================
// Core Handler
// ============================================================================

/**
 * 서비스 에러 통합 핸들러
 *
 * @description
 * - 에러 정규화 (AppError로 변환)
 * - 민감정보 마스킹 로깅
 * - AppError 체인 유지 (BusinessError 등은 그대로 throw)
 * - Firebase 에러 자동 매핑
 *
 * @example
 * catch (error) {
 *   throw handleServiceError(error, {
 *     operation: '공고 조회',
 *     component: 'jobService',
 *     context: { jobPostingId }
 *   });
 * }
 */
export function handleServiceError(error: unknown, options: ServiceErrorOptions): AppError {
  const { operation, component, context = {} } = options;

  // 1. 민감정보 마스킹
  const safeContext = maskSensitiveData(context);

  // 2. 이미 AppError인 경우 (BusinessError, PermissionError 등)
  if (isAppError(error)) {
    logger.appError(error, {
      operation,
      component,
      ...safeContext,
    });
    return error;
  }

  // 3. Firebase 에러인 경우 매핑
  let appError: AppError;
  if (isFirebaseError(error)) {
    appError = mapFirebaseError(error);
  } else {
    appError = normalizeError(error);
  }

  // 4. 로깅
  logger.error(`${operation} 실패`, toError(error), {
    operation,
    component,
    errorCode: appError.code,
    errorCategory: appError.category,
    ...safeContext,
  });

  return appError;
}

// ============================================================================
// Specialized Handlers
// ============================================================================

/**
 * Silent 에러 핸들러 (로깅만, throw 안함)
 *
 * @description 실패해도 괜찮은 작업에 사용 (캐시 삭제, 분석 이벤트 등)
 * 명시적으로 에러를 무시함을 표현
 *
 * @example
 * try {
 *   await analytics.track(...);
 * } catch (error) {
 *   handleSilentError(error, { operation: 'Analytics 이벤트', component: 'analyticsService' });
 * }
 */
export function handleSilentError(error: unknown, options: SilentErrorOptions): void {
  const { operation, component, context = {}, logLevel = 'warn' } = options;

  // 민감정보 마스킹
  const safeContext = maskSensitiveData(context);

  // 에러 정보 추출
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = isAppError(error) ? error.code : undefined;

  const logContext = {
    operation,
    component,
    errorMessage,
    errorCode,
    silent: true,
    ...safeContext,
  };

  // 로그 레벨에 따라 출력
  switch (logLevel) {
    case 'debug':
      logger.debug(`${operation} - 에러 발생 (무시됨)`, logContext);
      break;
    case 'info':
      logger.info(`${operation} - 에러 발생 (무시됨)`, logContext);
      break;
    case 'warn':
    default:
      logger.warn(`${operation} - 에러 발생 (무시됨)`, logContext);
      break;
  }
}

/**
 * 에러 발생 시 기본값 반환 핸들러
 *
 * @description 에러 발생 시 null/기본값 반환이 필요한 경우
 * Silent 로깅 후 기본값 반환
 *
 * @example
 * try {
 *   return await fetchData();
 * } catch (error) {
 *   return handleErrorWithDefault(error, null, {
 *     operation: '데이터 조회',
 *     component: 'dataService'
 *   });
 * }
 */
export function handleErrorWithDefault<T>(
  error: unknown,
  defaultValue: T,
  options: SilentErrorOptions
): T {
  handleSilentError(error, options);
  return defaultValue;
}

/**
 * 서비스 함수 래퍼
 *
 * @description 비동기 서비스 함수를 일관된 에러 처리로 래핑
 * 기존 withErrorHandling보다 서비스에 특화된 버전
 *
 * @example
 * export const getJobPosting = wrapService(
 *   async (jobId: string) => {
 *     const doc = await getDoc(...);
 *     return doc.data();
 *   },
 *   { operation: '공고 상세 조회', component: 'jobService' }
 * );
 */
export function wrapService<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: ServiceErrorOptions
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleServiceError(error, options);
    }
  };
}

/**
 * 동기 서비스 함수 래퍼
 */
export function wrapSyncService<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: ServiceErrorOptions
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    try {
      return fn(...args);
    } catch (error) {
      throw handleServiceError(error, options);
    }
  };
}

// ============================================================================
// Utility Exports (Re-export for convenience)
// ============================================================================

export {
  // Re-export commonly used functions
  isAppError,
  toError,
  normalizeError,
  mapFirebaseError,
  isFirebaseError,
};

// Re-export AppError type
export type { AppError };
