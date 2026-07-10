/**
 * weeklyGrid 도메인 — 주간 배치 그리드(홀덤펍 운영 그리드) 순수 로직 배럴.
 *
 * 설계: docs/planning/2026-06-28-weekly-batch-grid-design.md
 */
export {
  getSoftTargets,
  getSoftTarget,
  withSoftTarget,
  computeShortage,
  type ScheduleWithSoftTargets,
} from './softTargets';

export {
  computeDayCell,
  type GridDayCell,
  type GridDayCellInput,
  type GridBadge,
  type GridBadgeKind,
  type GridDayStatus,
} from './gridSlotState';

export { GRID_BADGE_META, GRID_BADGE_ORDER, type GridBadgeMeta } from './gridBadgeMeta';

export { getWeekRange, type WeekRange } from './weekRange';

export { getSameWeekdayDatesInMonth } from './weekdayDates';

export {
  parseVenueContainer,
  parseVenueContainers,
  VENUE_CONTAINER_COLUMNS,
  type VenueContainer,
} from './venueContainer';

export { parseWeeklyGridFlag } from './weeklyGridFlag';

export { buildGridCells, type GridSummaryRow } from './buildGridCells';

export {
  COPY_LAST_WEEK_SHIFT_DAYS,
  shiftDateByDays,
  toLastWeekDate,
  toThisWeekDate,
  buildCopyLastWeekPayload,
  type CopyLastWeekGroup,
} from './copyLastWeek';

export {
  SLOT_COLOR_TOKENS,
  SLOT_COLOR_CHIPS,
  DEFAULT_SLOT_START_TIME,
  MAX_SLOT_MEMO_LENGTH,
  slotMemoSchema,
  isValidSlotColor,
  assertSlotColor,
  isSafeSlotMemo,
  assertSlotMemo,
  parseSlotStartMinutes,
  compareSlotsByStartTime,
  sortSlotsByStartTime,
  composeTimeSlot,
  parseTimeSlotParts,
  detectSlotConflicts,
  type SlotColorToken,
  type SlotColorChip,
  type SlotConflict,
  type SlotConflictInput,
} from './slotEdit';

export {
  buildWeeklyBatchConfirmNotification,
  WEEKLY_GRID_NOTIFICATION_LINK,
  WEEKLY_BATCH_CONFIRM_TYPE,
  type WeeklyBatchConfirmInput,
  type WeeklyBatchNotificationPayload,
} from './weeklyBatchNotification';
