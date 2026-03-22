import { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument } from './common';
import type { StaffRole } from './role';
import type { Assignment } from './assignment';
import type { OriginalApplication, ConfirmationHistoryEntry } from './applicationHistory';
import type { PreQuestionAnswer } from './preQuestion';
import type { JobPosting } from './jobPosting';

type CancellationRequestTimestamp = string | Timestamp;

export type ApplicationStatus =
  | 'applied'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellation_pending';

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

export interface Application extends FirebaseDocument {
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantRole?: StaffRole;
  applicantNickname?: string;
  applicantPhotoURL?: string;

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
  processedAt?: Timestamp;
  rejectionReason?: string;
  confirmedAt?: Timestamp;
  cancelledAt?: Timestamp;

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
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  cancelled: { bg: 'bg-gray-100 dark:bg-surface', text: 'text-gray-500 dark:text-gray-400' },
  completed: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  cancellation_pending: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
};

export interface RequestCancellationInput {
  applicationId: string;
  reason: string;
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
