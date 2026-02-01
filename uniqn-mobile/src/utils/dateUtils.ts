/**
 * UNIQN Mobile - 날짜 유틸리티
 *
 * @description 날짜/시간 처리 유틸리티 함수들
 * @version 2.0.0 - date/ 폴더로 통합됨, 하위 호환성을 위한 re-export
 *
 * @see src/utils/date/index.ts 새로운 import 경로를 사용하세요
 */

// Core
export {
  toDate,
  toISODateString,
  getTodayString,
  toDateString,
  parseDateString,
  generateId,
} from './date/core';

// Formatting
export {
  formatDateKorean,
  formatDateShort,
  formatDateWithDay,
  formatDateTime,
  formatTime,
  formatRelativeDate,
  getWeekdayKo,
  formatDate,
  formatRelativeTime,
  formatDateShortWithDay,
  formatDateKoreanWithDay,
} from './date/formatting';

// Validation
export { dateChecks } from './date/validation';

// Ranges
export {
  getDateRange,
  getMonthRange,
  parseTimeSlot,
  parseTimeSlotToDate,
  calculateWorkDuration,
  minutesToHoursMinutes,
} from './date/ranges';
