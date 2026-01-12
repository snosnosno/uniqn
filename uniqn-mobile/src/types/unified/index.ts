/**
 * UNIQN Mobile - 통합 타입 모듈
 *
 * @description 공고 타입 통합을 위한 정규화된 타입들
 * @version 1.0.0
 */

// ============================================================================
// Role Types & Functions
// ============================================================================

export type { RoleInfo } from './role';

export {
  getRoleDisplayName,
  createRoleInfo,
  isRoleFilled,
  getRemainingCount,
  findRoleById,
  filterAvailableRoles,
  getTotalRequiredCount,
  getTotalFilledCount,
  isAllRolesFilled,
} from './role';

// ============================================================================
// TimeSlot Types & Functions
// ============================================================================

export type { TimeSlotInfo } from './timeSlot';

export {
  createTimeSlotInfo,
  formatTimeSlotDisplay,
  getSlotTotalRequired,
  getSlotTotalFilled,
  isSlotFilled,
} from './timeSlot';

// ============================================================================
// Schedule Types & Functions
// ============================================================================

export type {
  JobScheduleType,
  DatedScheduleInfo,
  FixedScheduleInfo,
  NormalizedSchedule,
  NormalizedScheduleList,
} from './schedule';

export {
  isDatedSchedule,
  isFixedSchedule,
  createDatedSchedule,
  createFixedSchedule,
  extractAllDates,
  extractAllRoles,
  formatFixedScheduleDisplay,
  formatDateDisplay,
} from './schedule';
