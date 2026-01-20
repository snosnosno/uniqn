/**
 * 상태 관리 모듈
 *
 * @description Phase 1 - 상태 매핑 통합
 * 모든 상태 관련 타입, 상수, 유틸리티를 중앙에서 export
 */

// 타입 및 라벨
export type {
  AttendanceStatus,
  WorkLogStatus,
  ConfirmedStaffStatus,
  ApplicationStatus,
  ScheduleType,
  PayrollStatus,
} from './types';

export {
  ATTENDANCE_STATUS_LABELS,
  WORK_LOG_STATUS_LABELS,
  CONFIRMED_STAFF_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  PAYROLL_STATUS_LABELS,
} from './types';

// 상태 흐름 규칙
export {
  WORK_LOG_STATUS_FLOW,
  APPLICATION_STATUS_FLOW,
  WORK_LOG_TERMINAL_STATUSES,
  APPLICATION_TERMINAL_STATUSES,
} from './statusFlow';

// 상태 변환 유틸리티
export { StatusMapper } from './StatusMapper';
