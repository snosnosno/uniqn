export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

export type WorkLogStatus =
  | 'scheduled'
  | 'checked_in'
  | 'checked_out'
  | 'completed'
  | 'cancelled'
  | 'no_show';

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

// 'no_show' 는 work_log 의 no_show 를 그대로 승격시킨 값이다. 예전에는 cancelled 로 접혀
// 스태프 화면에 "이 일정이 취소되었습니다"만 떴다 — 평판·정산에 불리한 기록이 남은 걸
// 정작 본인만 모르고 이의 제기 기회를 놓쳤다.
export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// DB enum payroll_status = ['pending','completed','failed']. 'processing'는 UI 표시 전용 값.
export type PayrollStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
  cancelled: '취소',
  no_show: '노쇼',
};

export const CONFIRMED_STAFF_STATUS_LABELS: Record<ConfirmedStaffStatus, string> = {
  scheduled: '출근 예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 대기',
  cancelled: '취소',
  no_show: '노쇼',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '지원 완료',
  confirmed: '확정',
  rejected: '거절',
  cancelled: '취소',
  completed: '근무 완료',
  cancellation_pending: '취소 요청 중',
};

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  applied: '지원 중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  // 구인자 화면(CONFIRMED_STAFF_STATUS_LABELS)과 같은 단어를 쓴다 — 같은 사건을
  // 양쪽이 다른 이름으로 부르면 이의 제기 대화가 어긋난다.
  no_show: '노쇼',
};

// 스케줄 상세 모달(ScheduleDetailModal)의 헤더가 SCHEDULE_TYPE_LABELS.completed('완료')를 동시에
// 노출하므로, 정산 배지는 접두어를 붙여 근무 "완료"와 정산 "완료"가 같은 화면에서 겹치지 않게 한다.
export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  pending: '정산 대기',
  processing: '정산 중',
  completed: '정산 완료',
  failed: '정산 실패',
};
