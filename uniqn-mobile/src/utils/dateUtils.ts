/**
 * UNIQN Mobile - 날짜 유틸리티
 *
 * @deprecated `@/utils/date`에서 직접 import하세요.
 * ```typescript
 * // Before
 * import { formatDateKorean } from '@/utils/dateUtils';
 *
 * // After
 * import { formatDateKorean } from '@/utils/date';
 * ```
 *
 * @description 하위 호환성을 위한 re-export 파일. 신규 코드에서 사용 금지.
 * @version 2.0.0 - date/ 폴더로 통합됨
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
