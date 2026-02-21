/**
 * UNIQN Mobile - Report Repository Interface
 *
 * @description 신고(Report) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 트랜잭션 로직 캡슐화 → 중복 신고 방지 (Race Condition 해결)
 * 3. 중복 쿼리 패턴 통합 → 코드 재사용성
 */

import type {
  Report,
  CreateReportInput,
  ReviewReportInput,
  ReportStatus,
  ReporterType,
} from '@/types/report';

// ============================================================================
// Types
// ============================================================================

/** 페이지네이션 커서 (구현체 내부 타입 은닉) */
export type ReportPaginationCursor = unknown;

/**
 * 신고 생성 컨텍스트 (트랜잭션에서 사용)
 */
export interface CreateReportContext {
  /** 신고자 ID */
  reporterId: string;
  /** 신고자 이름 (프로필에서 조회) */
  reporterName: string;
}

/**
 * 신고 필터 옵션 (관리자용)
 */
export interface ReportFilters {
  /** 신고 상태 필터 */
  status?: ReportStatus | 'all';
  /** 심각도 필터 */
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'all';
  /** 신고자 유형 필터 */
  reporterType?: ReporterType | 'all';
}

/**
 * 신고 목록 조회 옵션
 */
export interface FetchReportsOptions {
  filters?: ReportFilters;
  pageSize?: number;
  cursor?: ReportPaginationCursor;
}

/**
 * 신고 목록 조회 결과
 */
export interface FetchReportsResult {
  reports: Report[];
  nextCursor: ReportPaginationCursor | null;
  hasMore: boolean;
}

/**
 * 신고 통계
 */
export interface ReportCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Report Repository 인터페이스
 *
 * 구현체:
 * - FirebaseReportRepository (프로덕션)
 * - MockReportRepository (테스트)
 */
export interface IReportRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 신고 조회
   * @param reportId - 신고 ID
   * @returns 신고 또는 null
   */
  getById(reportId: string): Promise<Report | null>;

  /**
   * 공고별 신고 목록 조회
   * @param jobPostingId - 공고 ID
   * @returns 신고 목록 (최신순 정렬)
   */
  getByJobPostingId(jobPostingId: string): Promise<Report[]>;

  /**
   * 대상(스태프)별 신고 목록 조회
   * @param targetId - 피신고자 ID
   * @returns 신고 목록 (최신순 정렬)
   */
  getByTargetId(targetId: string): Promise<Report[]>;

  /**
   * 신고자별 신고 목록 조회
   * @param reporterId - 신고자 ID
   * @returns 신고 목록 (최신순 정렬)
   */
  getByReporterId(reporterId: string): Promise<Report[]>;

  /**
   * 전체 신고 목록 조회 (관리자용, 페이지네이션)
   * @param options - 필터 + 페이지네이션 옵션
   * @returns 페이지네이션된 신고 목록
   */
  getAll(options?: FetchReportsOptions): Promise<FetchReportsResult>;

  /**
   * 대상별 신고 통계 조회
   * @param targetId - 피신고자 ID
   * @returns 심각도별 신고 횟수
   */
  getCountsByTargetId(targetId: string): Promise<ReportCounts>;

  // ==========================================================================
  // 트랜잭션 (Write) - 원자적 처리
  // ==========================================================================

  /**
   * 신고 생성 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 중복 신고 검사 (같은 reporter + target + jobPosting + pending 상태)
   * 2. 신고 문서 생성
   *
   * @param input - 신고 정보
   * @param context - 신고자 컨텍스트 (ID, 이름)
   * @returns 생성된 신고 ID
   * @throws DuplicateReportError (이미 신고함)
   * @throws CannotReportSelfError (본인 신고)
   */
  createWithTransaction(input: CreateReportInput, context: CreateReportContext): Promise<string>;

  /**
   * 신고 처리 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 신고 존재 확인
   * 2. 상태 확인 (pending만 처리 가능)
   * 3. 상태 업데이트 + 리뷰어 정보 저장
   *
   * @param input - 처리 정보 (reportId, status, reviewerNotes)
   * @param reviewerId - 리뷰어(관리자) ID
   * @throws ReportNotFoundError (존재하지 않음)
   * @throws ReportAlreadyReviewedError (이미 처리됨)
   */
  reviewWithTransaction(input: ReviewReportInput, reviewerId: string): Promise<void>;
}
