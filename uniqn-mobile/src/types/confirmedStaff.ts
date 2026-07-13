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

export interface UpdateStaffRoleInput {
  workLogId: string;
  newRole: string;
  reason: string;
  /** @deprecated 무시됨 — confirmedStaffService가 세션 actorId로 강제 스탬프한다(위조 차단). 호출자가 넘겨도 반영되지 않는다. */
  changedBy?: string;
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
