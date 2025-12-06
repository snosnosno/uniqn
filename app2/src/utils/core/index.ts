/**
 * Core 유틸리티 모듈
 *
 * 날짜 처리, 타입 가드, 보안 패턴 등 핵심 유틸리티 통합 export
 *
 * @module utils/core
 *
 * @example
 * ```ts
 * import { DateInput, toDateString, hasXSSPattern } from '@/utils/core';
 *
 * // 타입 사용
 * const date: DateInput = someValue;
 *
 * // 날짜 변환
 * const dateStr = toDateString(timestamp);
 *
 * // 보안 검증
 * if (hasXSSPattern(userInput)) {
 *   // 위험한 입력 처리
 * }
 * ```
 */

// ===== 타입 정의 =====
export type { DateInput, TimestampLike, TimeCalculationInput, TimestampInput } from './dateTypes';

// ===== 타입 가드 =====
export {
  hasToDateMethod,
  hasSecondsProperty,
  isValidDate,
  isISODateString,
  isTimeString,
} from './dateTypeGuards';

// ===== 날짜 변환 =====
export {
  formatDateToISO,
  toDate,
  parseToDate,
  toDateString,
  convertToDateString,
  getTodayString,
  getKoreanDate,
} from './dateConversion';

// ===== 보안 패턴 =====
export {
  XSS_PATTERNS,
  SQL_INJECTION_PATTERNS,
  hasXSSPattern,
  hasSQLInjectionPattern,
  validateNoXSSPatterns,
  isSafeText,
  sanitizeInput,
} from './securityPatterns';
