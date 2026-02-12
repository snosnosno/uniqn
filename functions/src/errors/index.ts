/**
 * UNIQN Functions - 에러 시스템 배럴 export
 */

// Core
export {
  AppError,
  AuthError,
  ValidationError,
  PermissionError,
  NotFoundError,
  BusinessError,
  ERROR_CODES,
  ERROR_MESSAGES,
  isAppError,
  isAuthError,
  isValidationError,
  isPermissionError,
  isNotFoundError,
  isBusinessError,
} from './AppError';
export type { ErrorCategory, ErrorSeverity } from './AppError';

// HttpsError Mapper
export { toHttpsError } from './httpsErrorMapper';

// Error Handler
export {
  handleFunctionError,
  handleTriggerError,
  maskSensitiveData,
} from './errorHandler';

// Validators
export {
  requireAuth,
  requireRole,
  requireString,
  requireMaxLength,
  requireEnum,
} from './validators';
