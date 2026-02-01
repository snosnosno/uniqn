/**
 * 상태 타입 정의
 *
 * @description Phase 1 - 상태 매핑 통합
 * 모든 상태 타입을 중앙 집중식으로 관리
 */

// =============================================================================
// 출석/근무 상태
// =============================================================================

/**
 * 출석 상태 (UI 표시용)
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

/**
 * WorkLog 상태 (전체 lifecycle)
 */
export type WorkLogStatus =
  | 'scheduled' // 예정됨
  | 'checked_in' // 출근 완료
  | 'checked_out' // 퇴근 완료
  | 'completed' // 정산 완료
  | 'cancelled'; // 취소됨

/**
 * 확정 스태프 출퇴근 상태 (WorkLog.status 확장)
 */
export type ConfirmedStaffStatus =
  | 'scheduled' // 출근 예정
  | 'checked_in' // 출근 완료
  | 'checked_out' // 퇴근 완료
  | 'completed' // 근무 완료 (정산 대기)
  | 'cancelled' // 취소됨
  | 'no_show'; // 노쇼

// =============================================================================
// 지원/스케줄 상태
// =============================================================================

/**
 * 지원 상태
 */
export type ApplicationStatus =
  | 'applied' // 지원 완료
  | 'pending' // 대기 중
  | 'confirmed' // 확정
  | 'rejected' // 거절
  | 'cancelled' // 취소 (지원자가 취소)
  | 'completed' // 근무 완료
  | 'cancellation_pending'; // 취소 요청 대기 중

/**
 * 스케줄 타입
 */
export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

// =============================================================================
// 정산 상태
// =============================================================================

/**
 * 정산 상태
 */
export type PayrollStatus = 'pending' | 'processing' | 'completed';

// =============================================================================
// 상태 라벨 (UI 표시용)
// =============================================================================

/**
 * 출석 상태 라벨
 */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: '출근 전',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
};

/**
 * WorkLog 상태 라벨
 */
export const WORK_LOG_STATUS_LABELS: Record<WorkLogStatus, string> = {
  scheduled: '예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 완료',
  cancelled: '취소됨',
};

/**
 * 확정 스태프 상태 라벨
 */
export const CONFIRMED_STAFF_STATUS_LABELS: Record<ConfirmedStaffStatus, string> = {
  scheduled: '출근 예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 대기',
  cancelled: '취소됨',
  no_show: '노쇼',
};

/**
 * 지원 상태 라벨
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '지원 완료',
  pending: '검토 중',
  confirmed: '확정',
  rejected: '거절됨',
  cancelled: '취소됨',
  completed: '근무 완료',
  cancellation_pending: '취소 요청 중',
};

/**
 * 스케줄 타입 라벨
 */
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  applied: '지원 중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소됨',
};

/**
 * 정산 상태 라벨
 */
export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
};
