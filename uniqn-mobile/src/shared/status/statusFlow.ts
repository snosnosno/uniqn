import type { WorkLogStatus, ApplicationStatus } from './types';

export const WORK_LOG_STATUS_FLOW: Record<WorkLogStatus, WorkLogStatus[]> = {
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out', 'no_show'],
  checked_out: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const APPLICATION_STATUS_FLOW: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['cancellation_pending'],
  cancellation_pending: ['confirmed', 'cancelled'],
  rejected: [],
  cancelled: [],
  completed: [],
};

export const WORK_LOG_TERMINAL_STATUSES: WorkLogStatus[] = ['completed', 'cancelled', 'no_show'];

export const APPLICATION_TERMINAL_STATUSES: ApplicationStatus[] = [
  'rejected',
  'cancelled',
  'completed',
];
