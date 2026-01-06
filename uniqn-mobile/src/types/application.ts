/**
 * UNIQN Mobile - 지원서 관련 타입 정의
 *
 * @version 2.0.0
 * @description Assignment v2.0 + confirmationHistory 이력 관리 지원
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument, StaffRole } from './common';
import type { Assignment } from './assignment';
import type { OriginalApplication, ConfirmationHistoryEntry } from './applicationHistory';
import type { PreQuestionAnswer } from './preQuestion';
import type { JobPosting } from './jobPosting';

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
 * 모집 유형
 */
export type RecruitmentType = 'event' | 'fixed';

/**
 * 지원서 타입
 *
 * @description v2.0: Assignment 배열 + confirmationHistory 지원
 */
export interface Application extends FirebaseDocument {
  // === 지원자 정보 ===
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantRole?: StaffRole;

  // === 공고 정보 (레거시 호환) ===
  jobPostingId: string;
  jobPostingTitle?: string;
  jobPostingDate?: string;

  // === 공고 정보 (v2.0 표준 필드) ===
  /** 표준 이벤트 ID (CLAUDE.md 준수) */
  eventId?: string;
  /** 공고 ID (하위 호환) */
  postId?: string;
  /** 공고 제목 */
  postTitle?: string;

  // === 지원 정보 ===
  status: ApplicationStatus;
  /** 레거시: 단일 역할 */
  appliedRole: StaffRole;
  message?: string;
  /** 모집 유형 구분 */
  recruitmentType?: RecruitmentType;

  // === Assignment v2.0 (Single Source of Truth) ===
  /**
   * 핵심 배정 정보 - 다중 역할/시간/날짜 조합
   * @description 이 필드가 있으면 v2.0 지원서, 없으면 레거시
   */
  assignments?: Assignment[];

  // === 히스토리 관리 ===
  /**
   * 최초 지원 데이터 보존 (확정/취소 추적용)
   * @description 최초 확정 시에만 생성됨
   */
  originalApplication?: OriginalApplication;

  /**
   * 확정/취소 이력
   * @description 각 확정/취소 이벤트 기록 (감사 추적)
   */
  confirmationHistory?: ConfirmationHistoryEntry[];

  // === 사전질문 답변 ===
  preQuestionAnswers?: PreQuestionAnswer[];

  // === 처리 정보 ===
  processedBy?: string;
  processedAt?: Timestamp;
  rejectionReason?: string;
  /** 확정 시간 */
  confirmedAt?: Timestamp;
  /** 취소 시간 */
  cancelledAt?: Timestamp;

  // === 대기자 관련 ===
  waitlistOrder?: number;
  waitlistPromotedAt?: Timestamp;

  // === 메타데이터 ===
  isRead?: boolean;
  notes?: string;

  // === 공고 정보 (조회 시 조인) ===
  jobPosting?: Partial<JobPosting>;
}

/**
 * 지원서 생성 입력 (레거시)
 */
export interface CreateApplicationInput {
  jobPostingId: string;
  appliedRole: StaffRole;
  message?: string;
}

/**
 * 지원서 생성 입력 v2.0
 *
 * @description Assignment 배열 + 사전질문 답변 지원
 */
export interface CreateApplicationInputV2 {
  jobPostingId: string;
  /** 다중 역할/시간/날짜 선택 */
  assignments: Assignment[];
  /** 사전질문 답변 */
  preQuestionAnswers?: PreQuestionAnswer[];
  /** 지원 메시지 */
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
 * 지원 확정 입력 (레거시)
 */
export interface ConfirmApplicationInput {
  applicationId: string;
  notes?: string;
}

/**
 * 지원 확정 입력 v2.0
 *
 * @description 선택적 Assignment 지정 지원 (일부만 확정 가능)
 */
export interface ConfirmApplicationInputV2 {
  applicationId: string;
  /** 확정할 assignments (미지정 시 전체 확정) */
  selectedAssignments?: Assignment[];
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
