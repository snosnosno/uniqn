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
