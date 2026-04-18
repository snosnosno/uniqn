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
  modifiedBy?: string;
}

export interface UpdateStaffRoleInput {
  workLogId: string;
  newRole: string;
  reason: string;
  changedBy?: string;
}

export interface DeleteConfirmedStaffInput {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  date: string;
  reason?: string;
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
