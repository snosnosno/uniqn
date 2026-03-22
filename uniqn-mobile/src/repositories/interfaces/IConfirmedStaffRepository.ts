import type { Unsubscribe } from 'firebase/firestore';
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

export interface IConfirmedStaffRepository {
  getByJobPostingId(jobPostingId: string): Promise<WorkLog[]>;
  getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]>;
  updateRoleWithTransaction(context: UpdateRoleContext): Promise<void>;
  updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void>;
  markAsNoShow(context: MarkNoShowContext): Promise<void>;
  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): Unsubscribe;
}
