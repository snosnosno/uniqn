/**
 * UNIQN Functions - 통합 에러 핸들러
 *
 * @description
 * onCall 함수의 catch 블록에서 사용하는 통합 에러 처리 유틸리티
 * AppError → HttpsError 변환 + 구조화 로깅 + 민감정보 마스킹
 *
 * @version 1.0.0
 *
 * @example
 * export const myFunction = onCall({ region: 'asia-northeast3' }, async (request) => {
 *   try {
 *     requireAuth(request);
 *     // ... business logic
 *   } catch (error) {
 *     throw handleFunctionError(error, { operation: 'myFunction' });
 *   }
 * });
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { isAppError } from './AppError';
import { toHttpsError } from './httpsErrorMapper';

// ============================================================================
// Types
// ============================================================================

interface ErrorHandlerOptions {
  /** 함수/작업명 (로깅용) */
  operation: string;
  /** 추가 컨텍스트 (민감정보 자동 마스킹) */
  context?: Record<string, unknown>;
}

// ============================================================================
// Sensitive Data Masking (모바일앱 serviceErrorHandler.ts와 동일)
// ============================================================================

const SENSITIVE_FIELDS = [
  'userid', 'staffid', 'uid', 'email', 'phone',
  'password', 'token', 'apikey', 'secret', 'credential',
  'applicantid', 'ownerid',
];

/**
 * 민감 정보 마스킹
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
        masked[key] = `${value.slice(0, 3)}***${value.slice(-3)}`;
      } else if (typeof value === 'string' && value.length > 0) {
        masked[key] = '***';
      } else {
        masked[key] = '[MASKED]';
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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
 * onCall 함수 통합 에러 핸들러
 *
 * @description
 * - HttpsError → 로깅 후 그대로 throw
 * - AppError → 로깅 후 HttpsError로 변환하여 throw
 * - 기타 에러 → 로깅 후 internal HttpsError로 래핑하여 throw
 *
 * @returns never (항상 throw)
 */
export function handleFunctionError(
  error: unknown,
  options: ErrorHandlerOptions
): HttpsError {
  const { operation, context = {} } = options;
  const safeContext = maskSensitiveData(context);

  // 1. HttpsError는 로깅 후 그대로 반환
  if (error instanceof HttpsError) {
    logger.error(`${operation}: ${error.message}`, {
      code: error.code,
      ...safeContext,
    });
    return error;
  }

  // 2. AppError는 구조화 로깅 후 HttpsError로 변환
  if (isAppError(error)) {
    const logLevel = error.severity === 'critical' || error.severity === 'high'
      ? 'error' : 'warn';

    logger[logLevel](`${operation}: [${error.code}] ${error.message}`, {
      errorCode: error.code,
      category: error.category,
      severity: error.severity,
      metadata: error.metadata,
      ...safeContext,
    });

    return toHttpsError(error);
  }

  // 3. 알 수 없는 에러
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${operation}: 예상치 못한 에러`, {
    error: errorMessage,
    stack: errorStack,
    ...safeContext,
  });

  return toHttpsError(error);
}

// ============================================================================
// Trigger Error Handler (onDocument* 용)
// ============================================================================

/**
 * Firestore 트리거 함수 에러 핸들러
 *
 * @description
 * onDocumentCreated/Updated/Deleted 등의 catch 블록에서 사용
 * 트리거 함수는 HttpsError를 throw하지 않으므로 로깅만 수행
 */
export function handleTriggerError(
  error: unknown,
  options: ErrorHandlerOptions
): void {
  const { operation, context = {} } = options;
  const safeContext = maskSensitiveData(context);

  if (isAppError(error)) {
    logger.error(`${operation}: [${error.code}] ${error.message}`, {
      errorCode: error.code,
      category: error.category,
      severity: error.severity,
      metadata: error.metadata,
      ...safeContext,
    });
    return;
  }

  logger.error(`${operation}: 에러 발생`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...safeContext,
  });
}
