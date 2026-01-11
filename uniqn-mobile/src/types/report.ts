/**
 * UNIQN Mobile - 신고 관련 타입 정의
 *
 * @description 구인자 → 스태프 신고 기능에 사용되는 타입들
 * @version 1.0.0
 */

import type { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument } from './common';

// ============================================================================
// 신고 유형
// ============================================================================

/**
 * 스태프 신고 유형 (구인자 → 스태프)
 */
export type EmployeeReportType =
  | 'tardiness'           // 지각
  | 'negligence'          // 근무태만
  | 'no_show'             // 노쇼
  | 'early_leave'         // 조퇴 (무단)
  | 'inappropriate'       // 부적절한 행동
  | 'dress_code'          // 복장 불량
  | 'communication'       // 소통 문제
  | 'other';              // 기타

/**
 * 신고 유형 정보
 */
export interface ReportTypeInfo {
  key: EmployeeReportType;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 신고 유형 목록
 */
export const EMPLOYEE_REPORT_TYPES: ReportTypeInfo[] = [
  {
    key: 'tardiness',
    label: '지각',
    description: '약속된 시간보다 늦게 출근',
    severity: 'low',
  },
  {
    key: 'early_leave',
    label: '무단 조퇴',
    description: '사전 연락 없이 일찍 퇴근',
    severity: 'medium',
  },
  {
    key: 'negligence',
    label: '근무 태만',
    description: '업무 수행 불성실, 근무 중 이탈',
    severity: 'medium',
  },
  {
    key: 'no_show',
    label: '노쇼',
    description: '사전 연락 없이 불참',
    severity: 'critical',
  },
  {
    key: 'dress_code',
    label: '복장 불량',
    description: '지정된 복장 미준수',
    severity: 'low',
  },
  {
    key: 'communication',
    label: '소통 문제',
    description: '연락 두절, 응답 지연',
    severity: 'medium',
  },
  {
    key: 'inappropriate',
    label: '부적절한 행동',
    description: '부적절한 언행이나 행동',
    severity: 'high',
  },
  {
    key: 'other',
    label: '기타',
    description: '기타 문제 상황',
    severity: 'medium',
  },
];

/**
 * 신고 유형 라벨 맵
 */
export const EMPLOYEE_REPORT_TYPE_LABELS: Record<EmployeeReportType, string> = {
  tardiness: '지각',
  negligence: '근무 태만',
  no_show: '노쇼',
  early_leave: '무단 조퇴',
  inappropriate: '부적절한 행동',
  dress_code: '복장 불량',
  communication: '소통 문제',
  other: '기타',
};

/**
 * 신고 심각도별 색상 (NativeWind)
 */
export const REPORT_SEVERITY_COLORS: Record<
  'low' | 'medium' | 'high' | 'critical',
  { bg: string; text: string }
> = {
  low: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-300',
  },
  medium: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-300',
  },
  high: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-300',
  },
  critical: {
    bg: 'bg-red-200 dark:bg-red-900/50',
    text: 'text-red-700 dark:text-red-200',
  },
};

// ============================================================================
// 신고 상태
// ============================================================================

/**
 * 신고 처리 상태
 */
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

/**
 * 신고 상태 라벨
 */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '검토 대기',
  reviewed: '검토 중',
  resolved: '처리 완료',
  dismissed: '기각',
};

/**
 * 신고 상태별 색상 (NativeWind)
 */
export const REPORT_STATUS_COLORS: Record<
  ReportStatus,
  { bg: string; text: string }
> = {
  pending: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
  },
  reviewed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-300',
  },
  resolved: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-300',
  },
  dismissed: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
  },
};

// ============================================================================
// 신고 인터페이스
// ============================================================================

/**
 * 신고 문서 (Firestore)
 */
export interface Report extends FirebaseDocument {
  /** 신고 유형 */
  type: EmployeeReportType;

  /** 신고자 ID (구인자) */
  reporterId: string;

  /** 신고자 이름 */
  reporterName: string;

  /** 피신고자 ID (스태프) */
  targetId: string;

  /** 피신고자 이름 */
  targetName: string;

  /** 관련 공고 ID */
  jobPostingId: string;

  /** 관련 공고 제목 */
  jobPostingTitle?: string;

  /** 관련 근무 기록 ID */
  workLogId: string;

  /** 근무 날짜 */
  workDate: string;

  /** 신고 상세 설명 */
  description: string;

  /** 증거 자료 URL 목록 */
  evidenceUrls?: string[];

  /** 처리 상태 */
  status: ReportStatus;

  /** 처리자 ID (관리자) */
  reviewerId?: string;

  /** 처리자 메모 */
  reviewerNotes?: string;

  /** 처리 일시 */
  reviewedAt?: Timestamp;

  /** 심각도 */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// 신고 입력 타입
// ============================================================================

/**
 * 신고 생성 입력
 */
export interface CreateReportInput {
  type: EmployeeReportType;
  targetId: string;
  targetName: string;
  jobPostingId: string;
  jobPostingTitle?: string;
  workLogId: string;
  workDate: string;
  description: string;
  evidenceUrls?: string[];
}

/**
 * 신고 처리 입력 (관리자용)
 */
export interface ReviewReportInput {
  reportId: string;
  status: ReportStatus;
  reviewerNotes?: string;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 신고 유형 정보 조회
 */
export function getReportTypeInfo(type: EmployeeReportType): ReportTypeInfo {
  return (
    EMPLOYEE_REPORT_TYPES.find((t) => t.key === type) || {
      key: 'other',
      label: '기타',
      description: '기타 문제 상황',
      severity: 'medium',
    }
  );
}

/**
 * 신고 유형에서 심각도 추출
 */
export function getReportSeverity(
  type: EmployeeReportType
): 'low' | 'medium' | 'high' | 'critical' {
  return getReportTypeInfo(type).severity;
}
