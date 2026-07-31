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

// DB enum payroll_status = ['pending','completed','failed'] 와 **정확히 일치**한다.
// 예전엔 여기에 'processing' 이 하나 더 있었다. DB enum 에 없는 값이라 어떤 경로로도 저장될 수
// 없었고, 실제로 쓰기 코드가 0곳이었다 — 라벨·색상만 4곳에 정의된 채 영원히 안 그려지는
// 분기를 만들고 있었다(GroupedSettlementCard 의 hasProcessing 분기가 그 산물). 그래서 제거했다.
// 반대로 'failed' 는 **지우지 않는다**: DB enum 에 실재하므로 타입에서 빼면 그런 행이 하나라도
// 생겼을 때 zod 파싱이 터져 목록이 통째로 사라진다(#194 클래스). 쓰는 코드가 없다는 것과
// 저장될 수 없다는 것은 다른 말이다.
export type PayrollStatus = 'pending' | 'completed' | 'failed';

// 화면 어휘는 2단이다 — 사장이 실제로 하는 판단은 "지급했나 / 아직인가" 뿐이고,
// 그룹핑·집계·정산 게이트는 이미 전부 `=== 'completed'` 이분법으로만 동작하고 있었다.
// 'failed' 는 스태프 입장에서 "아직 못 받았다" 이므로 pending 과 같은 칸에 든다.
export type SettlementDisplayStatus = 'pending' | 'completed';

/** 데이터 상태(3값) → 화면 어휘(2값). 정산 상태를 화면에 그리는 모든 경로는 이걸 거친다. */
export function toSettlementDisplayStatus(
  status: PayrollStatus | null | undefined
): SettlementDisplayStatus {
  return status === 'completed' ? 'completed' : 'pending';
}

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
export const PAYROLL_STATUS_LABELS: Record<SettlementDisplayStatus, string> = {
  pending: '정산 대기',
  completed: '정산 완료',
};
