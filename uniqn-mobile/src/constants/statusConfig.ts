import type { BadgeVariant } from '@/components/ui/Badge';
import {
  APPLICATION_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  CONFIRMED_STAFF_STATUS_LABELS,
  PAYROLL_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
} from '@/shared/status';
import type {
  ApplicationStatus,
  AttendanceStatus,
  ConfirmedStaffStatus,
  PayrollStatus,
  ScheduleType,
} from '@/shared/status';

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  textColor?: string;
  bgColor?: string;
  hexColor?: string;
}

export interface AttendanceStatusConfig extends StatusConfig {
  bgColor: string;
  textColor: string;
}

export type ApplicationStatusType = ApplicationStatus;

export type ApplicationStatsKey =
  | 'total'
  | 'applied'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellationPending';

export const STATUS_TO_STATS_KEY: Record<ApplicationStatusType, ApplicationStatsKey | null> = {
  applied: 'applied',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancellation_pending: 'cancellationPending',
};

export const APPLICATION_STATUS: Record<ApplicationStatusType, StatusConfig> = {
  applied: {
    label: APPLICATION_STATUS_LABELS.applied,
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#D4AF37',
  },
  confirmed: {
    label: APPLICATION_STATUS_LABELS.confirmed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  rejected: {
    label: APPLICATION_STATUS_LABELS.rejected,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
  cancelled: {
    label: APPLICATION_STATUS_LABELS.cancelled,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
  completed: {
    label: APPLICATION_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  cancellation_pending: {
    label: APPLICATION_STATUS_LABELS.cancellation_pending,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
};

export type ScheduleStatusType = ScheduleType;

export const SCHEDULE_STATUS: Record<ScheduleStatusType, StatusConfig> = {
  applied: {
    label: SCHEDULE_TYPE_LABELS.applied,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
  confirmed: {
    label: SCHEDULE_TYPE_LABELS.confirmed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  completed: {
    label: SCHEDULE_TYPE_LABELS.completed,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
  cancelled: {
    label: SCHEDULE_TYPE_LABELS.cancelled,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
};

export type AttendanceStatusType = AttendanceStatus;

export const ATTENDANCE_STATUS: Record<AttendanceStatusType, AttendanceStatusConfig> = {
  not_started: {
    label: ATTENDANCE_STATUS_LABELS.not_started,
    variant: 'default',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    hexColor: '#9A9078',
  },
  checked_in: {
    label: ATTENDANCE_STATUS_LABELS.checked_in,
    variant: 'success',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    textColor: 'text-success-700 dark:text-success-300',
    hexColor: '#22C55E',
  },
  checked_out: {
    label: ATTENDANCE_STATUS_LABELS.checked_out,
    variant: 'primary',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-300',
    hexColor: '#D4AF37',
  },
};

export type PayrollStatusType = PayrollStatus;

export const PAYROLL_STATUS: Record<PayrollStatusType, StatusConfig> = {
  pending: {
    label: PAYROLL_STATUS_LABELS.pending,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
  processing: {
    label: PAYROLL_STATUS_LABELS.processing,
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#D4AF37',
  },
  completed: {
    label: PAYROLL_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
};

export type ConfirmedStaffStatusType = ConfirmedStaffStatus;

export const CONFIRMED_STAFF_STATUS: Record<ConfirmedStaffStatusType, StatusConfig> = {
  scheduled: {
    label: CONFIRMED_STAFF_STATUS_LABELS.scheduled,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-300',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
  checked_in: {
    label: CONFIRMED_STAFF_STATUS_LABELS.checked_in,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-300',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  checked_out: {
    label: CONFIRMED_STAFF_STATUS_LABELS.checked_out,
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-300',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#D4AF37',
  },
  completed: {
    label: CONFIRMED_STAFF_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-300',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  cancelled: {
    label: CONFIRMED_STAFF_STATUS_LABELS.cancelled,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-300',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
  no_show: {
    label: CONFIRMED_STAFF_STATUS_LABELS.no_show,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-300',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
};

export type JobPostingStatusType =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'active'
  | 'closed'
  | 'cancelled'
  | 'expired'
  | 'rejected';

export const JOB_POSTING_STATUS: Record<JobPostingStatusType, StatusConfig> = {
  draft: {
    label: '임시저장',
    variant: 'secondary',
    textColor: 'text-secondary-500 dark:text-secondary-400',
    bgColor: 'bg-secondary-50 dark:bg-surface',
    hexColor: '#A89C84',
  },
  pending: {
    label: '승인대기',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
  approved: {
    label: '승인완료',
    variant: 'info',
    textColor: 'text-info-600 dark:text-info-400',
    bgColor: 'bg-info-100 dark:bg-info-900/30',
    hexColor: '#2563EB',
  },
  active: {
    label: '모집중',
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
  closed: {
    label: '마감',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
  cancelled: {
    label: '취소됨',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
  expired: {
    label: '만료됨',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
  rejected: {
    label: '거절됨',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
};

export type InquiryStatusType = 'open' | 'in_progress' | 'closed';

export const INQUIRY_STATUS: Record<InquiryStatusType, StatusConfig> = {
  open: {
    label: '접수',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#D4AF37',
  },
  in_progress: {
    label: '처리중',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
  closed: {
    label: '답변 완료',
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: '#22C55E',
  },
};

export type AnnouncementPriorityType = 'urgent' | 'important' | 'normal';

export const ANNOUNCEMENT_PRIORITY: Record<AnnouncementPriorityType, StatusConfig> = {
  urgent: {
    label: '긴급',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: '#DC2626',
  },
  important: {
    label: '중요',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: '#D4A017',
  },
  normal: {
    label: '일반',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: '#9A9078',
  },
};

export function getStatusConfig<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): StatusConfig {
  if (!status || !(status in configMap)) {
    return {
      label: '상태 없음',
      variant: 'default',
      textColor: 'text-secondary-500 dark:text-secondary-400',
      bgColor: 'bg-secondary-100 dark:bg-surface',
      hexColor: '#9A9078',
    };
  }

  return configMap[status as T];
}

export function getStatusLabel<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).label;
}

export function getStatusHexColor<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).hexColor ?? '#9A9078';
}

export function getStatusVariant<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): BadgeVariant {
  return getStatusConfig(configMap, status).variant;
}

export const attendanceConfig = ATTENDANCE_STATUS;
