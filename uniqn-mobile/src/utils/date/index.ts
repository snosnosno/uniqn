/**
 * 날짜 유틸리티 중앙 배럴 export
 *
 * @description 모든 날짜 관련 유틸리티 함수들의 단일 진입점
 * @version 1.0.0
 */

// Core utilities
export {
  isValidDate,
  normalizeToIsoString,
  toDate,
  toDateValue,
  toISODateString,
  getTodayString,
  toDateString,
  parseDateString,
  generateId,
} from './core';
export type { DateInput } from './core';

// Formatting utilities
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
  formatAppliedDate,
} from './formatting';

// Grouping utilities
export {
  areDatesConsecutive,
  areAllDatesConsecutive,
  groupConsecutiveDates,
  hasGroupableDates,
  formatDateRange,
  getDayCount,
  formatDateRangeWithCount,
  groupRequirementsToDateRanges,
  expandDateRangeToRequirements,
  expandAllDateRangesToRequirements,
  isSingleDate,
} from './grouping';

// Grouping types
export type { DateRangeGroup } from './grouping';

// Validation utilities
export {
  isValidTimeFormat,
  isValidDateFormat,
  parseDate,
  isWithinUrgentDateLimit,
  validateDateCount,
  isDuplicateDate,
  getDateAfterDays,
} from './validation';

// Range utilities
export {
  generateDateRange,
  getMonthRange,
  sortDates,
  parseTimeSlot,
  parseTimeSlotToDate,
} from './ranges';
