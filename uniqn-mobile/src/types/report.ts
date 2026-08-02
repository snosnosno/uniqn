/**
 * UNIQN Mobile - 신고 관련 타입 정의
 *
 * @description 양방향 신고 기능에 사용되는 타입들
 *   - 구인자 → 스태프 (EmployeeReportType)
 *   - 구직자 → 구인자 (EmployerReportType)
 * @version 1.1.0
 */

import type { FirebaseDocument } from './common';
import { INQUIRY_ATTACHMENT_LIMITS } from './inquiry';
import type { LocalInquiryAttachment } from './inquiry';

// ============================================================================
// 증빙 첨부 (Storage)
// ============================================================================

/**
 * 신고 증빙 첨부 제약 (최대 장수 / 장당 용량 / 허용 MIME)
 *
 * 값을 새로 정의하지 않고 1:1 문의 첨부 제약(`INQUIRY_ATTACHMENT_LIMITS`)을 **그대로 공유**한다.
 * 신고 입력 화면이 `InquiryAttachmentPicker`(문의 제약을 강제하는 컴포넌트)를 재사용하므로,
 * 별도 상수를 만들면 UI 가 강제하는 값과 서버 검증값이 조용히 어긋난다.
 */
export const REPORT_EVIDENCE_LIMITS = INQUIRY_ATTACHMENT_LIMITS;

/**
 * 업로드 전 로컬 증빙 이미지 (picker 선택 결과)
 *
 * 문의 첨부와 동일한 형태 — 업로드 파이프라인을 공유하므로 타입도 공유한다.
 */
export type LocalReportEvidence = LocalInquiryAttachment;

// ============================================================================
// 신고 유형
// ============================================================================

/**
 * 스태프 신고 유형 (구인자 → 스태프)
 */
export type EmployeeReportType =
  | 'tardiness' // 지각
  | 'negligence' // 근무태만
  | 'no_show' // 노쇼
  | 'early_leave' // 조퇴 (무단)
  | 'inappropriate' // 부적절한 행동
  | 'dress_code' // 복장 불량
  | 'communication' // 소통 문제
  | 'other'; // 기타

/**
 * 구인자 신고 유형 (구직자 → 구인자)
 */
export type EmployerReportType =
  | 'false_posting' // 허위공고
  | 'employer_negligence' // 근무 관리 태만
  | 'unfair_treatment' // 부당한 대우
  | 'inappropriate_behavior' // 부적절한 행동
  | 'other'; // 기타

/**
 * 통합 신고 유형
 */
export type ReportType = EmployeeReportType | EmployerReportType;

/**
 * 신고자 유형
 */
export type ReporterType = 'employer' | 'employee';

/**
 * 신고 유형 정보 (제네릭)
 */
export interface ReportTypeInfo<T extends string = string> {
  key: T;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 스태프 신고 유형 목록 (구인자 → 스태프)
 */
export const EMPLOYEE_REPORT_TYPES: ReportTypeInfo<EmployeeReportType>[] = [
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
 * 구인자 신고 유형 목록 (구직자 → 구인자)
 */
export const EMPLOYER_REPORT_TYPES: ReportTypeInfo<EmployerReportType>[] = [
  {
    key: 'false_posting',
    label: '허위 공고',
    description: '실제와 다른 근무 조건, 허위 정보 게재',
    severity: 'high',
  },
  {
    key: 'employer_negligence',
    label: '근무 관리 태만',
    description: '근무 환경 관리 소홀, 약속 불이행',
    severity: 'medium',
  },
  {
    key: 'unfair_treatment',
    label: '부당한 대우',
    description: '임금 체불, 부당 해고, 차별 대우',
    severity: 'high',
  },
  {
    key: 'inappropriate_behavior',
    label: '부적절한 행동',
    description: '폭언, 성희롱 등 부적절한 언행',
    severity: 'critical',
  },
  {
    key: 'other',
    label: '기타',
    description: '기타 문제 상황',
    severity: 'medium',
  },
];

/**
 * 스태프 신고 유형 라벨 맵
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
 * 구인자 신고 유형 라벨 맵
 */
export const EMPLOYER_REPORT_TYPE_LABELS: Record<EmployerReportType, string> = {
  false_posting: '허위 공고',
  employer_negligence: '근무 관리 태만',
  unfair_treatment: '부당한 대우',
  inappropriate_behavior: '부적절한 행동',
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
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    text: 'text-warning-600 dark:text-warning-300',
  },
  medium: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    text: 'text-warning-600 dark:text-warning-300',
  },
  high: {
    bg: 'bg-error-100 dark:bg-error-900/30',
    text: 'text-error-600 dark:text-error-300',
  },
  critical: {
    bg: 'bg-error-200 dark:bg-error-900/50',
    text: 'text-error-700 dark:text-error-200',
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
export const REPORT_STATUS_COLORS: Record<ReportStatus, { bg: string; text: string }> = {
  pending: {
    bg: 'bg-secondary-100 dark:bg-surface',
    text: 'text-secondary-600 dark:text-secondary-300',
  },
  reviewed: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-600 dark:text-primary-300',
  },
  resolved: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    text: 'text-success-600 dark:text-success-300',
  },
  dismissed: {
    bg: 'bg-secondary-100 dark:bg-surface',
    text: 'text-secondary-500 dark:text-secondary-400',
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

  /** 관련 공고 ID */
  jobPostingId: string;

  /** 관련 공고 제목 */
  jobPostingTitle?: string;

  /** 관련 근무 기록 ID (구인자→스태프 신고만) */
  workLogId?: string;

  /** 근무 날짜 (구인자→스태프 신고만) */
  workDate?: string;

  /** 신고 상세 설명 */
  description: string;

  /**
   * 증빙 자료 참조 목록
   *
   * 비공개 버킷 `report-evidence` 의 Storage **경로**(`{업로더uid}/{제출id}/{파일명}`)를 담는다.
   * 서명 URL 은 만료되므로 DB 에 넣지 않고 열람 시점에 발급한다.
   * 과거 데이터 호환을 위해 http(s) 절대 URL 도 읽기 쪽에서 허용한다.
   */
  evidenceUrls?: string[];

  /** 처리 상태 */
  status: ReportStatus;

  /** 처리자 ID (관리자) */
  reviewerId?: string;

  /** 처리자 메모 */
  reviewerNotes?: string;

  /** 처리 일시 */
  reviewedAt?: Date;

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
  type: ReportType;
  reporterType: ReporterType;
  targetId: string;
  targetName: string;
  jobPostingId: string;
  jobPostingTitle?: string;
  /** 구인자→스태프 신고만 */
  workLogId?: string;
  /** 구인자→스태프 신고만 */
  workDate?: string;
  description: string;
  /**
   * 증빙 Storage 경로 목록 — 신고 생성 **전에** 업로드를 끝내고 그 결과를 싣는다.
   * `create_report` RPC 의 `p_evidence_urls` 로 그대로 전달된다.
   */
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
 * 스태프 신고 유형 정보 조회
 */
export function getEmployeeReportTypeInfo(
  type: EmployeeReportType
): ReportTypeInfo<EmployeeReportType> {
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
 * 구인자 신고 유형 정보 조회
 */
export function getEmployerReportTypeInfo(
  type: EmployerReportType
): ReportTypeInfo<EmployerReportType> {
  return (
    EMPLOYER_REPORT_TYPES.find((t) => t.key === type) || {
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
  type: ReportType,
  reporterType?: ReporterType
): 'low' | 'medium' | 'high' | 'critical' {
  if (reporterType === 'employee') {
    return getEmployerReportTypeInfo(type as EmployerReportType).severity;
  }
  return getEmployeeReportTypeInfo(type as EmployeeReportType).severity;
}
