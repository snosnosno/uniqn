/**
 * UNIQN Functions - 공용 입력 검증 유틸리티
 *
 * @description
 * onCall 함수에서 반복되는 인증/권한/파라미터 검증 패턴을 중앙화
 * 검증 실패 시 AppError를 throw (handleFunctionError에서 HttpsError로 변환)
 *
 * @version 1.0.0
 *
 * @example
 * export const myFunction = onCall({ region: 'asia-northeast3' }, async (request) => {
 *   try {
 *     const userId = requireAuth(request);
 *     requireRole(request, 'admin');
 *     const postingId = requireString(request.data.postingId, '공고 ID');
 *     // ... business logic
 *   } catch (error) {
 *     throw handleFunctionError(error, { operation: 'myFunction' });
 *   }
 * });
 */

import type { CallableRequest } from 'firebase-functions/v2/https';
import { AuthError, ValidationError, PermissionError, ERROR_CODES } from './AppError';

// ============================================================================
// Auth Validators
// ============================================================================

/**
 * 인증 필수 검증
 * @returns userId (request.auth.uid)
 * @throws AuthError (E2012)
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      userMessage: '로그인이 필요합니다.',
    });
  }
  return request.auth.uid;
}

/**
 * 역할 권한 검증
 * @throws PermissionError (E4001)
 */
export function requireRole(
  request: CallableRequest,
  ...allowedRoles: string[]
): void {
  const userRole = request.auth?.token?.role as string | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage: `${allowedRoles.join(' 또는 ')} 권한이 필요합니다.`,
      metadata: { requiredRoles: allowedRoles, actualRole: userRole },
    });
  }
}

// ============================================================================
// Input Validators
// ============================================================================

/**
 * 필수 문자열 파라미터 검증
 * @throws ValidationError (E3001)
 */
export function requireString(
  value: unknown,
  fieldName: string,
): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: `${fieldName}이(가) 필요합니다.`,
      field: fieldName,
    });
  }
  return value.trim();
}

/**
 * 문자열 최대 길이 검증
 * @throws ValidationError (E3004)
 */
export function requireMaxLength(
  value: string,
  maxLength: number,
  fieldName: string,
): void {
  if (value.length > maxLength) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
      userMessage: `${fieldName}은(는) 최대 ${maxLength}자까지 입력 가능합니다.`,
      field: fieldName,
      metadata: { maxLength, actualLength: value.length },
    });
  }
}

/**
 * 열거형 값 검증
 * @throws ValidationError (E3002)
 */
export function requireEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
): T {
  if (!value || typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `올바른 ${fieldName}을(를) 선택해주세요.`,
      field: fieldName,
      metadata: { allowedValues, actualValue: value },
    });
  }
  return value as T;
}
