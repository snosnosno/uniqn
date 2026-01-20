/**
 * 상태 흐름 규칙 정의
 *
 * @description Phase 1 - 상태 매핑 통합
 * 각 상태에서 허용되는 다음 상태를 정의
 */

import type { WorkLogStatus, ApplicationStatus } from './types';

/**
 * WorkLog 상태 흐름
 *
 * @description 각 상태에서 전이할 수 있는 유효한 상태 목록
 */
export const WORK_LOG_STATUS_FLOW: Record<WorkLogStatus, WorkLogStatus[]> = {
  scheduled: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: ['completed'],
  completed: [], // 종료 상태
  cancelled: [], // 종료 상태
};

/**
 * Application 상태 흐름
 *
 * @description 각 상태에서 전이할 수 있는 유효한 상태 목록
 */
export const APPLICATION_STATUS_FLOW: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  applied: ['pending', 'confirmed', 'rejected', 'cancelled'],
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'cancellation_pending'],
  cancellation_pending: ['confirmed', 'cancelled'],
  rejected: [], // 종료 상태
  cancelled: [], // 종료 상태
  completed: [], // 종료 상태
};

/**
 * WorkLog 종료 상태
 */
export const WORK_LOG_TERMINAL_STATUSES: WorkLogStatus[] = [
  'completed',
  'cancelled',
];

/**
 * Application 종료 상태
 */
export const APPLICATION_TERMINAL_STATUSES: ApplicationStatus[] = [
  'rejected',
  'cancelled',
  'completed',
];
