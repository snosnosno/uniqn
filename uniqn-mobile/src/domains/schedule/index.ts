/**
 * 스케줄 도메인 모듈
 *
 * @description Phase 5 - 스케줄 병합 로직 분리
 * 스케줄 관련 도메인 로직을 중앙에서 export
 */

// ScheduleMerger 타입
export type {
  MergeOptions,
  DateGroup,
  ApplicationGroup,
  GroupByApplicationResult,
  GroupByApplicationOptions,
  MergerScheduleStats,
} from './ScheduleMerger';

// WorkLogCreator 타입
export type {
  TimeSlotInfo,
  WorkLogCreateInput,
  WorkLogData,
  BatchCreateResult,
} from './WorkLogCreator';

// 스케줄 병합 유틸리티
export { ScheduleMerger } from './ScheduleMerger';

// WorkLog 생성 유틸리티
export { WorkLogCreator } from './WorkLogCreator';
