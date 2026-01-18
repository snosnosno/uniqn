/**
 * UNIQN Mobile - ApplicantCard 타입 정의
 *
 * @description 지원자 카드 컴포넌트 타입
 * @version 1.0.0
 */

import type { ApplicantWithDetails } from '@/services';
import type { Assignment, PostingType } from '@/types';

// ============================================================================
// Props Types
// ============================================================================

export interface ApplicantCardProps {
  applicant: ApplicantWithDetails;
  /** 확정 콜백 - selectedAssignments가 전달되면 해당 일정만 확정 */
  onConfirm?: (applicant: ApplicantWithDetails, selectedAssignments?: Assignment[]) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  /** 확정 취소 (confirmed 상태에서만 사용) */
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
  /** 스태프로 변환 (confirmed 상태에서만 사용) */
  onConvertToStaff?: (applicant: ApplicantWithDetails) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
  showActions?: boolean;
  /** 확정 이력 표시 여부 */
  showConfirmationHistory?: boolean;
  /** 초기 펼침 상태 */
  initialExpanded?: boolean;
  /** 공고 타입 (고정공고 여부 판단) */
  postingType?: PostingType;
  /** 고정공고: 주 출근일수 */
  daysPerWeek?: number;
  /** 고정공고: 출근 시간 */
  startTime?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Assignment 정보를 역할별로 분리하여 표시용 형태로 변환
 */
export interface AssignmentDisplay {
  date: string;
  formattedDate: string;
  timeSlot: string;        // 원본 값 (key 생성용)
  timeSlotDisplay: string; // 표시용 ("미정" 포함)
  role: string;            // 단일 역할
  roleLabel: string;       // 단일 역할 라벨
}

/**
 * 그룹화된 Assignment 표시 타입
 * 같은 timeSlot + role을 가진 연속/비연속 날짜들을 그룹화
 */
export interface GroupedAssignmentDisplay {
  /** 그룹 ID (timeSlot_role 형태) */
  groupId: string;
  /** 날짜 범위 */
  dateRange: {
    start: string;
    end: string;
    dates: string[];
    totalDays: number;
    isConsecutive: boolean;
  };
  /** 시간대 표시 */
  timeSlotDisplay: string;
  /** 역할 라벨 */
  roleLabel: string;
  /** 역할 원본 값 */
  role: string;
  /** 시간대 원본 값 */
  timeSlot: string;
  /** 그룹 내 개별 일정 */
  items: AssignmentDisplay[];
}

/**
 * 아이콘 색상 (다크모드 대응)
 */
export interface IconColors {
  checked: string;
  unchecked: string;
}

/**
 * 상태 배지 variant 타입
 */
export type StatusBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
