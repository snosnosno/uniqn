/**
 * UNIQN Mobile - 지원서 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument, StaffRole } from './common';

/**
 * 지원 상태
 */
export type ApplicationStatus =
  | 'applied' // 지원 완료
  | 'pending' // 대기 중
  | 'confirmed' // 확정
  | 'rejected' // 거절
  | 'cancelled' // 취소 (지원자가 취소)
  | 'waitlisted' // 대기자
  | 'completed'; // 근무 완료

/**
 * 지원서 타입
 */
export interface Application extends FirebaseDocument {
  // 지원자 정보
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantRole?: StaffRole;

  // 공고 정보
  jobPostingId: string;
  jobPostingTitle?: string;
  jobPostingDate?: string;

  // 지원 정보
  status: ApplicationStatus;
  appliedRole: StaffRole;
  message?: string; // 지원 메시지

  // 처리 정보
  processedBy?: string;
  processedAt?: Timestamp;
  rejectionReason?: string;

  // 대기자 관련
  waitlistOrder?: number;
  waitlistPromotedAt?: Timestamp;

  // 메타데이터
  isRead?: boolean;
  notes?: string;
}

/**
 * 지원서 생성 입력
 */
export interface CreateApplicationInput {
  jobPostingId: string;
  appliedRole: StaffRole;
  message?: string;
}

/**
 * 지원서 필터
 */
export interface ApplicationFilters {
  status?: ApplicationStatus | ApplicationStatus[];
  jobPostingId?: string;
  applicantId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * 지원 확정 입력
 */
export interface ConfirmApplicationInput {
  applicationId: string;
  notes?: string;
}

/**
 * 지원 거절 입력
 */
export interface RejectApplicationInput {
  applicationId: string;
  reason?: string;
}

/**
 * 지원서 통계
 */
export interface ApplicationStats {
  total: number;
  applied: number;
  pending: number;
  confirmed: number;
  rejected: number;
  waitlisted: number;
  completed: number;
}

/**
 * 지원 상태 라벨
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '지원 완료',
  pending: '검토 중',
  confirmed: '확정',
  rejected: '거절',
  cancelled: '취소됨',
  waitlisted: '대기자',
  completed: '완료',
};

/**
 * 지원 상태 색상 (NativeWind 클래스)
 */
export const APPLICATION_STATUS_COLORS: Record<
  ApplicationStatus,
  {
    bg: string;
    text: string;
  }
> = {
  applied: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  confirmed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  waitlisted: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
  },
  completed: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};
