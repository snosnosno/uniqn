/**
 * 날짜 범위 유틸리티
 *
 * @deprecated `@/utils/date`에서 직접 import하세요.
 * ```typescript
 * // Before
 * import { groupConsecutiveDates } from '@/utils/dateRangeUtils';
 *
 * // After
 * import { groupConsecutiveDates } from '@/utils/date';
 * ```
 *
 * @description 하위 호환성을 위한 re-export 파일. 신규 코드에서 사용 금지.
 * @version 2.0.0 - date/ 폴더로 통합됨
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
