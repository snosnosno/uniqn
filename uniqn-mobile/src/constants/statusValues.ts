import type {
  ApplicationStatusType,
  JobPostingStatusType,
  InquiryStatusType,
} from './statusConfig';
import type {
  WorkLogStatus,
  PayrollStatus,
  ScheduleType,
  AttendanceStatus,
  ConfirmedStaffStatus,
} from '@/shared/status/types';
import type { ReportStatus } from '@/types/report';
import type { AnnouncementStatus } from '@/types/announcement';
import type { TournamentApprovalStatus } from '@/types/postingConfig';
import type { CancellationRequestStatus } from '@/types/application';
import type { DeletionRequest } from '@/repositories/interfaces/IUserRepository';

export const APPLICATION_STATUS_VALUES = {
  APPLIED: 'applied',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  CANCELLATION_PENDING: 'cancellation_pending',
} as const satisfies Record<string, ApplicationStatusType>;

export const WORK_LOG_STATUS_VALUES = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const satisfies Record<string, WorkLogStatus>;

export const JOB_POSTING_STATUS_VALUES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  CAPACITY_FULL: 'capacity_full',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  // 운영처(venue) 컨테이너 — 숨김 공고. fail-closed 중앙 deny 대상(repo 베이스쿼리/통계 reader).
  CONTAINER: 'container',
} as const satisfies Record<string, JobPostingStatusType>;

export const INQUIRY_STATUS_VALUES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
} as const satisfies Record<string, InquiryStatusType>;

// DB enum payroll_status = ['pending','completed','failed']와 정합.
// PROCESSING은 DB enum에 없는 UI 표시 전용 값(DB 컬럼에 직접 쓰지 않음).
export const PAYROLL_STATUS_VALUES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const satisfies Record<string, PayrollStatus>;

export const ANNOUNCEMENT_STATUS_VALUES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const satisfies Record<string, AnnouncementStatus>;

export const REPORT_STATUS_VALUES = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const satisfies Record<string, ReportStatus>;

export const TOURNAMENT_APPROVAL_VALUES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const satisfies Record<string, TournamentApprovalStatus>;

export const SCHEDULE_TYPE_VALUES = {
  APPLIED: 'applied',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const satisfies Record<string, ScheduleType>;

export const ATTENDANCE_VALUES = {
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
} as const satisfies Record<string, AttendanceStatus>;

export const CONFIRMED_STAFF_STATUS_VALUES = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const satisfies Record<string, ConfirmedStaffStatus>;

export const CANCELLATION_REQUEST_STATUS_VALUES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const satisfies Record<string, CancellationRequestStatus>;

export const DELETION_REQUEST_STATUS_VALUES = {
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const satisfies Record<string, DeletionRequest['status']>;

export const STATUS = {
  APPLICATION: APPLICATION_STATUS_VALUES,
  WORK_LOG: WORK_LOG_STATUS_VALUES,
  JOB_POSTING: JOB_POSTING_STATUS_VALUES,
  INQUIRY: INQUIRY_STATUS_VALUES,
  PAYROLL: PAYROLL_STATUS_VALUES,
  ANNOUNCEMENT: ANNOUNCEMENT_STATUS_VALUES,
  REPORT: REPORT_STATUS_VALUES,
  TOURNAMENT: TOURNAMENT_APPROVAL_VALUES,
  SCHEDULE: SCHEDULE_TYPE_VALUES,
  ATTENDANCE: ATTENDANCE_VALUES,
  CONFIRMED_STAFF: CONFIRMED_STAFF_STATUS_VALUES,
  CANCELLATION_REQUEST: CANCELLATION_REQUEST_STATUS_VALUES,
  DELETION_REQUEST: DELETION_REQUEST_STATUS_VALUES,
} as const;
