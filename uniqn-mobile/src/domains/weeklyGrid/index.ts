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

export {
  parseVenueContainer,
  parseVenueContainers,
  VENUE_CONTAINER_COLUMNS,
  type VenueContainer,
} from './venueContainer';

export { parseWeeklyGridFlag } from './weeklyGridFlag';

export { buildGridCells, type GridSummaryRow } from './buildGridCells';
