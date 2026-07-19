import type { ApplicationStatus } from '@/shared/status';
import type { FirebaseDocument } from './common';
import type { StaffRole } from './role';
import type { Assignment } from './assignment';
import type { OriginalApplication, ConfirmationHistoryEntry } from './applicationHistory';
import type { PreQuestionAnswer } from './preQuestion';
import type { JobPosting } from './jobPosting';

export type { ApplicationStatus };

type CancellationRequestTimestamp = string | Date;

export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

interface CancellationRequestBase {
  requestedAt: CancellationRequestTimestamp;
  reason: string;
}

interface CancellationRequestPending extends CancellationRequestBase {
  status: 'pending';
  reviewedAt?: never;
  reviewedBy?: never;
  rejectionReason?: never;
}

interface CancellationRequestApproved extends CancellationRequestBase {
  status: 'approved';
  reviewedAt: CancellationRequestTimestamp;
  reviewedBy: string;
  rejectionReason?: never;
}

interface CancellationRequestRejected extends CancellationRequestBase {
  status: 'rejected';
  reviewedAt: CancellationRequestTimestamp;
  reviewedBy: string;
  rejectionReason: string;
}

export type CancellationRequest =
  | CancellationRequestPending
  | CancellationRequestApproved
  | CancellationRequestRejected;

export type RecruitmentType = 'event' | 'fixed';

// createdAt/updatedAt 는 FirebaseDocument<string> 상속 — 런타임 진실 = ISO string
// (application.schema 의 timestampSchema). View 에서 Date 가 필요하면 toDate() 로 변환.
// 잔여: processedAt/confirmedAt/cancelledAt 도 런타임 string 이나 applicationHistory
// (ConfirmationHistoryEntry.confirmedAt = 런타임 Date) 체인과 얽혀 별도 스코프로 분리.
export interface Application extends FirebaseDocument<string> {
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantRole?: StaffRole;
  applicantNickname?: string;
  applicantPhotoURL?: string;
  /** impeccable v2 §18 — photoURL placeholder 용 blurhash 해시 (DB null 허용) */
  applicantPhotoURLBlurhash?: string | null;

  jobPostingId: string;
  jobPostingTitle?: string;
  jobPostingDate?: string;

  status: ApplicationStatus;
  customRole?: string;
  message?: string;
  recruitmentType?: RecruitmentType;

  assignments: Assignment[];

  originalApplication?: OriginalApplication;
  confirmationHistory?: ConfirmationHistoryEntry[];

  preQuestionAnswers?: PreQuestionAnswer[];

  processedBy?: string;
  processedAt?: Date;
  rejectionReason?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;

  isRead?: boolean;
  notes?: string;

  cancellationRequest?: CancellationRequest;

  jobPosting?: JobPosting;
}

export interface CreateApplicationInput {
  jobPostingId: string;
  assignments: Assignment[];
  preQuestionAnswers?: PreQuestionAnswer[];
  message?: string;
  /** 개보법 §17 — 지원 시점 제3자 제공 동의 timestamp (ISO 8601) */
  provisionConsentAt: string;
  /** THIRD_PARTY_CONSENT_VERSION_TAG (예: v1-2026-05-13) */
  provisionConsentVersion: string;
}

export interface ApplicationFilters {
  status?: ApplicationStatus | ApplicationStatus[];
  jobPostingId?: string;
  applicantId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ConfirmApplicationInput {
  applicationId: string;
  notes?: string;
}

export interface ConfirmApplicationInputV2 {
  applicationId: string;
  selectedAssignments?: Assignment[];
  notes?: string;
}

export interface RejectApplicationInput {
  applicationId: string;
  reason?: string;
}

export interface ApplicationStats {
  total: number;
  applied: number;
  confirmed: number;
  rejected: number;
  cancelled: number;
  completed: number;
  cancellationPending: number;
}

export const APPLICATION_STATUS_COLORS: Record<
  ApplicationStatus,
  {
    bg: string;
    text: string;
  }
> = {
  applied: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-700 dark:text-primary-300',
  },
  confirmed: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    text: 'text-success-700 dark:text-success-300',
  },
  rejected: { bg: 'bg-error-100 dark:bg-error-900/30', text: 'text-error-700 dark:text-error-300' },
  cancelled: {
    bg: 'bg-secondary-100 dark:bg-surface',
    text: 'text-secondary-500 dark:text-secondary-400',
  },
  completed: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    text: 'text-success-700 dark:text-success-300',
  },
  cancellation_pending: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    text: 'text-warning-700 dark:text-warning-300',
  },
};

export interface RequestCancellationInput {
  applicationId: string;
  reason: string;
  wantsSubstitutePost?: boolean;
}

export interface ReviewCancellationInput {
  applicationId: string;
  approved: boolean;
  rejectionReason?: string;
}

export const CANCELLATION_STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  pending: '검토 대기',
  approved: '승인',
  rejected: '거절',
};
