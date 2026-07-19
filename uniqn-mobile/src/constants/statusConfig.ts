import { SECONDARY_PALETTE, PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';
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
    hexColor: PRIMARY_COLORS[300],
  },
  confirmed: {
    label: APPLICATION_STATUS_LABELS.confirmed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  rejected: {
    label: APPLICATION_STATUS_LABELS.rejected,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
  cancelled: {
    label: APPLICATION_STATUS_LABELS.cancelled,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  completed: {
    label: APPLICATION_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  cancellation_pending: {
    label: APPLICATION_STATUS_LABELS.cancellation_pending,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
};

export type ScheduleStatusType = ScheduleType;

export const SCHEDULE_STATUS: Record<ScheduleStatusType, StatusConfig> = {
  applied: {
    label: SCHEDULE_TYPE_LABELS.applied,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
  confirmed: {
    label: SCHEDULE_TYPE_LABELS.confirmed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  completed: {
    label: SCHEDULE_TYPE_LABELS.completed,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  cancelled: {
    label: SCHEDULE_TYPE_LABELS.cancelled,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
};

export type AttendanceStatusType = AttendanceStatus;

export const ATTENDANCE_STATUS: Record<AttendanceStatusType, AttendanceStatusConfig> = {
  not_started: {
    label: ATTENDANCE_STATUS_LABELS.not_started,
    variant: 'default',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    hexColor: SECONDARY_PALETTE[500],
  },
  checked_in: {
    label: ATTENDANCE_STATUS_LABELS.checked_in,
    variant: 'success',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    textColor: 'text-success-700 dark:text-success-300',
    hexColor: STATUS_COLORS.success,
  },
  checked_out: {
    label: ATTENDANCE_STATUS_LABELS.checked_out,
    variant: 'primary',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-300',
    hexColor: PRIMARY_COLORS[300],
  },
};

export type PayrollStatusType = PayrollStatus;

export const PAYROLL_STATUS: Record<PayrollStatusType, StatusConfig> = {
  pending: {
    label: PAYROLL_STATUS_LABELS.pending,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
  processing: {
    label: PAYROLL_STATUS_LABELS.processing,
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: PRIMARY_COLORS[300],
  },
  completed: {
    label: PAYROLL_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  failed: {
    label: PAYROLL_STATUS_LABELS.failed,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
};

export type ConfirmedStaffStatusType = ConfirmedStaffStatus;

export const CONFIRMED_STAFF_STATUS: Record<ConfirmedStaffStatusType, StatusConfig> = {
  scheduled: {
    label: CONFIRMED_STAFF_STATUS_LABELS.scheduled,
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-300',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  checked_in: {
    label: CONFIRMED_STAFF_STATUS_LABELS.checked_in,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-300',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  checked_out: {
    label: CONFIRMED_STAFF_STATUS_LABELS.checked_out,
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-300',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: PRIMARY_COLORS[300],
  },
  completed: {
    label: CONFIRMED_STAFF_STATUS_LABELS.completed,
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-300',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  cancelled: {
    label: CONFIRMED_STAFF_STATUS_LABELS.cancelled,
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-300',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
  no_show: {
    label: CONFIRMED_STAFF_STATUS_LABELS.no_show,
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-300',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
};

export type JobPostingStatusType =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'active'
  | 'capacity_full'
  | 'closed'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  | 'container';

export const JOB_POSTING_STATUS: Record<JobPostingStatusType, StatusConfig> = {
  draft: {
    label: '임시저장',
    variant: 'secondary',
    textColor: 'text-secondary-500 dark:text-secondary-400',
    bgColor: 'bg-secondary-50 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[400],
  },
  pending: {
    label: '승인대기',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
  approved: {
    label: '승인완료',
    variant: 'info',
    textColor: 'text-info-600 dark:text-info-400',
    bgColor: 'bg-info-100 dark:bg-info-900/30',
    hexColor: STATUS_COLORS.info,
  },
  active: {
    label: '모집중',
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
  capacity_full: {
    label: '정원 마감',
    variant: 'secondary',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  closed: {
    label: '마감',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  cancelled: {
    label: '취소됨',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
  expired: {
    label: '만료됨',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
  rejected: {
    label: '거절됨',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
  // 운영처(venue) 컨테이너 — 숨김 상태. fail-closed 로 공개/운영자 목록에 노출되지 않으므로
  // 일반 UI 뱃지로는 표시되지 않으나, Record<JobPostingStatusType, …> 타입 완전성을 위해 정의.
  container: {
    label: '지점',
    variant: 'secondary',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
  },
};

export type InquiryStatusType = 'open' | 'in_progress' | 'closed';

export const INQUIRY_STATUS: Record<InquiryStatusType, StatusConfig> = {
  open: {
    label: '접수',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: PRIMARY_COLORS[300],
  },
  in_progress: {
    label: '처리중',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
  closed: {
    label: '답변 완료',
    variant: 'success',
    textColor: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    hexColor: STATUS_COLORS.success,
  },
};

export type AnnouncementPriorityType = 'urgent' | 'important' | 'normal';

export const ANNOUNCEMENT_PRIORITY: Record<AnnouncementPriorityType, StatusConfig> = {
  urgent: {
    label: '긴급',
    variant: 'error',
    textColor: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    hexColor: STATUS_COLORS.error,
  },
  important: {
    label: '중요',
    variant: 'warning',
    textColor: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    hexColor: STATUS_COLORS.warning,
  },
  normal: {
    label: '일반',
    variant: 'default',
    textColor: 'text-secondary-600 dark:text-secondary-400',
    bgColor: 'bg-secondary-100 dark:bg-surface',
    hexColor: SECONDARY_PALETTE[500],
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
      hexColor: SECONDARY_PALETTE[500],
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
  return getStatusConfig(configMap, status).hexColor ?? SECONDARY_PALETTE[500];
}

export function getStatusVariant<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): BadgeVariant {
  return getStatusConfig(configMap, status).variant;
}

export const attendanceConfig = ATTENDANCE_STATUS;
