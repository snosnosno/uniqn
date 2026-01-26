/**
 * 날짜 범위 유틸리티
 *
 * @description 연속 날짜 그룹화 및 날짜 범위 표시 유틸리티
 * @version 2.0.0 - date/ 폴더로 통합됨, 하위 호환성을 위한 re-export
 *
 * @see src/utils/date/index.ts 새로운 import 경로를 사용하세요
 */

// Types
export type { DateRangeGroup } from './date/grouping';

// Core
export { toDateString } from './date/core';

// Grouping
export {
  areDatesConsecutive,
  areAllDatesConsecutive,
  groupConsecutiveDates,
  formatDateRange,
  getDayCount,
  formatDateRangeWithCount,
  groupRequirementsToDateRanges,
  expandDateRangeToRequirements,
  expandAllDateRangesToRequirements,
  isSingleDate,
  getDateListFromRange,
} from './date/grouping';
