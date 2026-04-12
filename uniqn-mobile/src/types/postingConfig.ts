import {
  getDateFromRequirement as getDateFromRequirementBase,
  sortDateRequirements as sortDateRequirementsBase,
  type DateSpecificRequirement as DateSpecificRequirementV2,
  type TimeSlot as TimeSlotV2,
} from './jobPosting/dateRequirement';
import type { SalaryInfo } from './jobPosting';

export type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';

export type TournamentApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface FixedConfig {
  durationDays: 7;
  expiresAt: Date;
  createdAt: Date;
}

export interface FixedJobPostingData {
  requiredRolesWithCount?: RoleWithCount[];
}

export interface RoleWithCount {
  role?: string;
  name?: string;
  count: number;
  filled?: number;
  salary?: SalaryInfo;
}

export interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  resubmittedAt?: Date;
  submittedAt: Date;
}

export interface UrgentConfig {
  createdAt: Date;
  priority: 'high';
}

export type TimeSlot = TimeSlotV2;
export type DateSpecificRequirement = DateSpecificRequirementV2;

export const POSTING_TYPE_LABELS: Record<PostingType, string> = {
  regular: '일반',
  fixed: '고정',
  tournament: '대회',
  urgent: '긴급',
};

export const POSTING_TYPE_BADGE_STYLES: Record<
  PostingType,
  { bgClass: string; textClass: string; darkBgClass: string; darkTextClass: string }
> = {
  regular: {
    bgClass: 'bg-secondary-100',
    textClass: 'text-secondary-700',
    darkBgClass: 'dark:bg-surface',
    darkTextClass: 'dark:text-secondary-300',
  },
  fixed: {
    bgClass: 'bg-primary-100',
    textClass: 'text-primary-700',
    darkBgClass: 'dark:bg-primary-900/30',
    darkTextClass: 'dark:text-primary-300',
  },
  tournament: {
    bgClass: 'bg-primary-100',
    textClass: 'text-primary-700',
    darkBgClass: 'dark:bg-primary-900/30',
    darkTextClass: 'dark:text-primary-300',
  },
  urgent: {
    bgClass: 'bg-error-100',
    textClass: 'text-error-700',
    darkBgClass: 'dark:bg-error-900/30',
    darkTextClass: 'dark:text-error-300',
  },
};

export function getDateFromRequirement(req: DateSpecificRequirement): string {
  return getDateFromRequirementBase(req);
}

export function sortDateRequirements(
  requirements: DateSpecificRequirement[]
): DateSpecificRequirement[] {
  return sortDateRequirementsBase(requirements);
}
