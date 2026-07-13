import type { UnsubscribeFn } from '@/types/common';
import type { WorkLogStatus } from '@/shared/status';
import type { WorkLog } from '@/types';

export interface UpdateRoleContext {
  workLogId: string;
  newRole: string;
  isStandardRole: boolean;
  reason: string;
  /** 감사 기록용(폴백 'system' 존재). 인가에 사용하지 말 것 */
  changedBy: string;
  /** 인가 주체. 서비스 레이어가 requireCurrentUser() 로 채운다 */
  actorId: string;
}

export interface UpdateConfirmedStaffWorkTimeContext {
  workLogId: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  reason: string;
  modifiedBy: string;
  /** 인가 주체. 서비스 레이어가 requireCurrentUser() 로 채운다 */
  actorId: string;
}

export interface DeleteConfirmedStaffContext {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  reason?: string;
}

export interface MarkNoShowContext {
  workLogId: string;
  /** 인가 주체(세션에서 파생한 현재 사용자 uid). 공고 소유자 id 를 재주입하지 말 것. */
  actorId: string;
  reason?: string;
}

export interface CancelNoShowContext {
  workLogId: string;
  /** 인가 주체(세션에서 파생한 현재 사용자 uid). 공고 소유자 id 를 재주입하지 말 것. */
  actorId: string;
}

export interface UpdateStaffStatusContext {
  workLogId: string;
  /** 인가 주체(세션에서 파생한 현재 사용자 uid). 공고 소유자 id 를 재주입하지 말 것. */
  actorId: string;
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
  cancelNoShow(context: CancelNoShowContext): Promise<void>;
  updateStatus(context: UpdateStaffStatusContext): Promise<void>;
  addDirectStaff(context: AddDirectStaffContext): Promise<string[]>;
  removeDirectStaff(context: RemoveDirectStaffContext): Promise<void>;
  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): UnsubscribeFn;
}
