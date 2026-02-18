/**
 * UNIQN Mobile - 지원서 관련 타입 정의
 *
 * @version 3.1.0
 * @description Assignment 필수화 + confirmationHistory 이력 관리 + 취소 요청 시스템 지원
 *
 * ## 주요 필드
 * - `jobPostingId`: 공고 ID
 * - `jobPostingTitle`: 공고 제목
 * - `assignments`: 역할/날짜/시간대 배열
 *
 * ## 상태 흐름
 * applied → pending → confirmed → completed
 *                   ↘ rejected
 *                   ↘ cancelled
 *                   ↘ cancellation_pending → cancelled (승인) / confirmed (거절)
 */

import { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument } from './common';
import type { StaffRole } from './role';
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
  | 'completed' // 근무 완료
  | 'cancellation_pending'; // 취소 요청 대기 중

/**
 * 취소 요청 상태
 */
export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * 취소 요청 기본 필드
 */
interface CancellationRequestBase {
  /** 요청 시간 */
  requestedAt: string;
  /** 취소 사유 (필수) */
  reason: string;
}

/**
 * 대기 중인 취소 요청
 */
interface CancellationRequestPending extends CancellationRequestBase {
  status: 'pending';
  reviewedAt?: never;
  reviewedBy?: never;
  rejectionReason?: never;
}

/**
 * 승인된 취소 요청
 */
interface CancellationRequestApproved extends CancellationRequestBase {
  status: 'approved';
  /** 검토 시간 (필수) */
  reviewedAt: string;
  /** 검토자 ID (필수) */
  reviewedBy: string;
  rejectionReason?: never;
}

/**
 * 거절된 취소 요청
 */
interface CancellationRequestRejected extends CancellationRequestBase {
  status: 'rejected';
  /** 검토 시간 (필수) */
  reviewedAt: string;
  /** 검토자 ID (필수) */
  reviewedBy: string;
  /** 거절 사유 (필수) */
  rejectionReason: string;
}

/**
 * 취소 요청 정보 (Discriminated Union)
 *
 * @description 확정된 지원에 대해 스태프가 취소를 요청하고,
 *              구인자가 승인/거절하는 워크플로우를 지원
 *
 * @example
 * // 상태별 타입 가드 사용
 * if (cancellationRequest.status === 'rejected') {
 *   console.log(cancellationRequest.rejectionReason); // 타입 안전
 * }
 */
export type CancellationRequest =
  | CancellationRequestPending
  | CancellationRequestApproved
  | CancellationRequestRejected;

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
  /** 지원자 닉네임 */
  applicantNickname?: string;
  /** 지원자 프로필 사진 URL */
  applicantPhotoURL?: string;

  // === 공고 정보 ===
  /** 공고 ID - JobPosting 컬렉션의 문서 ID를 참조 */
  jobPostingId: string;
  /** 공고 제목 (조회 편의를 위한 비정규화) */
  jobPostingTitle?: string;
  /** 공고 근무일 (조회 편의를 위한 비정규화) */
  jobPostingDate?: string;

  // === 지원 정보 ===
  status: ApplicationStatus;
  /** 커스텀 역할명 (role이 'other'일 때) */
  customRole?: string;
  message?: string;
  /** 모집 유형 구분 */
  recruitmentType?: RecruitmentType;

  // === Assignment (Single Source of Truth) ===
  /**
   * 핵심 배정 정보 - 다중 역할/시간/날짜 조합
   * @description 역할, 날짜, 시간대 정보는 이 필드에서 추출
   * @see getPrimaryRole() - 대표 역할 추출
   * @see getAppliedDateInfo() - 날짜/시간 정보 추출
   */
  assignments: Assignment[];

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

  // === 메타데이터 ===
  isRead?: boolean;
  notes?: string;

  // === 취소 요청 (v2.1) ===
  /**
   * 취소 요청 정보
   * @description 확정된 지원에 대한 취소 요청 (스태프 → 구인자 승인 필요)
   */
  cancellationRequest?: CancellationRequest;

  // === 공고 정보 (조회 시 조인) ===
  jobPosting?: Partial<JobPosting>;
}

/**
 * 지원서 생성 입력
 *
 * @description Assignment 배열 + 사전질문 답변 지원
 */
export interface CreateApplicationInput {
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
 *
 * @description ApplicationStatus의 모든 상태에 대응하는 카운트 필드 포함
 * @note cancelled, cancellation_pending 상태도 포함
 */
export interface ApplicationStats {
  total: number;
  applied: number;
  pending: number;
  confirmed: number;
  rejected: number;
  cancelled: number;
  completed: number;
  /** 취소 요청 대기 중 (status: cancellation_pending) */
  cancellationPending: number;
}

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
  applied: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-700 dark:text-primary-300',
  },
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
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

// ============================================================================
// 취소 요청 관련 타입
// ============================================================================

/**
 * 취소 요청 입력
 */
export interface RequestCancellationInput {
  applicationId: string;
  /** 취소 사유 (필수) */
  reason: string;
}

/**
 * 취소 요청 검토 입력
 */
export interface ReviewCancellationInput {
  applicationId: string;
  /** 승인 여부 */
  approved: boolean;
  /** 거절 사유 (거절 시 필수) */
  rejectionReason?: string;
}

/**
 * 취소 요청 상태 라벨
 */
export const CANCELLATION_STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '거절됨',
};
