import type { ApplicantWithDetails } from '@/services';
import type { Assignment, PostingType } from '@/types';

export interface ApplicantCardProps {
  applicant: ApplicantWithDetails;
  onConfirm?: (applicant: ApplicantWithDetails, selectedAssignments?: Assignment[]) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
  showActions?: boolean;
  showConfirmationHistory?: boolean;
  initialExpanded?: boolean;
  postingType?: PostingType;
  daysPerWeek?: number;
  startTime?: string;
  /** 최근 180일 노쇼 횟수 (S3-3). 목록이 배치 조회해 내려준다 — 카드가 개별 조회하면 N+1. */
  noShowCount?: number;
}

export interface AssignmentDisplay {
  date: string;
  formattedDate: string;
  timeSlot: string;
  timeSlotDisplay: string;
  role: string;
  roleLabel: string;
}

export interface GroupedAssignmentDisplay {
  groupId: string;
  dateRange: {
    start: string;
    end: string;
    dates: string[];
    totalDays: number;
    isConsecutive: boolean;
  };
  timeSlotDisplay: string;
  roleLabel: string;
  role: string;
  timeSlot: string;
  items: AssignmentDisplay[];
}

export interface IconColors {
  checked: string;
  unchecked: string;
}
