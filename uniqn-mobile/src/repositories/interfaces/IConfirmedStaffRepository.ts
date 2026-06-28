import type { UnsubscribeFn } from '@/types/common';
import type { WorkLogStatus } from '@/shared/status';
import type { WorkLog } from '@/types';

export interface UpdateRoleContext {
  workLogId: string;
  newRole: string;
  isStandardRole: boolean;
  reason: string;
  changedBy: string;
}

export interface UpdateConfirmedStaffWorkTimeContext {
  workLogId: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  reason: string;
  modifiedBy: string;
}

export interface DeleteConfirmedStaffContext {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  reason?: string;
}

export interface MarkNoShowContext {
  workLogId: string;
  ownerId: string;
  reason?: string;
}

export interface UpdateStaffStatusContext {
  workLogId: string;
  ownerId: string;
  status: WorkLogStatus;
}

export interface ConfirmedStaffSubscriptionCallbacks {
  onUpdate: (workLogs: WorkLog[]) => void;
  onError?: (error: Error) => void;
}

export interface AddDirectStaffAssignment {
  date: string;
  role: string;
  customRole?: string;
  timeSlot?: string;
  notes?: string;
}

export interface AddDirectStaffContext {
  jobPostingId: string;
  staffId: string;
  assignments: AddDirectStaffAssignment[];
}

export interface RemoveDirectStaffContext {
  workLogId: string;
}

export interface IConfirmedStaffRepository {
  getByJobPostingId(jobPostingId: string): Promise<WorkLog[]>;
  getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]>;
  updateRoleWithTransaction(context: UpdateRoleContext): Promise<void>;
  updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void>;
  markAsNoShow(context: MarkNoShowContext): Promise<void>;
  updateStatus(context: UpdateStaffStatusContext): Promise<void>;
  addDirectStaff(context: AddDirectStaffContext): Promise<string[]>;
  removeDirectStaff(context: RemoveDirectStaffContext): Promise<void>;
  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): UnsubscribeFn;
}
