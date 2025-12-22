/**
 * UNIQN Mobile - 유틸리티 중앙 인덱스
 *
 * @version 1.0.0
 */

// 플랫폼 유틸리티
export {
  isWeb,
  isIOS,
  isAndroid,
  isMobile,
  platformSelect,
  getScreenDimensions,
  getBreakpoint,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
  isDesktop,
  isMobileDevice,
  getOSVersion,
  platformInfo,
} from './platform';

export type { Breakpoint } from './platform';

// 날짜 유틸리티
export {
  toDate,
  toISODateString,
  getTodayString,
  formatDateKorean,
  formatDateShort,
  formatDateWithDay,
  formatDateTime,
  formatTime,
  formatRelativeDate,
  getWeekdayKo,
  dateChecks,
  getDateRange,
  getMonthRange,
  parseTimeSlot,
  calculateWorkDuration,
  minutesToHoursMinutes,
} from './dateUtils';

// 포맷터
export {
  formatNumber,
  formatCurrency,
  formatCurrencyShort,
  formatPhone,
  maskPhone,
  maskName,
  maskEmail,
  formatRole,
  formatRoles,
  formatSalaryType,
  formatSalary,
  formatJobStatus,
  formatPositions,
  formatPercent,
  formatFileSize,
  truncate,
  capitalize,
  padNumber,
} from './formatters';

// 로거
export { logger } from './logger';
export { default } from './logger';

// 에러 처리
export {
  normalizeError,
  getFirebaseErrorMessage,
  isFirebaseError,
  isNetworkError,
  isAuthError,
  isPermissionError,
  type NormalizedError,
} from './errorUtils';

export {
  withErrorHandling,
  withErrorHandlingSync,
  type ErrorHandlingOptions,
} from './withErrorHandling';

export {
  withRetry,
  withRetryResult,
  createRetryable,
  retryOnErrors,
  retryOnCategories,
  FAST_RETRY,
  STANDARD_RETRY,
  AGGRESSIVE_RETRY,
  CONSERVATIVE_RETRY,
  type RetryOptions,
  type RetryResult,
} from './withRetry';

// 보안 유틸리티
export {
  XSS_PATTERNS,
  SQL_INJECTION_PATTERNS,
  hasXSSPattern,
  hasSQLInjectionPattern,
  xssValidation,
  isSafeText,
  sanitizeInput,
  escapeHtml,
  isSafeUrl,
  isValidPhoneNumber,
  isValidEmail,
  secureLog,
  isRateLimited,
  getPasswordStrength,
} from './security';
