/**
 * UNIQN Mobile - JobPosting Repository Interface
 *
 * @description 구인공고(JobPosting) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type {
  JobPosting,
  JobPostingFilters,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  TournamentApprovalStatus,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 페이지네이션된 공고 목록 결과
 */
export interface PaginatedJobPostings {
  items: JobPosting[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * 공고 타입별 개수
 */
export interface PostingTypeCounts {
  regular: number;
  urgent: number;
  fixed: number;
  tournament: number;
  total: number;
}

/**
 * 공고 생성 컨텍스트
 */
export interface CreateJobPostingContext {
  ownerId: string;
  ownerName: string;
}

/**
 * 공고 생성 결과
 */
export interface CreateJobPostingResult {
  id: string;
  jobPosting: JobPosting;
}

/**
 * 공고 통계
 */
export interface JobPostingStats {
  total: number;
  active: number;
  closed: number;
  cancelled: number;
  totalApplications: number;
  totalViews: number;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * JobPosting Repository 인터페이스
 *
 * 구현체:
 * - FirebaseJobPostingRepository (프로덕션)
 * - MockJobPostingRepository (테스트)
 */
export interface IJobPostingRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 공고 조회
   * @param jobPostingId - 공고 ID
   * @returns 공고 또는 null
   */
  getById(jobPostingId: string): Promise<JobPosting | null>;

  /**
   * 여러 ID로 공고 배치 조회
   * @param jobPostingIds - 공고 ID 배열
   * @returns 공고 목록 (ID 순서 유지되지 않음)
   */
  getByIdBatch(jobPostingIds: string[]): Promise<JobPosting[]>;

  /**
   * 공고 목록 조회 (무한스크롤 지원)
   * @param filters - 필터 조건
   * @param pageSize - 페이지 크기
   * @param lastDocument - 이전 페이지의 마지막 문서 (커서)
   * @returns 페이지네이션된 공고 목록
   */
  getList(
    filters?: JobPostingFilters,
    pageSize?: number,
    lastDocument?: QueryDocumentSnapshot<DocumentData>
  ): Promise<PaginatedJobPostings>;

  /**
   * 특정 소유자의 공고 목록 조회
   * @param ownerId - 소유자 ID
   * @param status - 공고 상태 (선택)
   * @returns 공고 목록
   */
  getByOwnerId(ownerId: string, status?: JobPostingStatus): Promise<JobPosting[]>;

  /**
   * 공고 타입별 개수 조회
   * @param filters - 필터 조건 (status 등)
   * @returns 타입별 개수
   */
  getTypeCounts(filters?: Pick<JobPostingFilters, 'status'>): Promise<PostingTypeCounts>;

  // ==========================================================================
  // 변경 (Write) - 단순 업데이트
  // ==========================================================================

  /**
   * 조회수 증가
   * @param jobPostingId - 공고 ID
   */
  incrementViewCount(jobPostingId: string): Promise<void>;

  /**
   * 공고 상태 변경
   * @param jobPostingId - 공고 ID
   * @param status - 새 상태
   */
  updateStatus(jobPostingId: string, status: JobPostingStatus): Promise<void>;

  // ==========================================================================
  // 변경 (Write) - 트랜잭션
  // ==========================================================================

  /**
   * 공고 생성
   *
   * @description 현재 setDoc 단독 사용. 향후 알림/로그 원자적 생성 시 트랜잭션 전환 예정.
   * @param input - 공고 생성 입력
   * @param context - 생성자 컨텍스트 (ownerId, ownerName)
   * @returns 생성된 공고 ID와 데이터
   */
  createWithTransaction(
    input: CreateJobPostingInput,
    context: CreateJobPostingContext
  ): Promise<CreateJobPostingResult>;

  /**
   * 공고 수정 (트랜잭션, 권한 검증 포함)
   * @param jobPostingId - 공고 ID
   * @param input - 수정 입력
   * @param ownerId - 수정 요청자 ID (권한 검증용)
   */
  updateWithTransaction(
    jobPostingId: string,
    input: UpdateJobPostingInput,
    ownerId: string
  ): Promise<JobPosting>;

  /**
   * 공고 삭제 - Soft Delete (트랜잭션)
   * @param jobPostingId - 공고 ID
   * @param ownerId - 삭제 요청자 ID (권한 검증용)
   */
  deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void>;

  /**
   * 공고 마감 (트랜잭션)
   * @param jobPostingId - 공고 ID
   * @param ownerId - 마감 요청자 ID (권한 검증용)
   */
  closeWithTransaction(jobPostingId: string, ownerId: string): Promise<void>;

  /**
   * 공고 재오픈 (트랜잭션)
   * @param jobPostingId - 공고 ID
   * @param ownerId - 재오픈 요청자 ID (권한 검증용)
   */
  reopenWithTransaction(jobPostingId: string, ownerId: string): Promise<void>;

  /**
   * 소유자별 공고 통계 조회
   * @param ownerId - 소유자 ID
   * @returns 공고 통계
   */
  getStatsByOwnerId(ownerId: string): Promise<JobPostingStats>;

  /**
   * 공고 소유권 검증
   * @param jobPostingId - 공고 ID
   * @param ownerId - 검증할 소유자 ID
   * @returns 소유자인 경우 true, 아니면 false
   */
  verifyOwnership(jobPostingId: string, ownerId: string): Promise<boolean>;

  /**
   * 여러 공고 상태 일괄 변경 (배치 트랜잭션)
   * @param jobPostingIds - 공고 ID 배열
   * @param status - 새 상태
   * @param ownerId - 변경 요청자 ID (권한 검증용)
   * @returns 변경된 공고 수
   */
  bulkUpdateStatus(
    jobPostingIds: string[],
    status: JobPostingStatus,
    ownerId: string
  ): Promise<number>;

  // ==========================================================================
  // 대회공고 (Tournament)
  // ==========================================================================

  /**
   * 공고 타입 및 승인 상태로 조회
   *
   * @description 대회공고 승인 워크플로우에서 사용
   * @param postingType - 공고 타입 (예: 'tournament')
   * @param approvalStatus - 승인 상태 (pending, approved, rejected)
   * @returns 매칭되는 공고 목록 (최신순)
   */
  getByPostingTypeAndApprovalStatus(
    postingType: string,
    approvalStatus: TournamentApprovalStatus
  ): Promise<JobPosting[]>;

  /**
   * 소유자, 공고 타입, 승인 상태들로 조회
   *
   * @description 구인자의 대회공고 목록 조회에서 사용
   * @param ownerId - 소유자 ID
   * @param postingType - 공고 타입 (예: 'tournament')
   * @param approvalStatuses - 승인 상태 배열 (예: ['pending', 'rejected'])
   * @returns 매칭되는 공고 목록 (최신순)
   */
  getByOwnerAndPostingType(
    ownerId: string,
    postingType: string,
    approvalStatuses: TournamentApprovalStatus[]
  ): Promise<JobPosting[]>;
}
