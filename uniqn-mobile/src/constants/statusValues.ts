/**
 * UNIQN Mobile - Firestore 쿼리용 상태값 런타임 상수
 *
 * @description where() 쿼리에서 문자열 리터럴 대신 사용하는 상수 객체
 * @version 1.0.0
 *
 * 기존 타입 정의에서 파생된 런타임 상수:
 * - shared/status/types.ts (WorkLogStatus, ApplicationStatus, PayrollStatus)
 * - constants/statusConfig.ts (ApplicationStatusType, JobPostingStatusType, InquiryStatusType)
 * - types/report.ts (ReportStatus)
 * - types/announcement.ts (AnnouncementStatus)
 * - types/postingConfig.ts (TournamentApprovalStatus)
 */

import type { ApplicationStatusType, JobPostingStatusType, InquiryStatusType } from './statusConfig';
import type { WorkLogStatus, PayrollStatus, ScheduleType, AttendanceStatus } from '@/shared/status/types';
import type { ReportStatus } from '@/types/report';
import type { AnnouncementStatus } from '@/types/announcement';
import type { TournamentApprovalStatus } from '@/types/postingConfig';

// ============================================================================
// 상태값 상수
// ============================================================================

export const APPLICATION_STATUS_VALUES = {
  APPLIED: 'applied',
  PENDING: 'pending',
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
} as const satisfies Record<string, WorkLogStatus>;

export const JOB_POSTING_STATUS_VALUES = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  DRAFT: 'draft',
} as const satisfies Record<string, JobPostingStatusType>;

export const INQUIRY_STATUS_VALUES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
} as const satisfies Record<string, InquiryStatusType>;

export const PAYROLL_STATUS_VALUES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
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
} as const satisfies Record<string, ScheduleType>;

export const ATTENDANCE_VALUES = {
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
} as const satisfies Record<string, AttendanceStatus>;

// ============================================================================
// 통합 객체
// ============================================================================

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
} as const;
