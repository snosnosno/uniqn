import { STATUS } from '@/constants/statusValues';
import type {
  WorkLogStatus,
  ApplicationStatus,
  ScheduleType,
  AttendanceStatus,
  ConfirmedStaffStatus,
} from './types';
import { WORK_LOG_STATUS_FLOW, WORK_LOG_TERMINAL_STATUSES } from './statusFlow';

interface CancellationCheckable {
  status: ApplicationStatus | string;
  cancellationRequest?: {
    status: 'pending' | 'approved' | 'rejected';
  };
}

export class StatusMapper {
  static toAttendance(status: WorkLogStatus): AttendanceStatus {
    switch (status) {
      case STATUS.WORK_LOG.SCHEDULED:
      case STATUS.WORK_LOG.CANCELLED:
      case STATUS.WORK_LOG.NO_SHOW:
        return STATUS.ATTENDANCE.NOT_STARTED as AttendanceStatus;
      case STATUS.WORK_LOG.CHECKED_IN:
        return STATUS.ATTENDANCE.CHECKED_IN as AttendanceStatus;
      case STATUS.WORK_LOG.CHECKED_OUT:
      case STATUS.WORK_LOG.COMPLETED:
        return STATUS.ATTENDANCE.CHECKED_OUT as AttendanceStatus;
      default:
        return STATUS.ATTENDANCE.NOT_STARTED as AttendanceStatus;
    }
  }

  static workLogToSchedule(status: WorkLogStatus): ScheduleType {
    switch (status) {
      case STATUS.WORK_LOG.SCHEDULED:
      case STATUS.WORK_LOG.CHECKED_IN:
        return STATUS.SCHEDULE.CONFIRMED as ScheduleType;
      case STATUS.WORK_LOG.CHECKED_OUT:
      case STATUS.WORK_LOG.COMPLETED:
        return STATUS.SCHEDULE.COMPLETED as ScheduleType;
      case STATUS.WORK_LOG.CANCELLED:
      case STATUS.WORK_LOG.NO_SHOW:
        return STATUS.SCHEDULE.CANCELLED as ScheduleType;
      default:
        return STATUS.SCHEDULE.CONFIRMED as ScheduleType;
    }
  }

  static applicationToSchedule(status: ApplicationStatus): ScheduleType | null {
    switch (status) {
      case STATUS.APPLICATION.APPLIED:
        return STATUS.SCHEDULE.APPLIED as ScheduleType;
      case STATUS.APPLICATION.CONFIRMED:
      case STATUS.APPLICATION.CANCELLATION_PENDING:
        return STATUS.SCHEDULE.CONFIRMED as ScheduleType;
      case STATUS.APPLICATION.REJECTED:
        return null;
      case STATUS.APPLICATION.CANCELLED:
        return STATUS.SCHEDULE.CANCELLED as ScheduleType;
      case STATUS.APPLICATION.COMPLETED:
        return STATUS.SCHEDULE.COMPLETED as ScheduleType;
      default:
        return null;
    }
  }

  static toConfirmedStaff(status: WorkLogStatus): ConfirmedStaffStatus {
    return status as ConfirmedStaffStatus;
  }

  static canTransition(from: WorkLogStatus, to: WorkLogStatus): boolean {
    const allowedTransitions = WORK_LOG_STATUS_FLOW[from];
    return allowedTransitions.includes(to);
  }

  static getNextValidStatuses(status: WorkLogStatus): WorkLogStatus[] {
    return WORK_LOG_STATUS_FLOW[status] || [];
  }

  static isCancellationPending(item: CancellationCheckable): boolean {
    if (item.status === STATUS.APPLICATION.CANCELLATION_PENDING) {
      return true;
    }

    if (item.cancellationRequest?.status === STATUS.CANCELLATION_REQUEST.PENDING) {
      return true;
    }

    return false;
  }

  static isTerminalStatus(status: WorkLogStatus): boolean {
    return WORK_LOG_TERMINAL_STATUSES.includes(status);
  }
}
