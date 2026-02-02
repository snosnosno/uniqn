/**
 * UNIQN Mobile - Assignment 유틸리티 모듈
 *
 * @description Assignment 관련 유틸리티 함수 및 타입 export
 */

// Selection Core (통합 선택 유틸리티)
export {
  // Core functions
  makeSelectionKey,
  parseSelectionKey,
  getDateFromKey,
  getTimeSlotFromKey,
  getRoleFromKey,
  // Toggle functions
  toggleSelection,
  toggleExclusiveByDate,
  toggleGroup,
  getGroupSelectionState,
  // Backward compatibility
  createAssignmentKey,
  getDateFromKeyLegacy,
  // Constants
  DEFAULT_SEPARATOR,
  APPLICANT_SEPARATOR,
} from './selectionCore';

export type {
  SelectionKeySeparator,
  SelectionKeyOptions,
  ParsedSelectionKey,
  ToggleResult,
} from './selectionCore';

// Selection Utils (스케줄 그룹화)
export {
  areTimeSlotsStructureEqual,
  createGroupFromSchedules,
  groupDatedSchedules,
} from './selectionUtils';

export type { SelectionKey, ScheduleGroup } from './selectionUtils';
