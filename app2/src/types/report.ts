/**
 * 신고(Report) 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 신고 유형
 */
export type ReportType =
  | 'tardiness'              // 지각
  | 'negligence'             // 근무태만
  | 'no_show'               // 노쇼
  | 'inappropriate_behavior' // 부적절한 행동
  | 'other';                // 기타

/**
 * 신고자 유형
 */
export type ReporterType =
  | 'employer'  // 구인자 (관리자, 매니저, 스태프)
  | 'employee'; // 구직자 (일반 사용자)

/**
 * 신고 상태
 */
export type ReportStatus =
  | 'pending'    // 대기중
  | 'reviewed'   // 검토중
  | 'resolved'   // 해결됨
  | 'dismissed'; // 기각됨

/**
 * 신고 인터페이스
 */
export interface Report {
  /** 신고 ID */
  id: string;

  /** 신고 유형 */
  type: ReportType;

  /** 신고자 유형 */
  reporterType: ReporterType;

  /** 신고자 ID */
  reporterId: string;

  /** 신고자 이름 */
  reporterName: string;

  /** 피신고자 ID */
  targetId: string;

  /** 피신고자 이름 */
  targetName: string;

  /** 이벤트 ID (구인공고 ID) */
  eventId: string;

  /** 이벤트 제목 */
  eventTitle: string;

  /** 발생 날짜 (YYYY-MM-DD) */
  date: string;

  /** 상세 설명 */
  description: string;

  /** 신고 상태 */
  status: ReportStatus;

  /** 생성일시 */
  createdAt: Timestamp;

  /** 해결일시 (선택사항) */
  resolvedAt?: Timestamp;

  /** 해결 내용 (선택사항) */
  resolution?: string;

  /** 관리자 메모 (선택사항) */
  adminNotes?: string;
}

/**
 * 신고 생성 입력 타입
 */
export interface ReportCreateInput {
  type: ReportType;
  reporterType: ReporterType;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  eventId: string;
  eventTitle: string;
  date: string;
  description: string;
}

/**
 * 신고 업데이트 입력 타입
 */
export interface ReportUpdateInput {
  status?: ReportStatus;
  resolution?: string;
  adminNotes?: string;
}

/**
 * 신고 유형별 표시 정보
 */
export interface ReportTypeInfo {
  key: ReportType;
  labelKey: string;
  descriptionKey: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 신고 유형별 정보 상수
 */
export const REPORT_TYPES: ReportTypeInfo[] = [
  {
    key: 'tardiness',
    labelKey: 'report.types.tardiness.label',
    descriptionKey: 'report.types.tardiness.description',
    severity: 'low'
  },
  {
    key: 'negligence',
    labelKey: 'report.types.negligence.label',
    descriptionKey: 'report.types.negligence.description',
    severity: 'medium'
  },
  {
    key: 'no_show',
    labelKey: 'report.types.no_show.label',
    descriptionKey: 'report.types.no_show.description',
    severity: 'high'
  },
  {
    key: 'inappropriate_behavior',
    labelKey: 'report.types.inappropriate_behavior.label',
    descriptionKey: 'report.types.inappropriate_behavior.description',
    severity: 'critical'
  },
  {
    key: 'other',
    labelKey: 'report.types.other.label',
    descriptionKey: 'report.types.other.description',
    severity: 'medium'
  }
];

/**
 * 신고 상태별 스타일 정보
 */
export const REPORT_STATUS_STYLES: Record<ReportStatus, {
  color: string;
  bgColor: string;
  labelKey: string;
}> = {
  pending: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    labelKey: 'report.status.pending'
  },
  reviewed: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    labelKey: 'report.status.reviewed'
  },
  resolved: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    labelKey: 'report.status.resolved'
  },
  dismissed: {
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    labelKey: 'report.status.dismissed'
  }
};