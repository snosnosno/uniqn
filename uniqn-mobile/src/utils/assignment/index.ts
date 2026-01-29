/**
 * UNIQN Mobile - Assignment 유틸리티 모듈
 *
 * @description Assignment 관련 유틸리티 함수 및 타입 export
 */

export {
  makeSelectionKey,
  areTimeSlotsStructureEqual,
  createGroupFromSchedules,
  groupDatedSchedules,
} from './selectionUtils';

export type { SelectionKey, ScheduleGroup } from './selectionUtils';
