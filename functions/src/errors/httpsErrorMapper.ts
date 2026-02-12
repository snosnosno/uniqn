/**
 * UNIQN Functions - HttpsError ↔ AppError 매핑
 *
 * @description
 * AppError를 Firebase HttpsError로 변환하는 매퍼
 * onCall 함수 경계에서 사용 — 내부는 AppError, 외부는 HttpsError
 *
 * @version 1.0.0
 */

import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import {
  AppError,
  isAppError,
  isAuthError,
  isValidationError,
  isPermissionError,
  isNotFoundError,
  isBusinessError,
} from './AppError';

/**
 * AppError → HttpsError 변환
 *
 * @description
 * - HttpsError는 그대로 반환
 * - AppError는 카테고리별 적절한 HttpsError 코드로 변환
 * - details에 AppError 메타데이터 포함 (클라이언트에서 세밀한 에러 처리 가능)
 * - 알 수 없는 에러는 internal로 래핑
 */
export function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }

  if (isAppError(error)) {
    const code = mapCategoryToHttpsCode(error);
    return new HttpsError(code, error.userMessage, {
      code: error.code,
      category: error.category,
      severity: error.severity,
      isRetryable: error.isRetryable,
      metadata: error.metadata,
    });
  }

  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
  return new HttpsError('internal', message);
}

/**
 * AppError 카테고리 → FunctionsErrorCode 매핑
 */
function mapCategoryToHttpsCode(error: AppError): FunctionsErrorCode {
  if (isAuthError(error)) return 'unauthenticated';
  if (isValidationError(error)) return 'invalid-argument';
  if (isPermissionError(error)) return 'permission-denied';
  if (isNotFoundError(error)) return 'not-found';
  if (isBusinessError(error)) return 'failed-precondition';
  return 'internal';
}
