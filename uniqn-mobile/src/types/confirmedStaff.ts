import type { ConfirmedStaffStatus } from '@/shared/status';
import type { TimeInput } from '@/shared/time/types';
import type { WorkLog, PayrollStatus } from './schedule';

export type { ConfirmedStaffStatus };

export interface ConfirmedStaff {
  id: string;
  staffId: string;
  staffName: string;
  staffNickname?: string;
  staffPhotoURL?: string;
  staffPhotoURLBlurhash?: string | null;
  phone?: string;
  role: string;
  customRole?: string;
  date: string;
  status: ConfirmedStaffStatus;
  isNoShow?: boolean;
  noShowReason?: string;
  noShowAt?: TimeInput;
  timeSlot?: string;
  /** 배치 색상 태그(근무표 슬롯 색상 토큰). 카드에 색 스와치로 표시(#4). */
  color?: string;
  checkInTime?: TimeInput;
  checkOutTime?: TimeInput;
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  notes?: string;
  isRead?: boolean;
  workLog?: WorkLog;
}

export interface ConfirmedStaffGroup {
  date: string;
  formattedDate: string;
  staff: ConfirmedStaff[];
  isToday: boolean;
  isPast: boolean;
  stats: {
    total: number;
    /**
     * 아직 출근하지 않은 인원(`status === 'scheduled'`).
     *
     * 🚨 `total - checkedIn` 으로 대신 재지 말 것. `checkedIn` 은 정확일치라 퇴근하면 빠지고,
     *    그 뺄셈은 퇴근·취소·노쇼를 전부 '미출근' 으로 접는다 — 전원이 정상 퇴근한 저녁에
     *    미출근이 최대가 된다. 상태가 하나 늘 때마다 조용히 틀려지므로 열거로 센다.
     */
    scheduled: number;
    checkedIn: number;
    completed: number;
    noShow: number;
  };
}

export interface UpdateWorkTimeInput {
  workLogId: string;
  checkInTime: TimeInput;
  checkOutTime: TimeInput;
  reason: string;
  /** @deprecated 무시됨 — confirmedStaffService가 세션 actorId로 강제 스탬프한다(위조 차단). 호출자가 넘겨도 반영되지 않는다. */
  modifiedBy?: string;
}

export interface DeleteConfirmedStaffInput {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  date: string;
  reason?: string;
}

/**
 * 스태프 직접 추가 — 단일 배정 입력
 * @description role 은 staff_role 키('dealer'|'floor'|'serving'|'manager'|'staff'|'other').
 *   'other' 인 경우 customRole 에 표시명을 담는다(confirm_application 평탄화 규약과 동일).
 */
export interface DirectStaffAssignmentInput {
  date: string;
  role: string;
  customRole?: string;
  timeSlot?: string;
  notes?: string;
}

/**
 * 스태프 직접 추가 입력 (지원서 없이 앱 가입자를 스태프로 추가)
 */
export interface AddDirectStaffInput {
  jobPostingId: string;
  staffId: string;
  assignments: DirectStaffAssignmentInput[];
}

export interface ConfirmedStaffFilters {
  date?: string;
  status?: ConfirmedStaffStatus;
  role?: string;
  payrollStatus?: PayrollStatus;
}

export type GroupedConfirmedStaff = Record<string, ConfirmedStaff[]>;

export interface ConfirmedStaffStats {
  total: number;
  scheduled: number;
  checkedIn: number;
  checkedOut: number;
  completed: number;
  cancelled: number;
  noShow: number;
  settled: number;
}
