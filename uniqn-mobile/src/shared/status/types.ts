export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

export type WorkLogStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';

export type ConfirmedStaffStatus =
  | 'scheduled'
  | 'checked_in'
  | 'checked_out'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ApplicationStatus =
  | 'applied'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellation_pending';

export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

export type PayrollStatus = 'pending' | 'processing' | 'completed';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: '출근 전',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
};

export const WORK_LOG_STATUS_LABELS: Record<WorkLogStatus, string> = {
  scheduled: '예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 완료',
  cancelled: '취소됨',
};

export const CONFIRMED_STAFF_STATUS_LABELS: Record<ConfirmedStaffStatus, string> = {
  scheduled: '출근 예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 대기',
  cancelled: '취소됨',
  no_show: '노쇼',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '지원 완료',
  confirmed: '확정',
  rejected: '거절됨',
  cancelled: '취소됨',
  completed: '근무 완료',
  cancellation_pending: '취소 요청 중',
};

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  applied: '지원 중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소됨',
};

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
};
