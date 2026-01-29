/**
 * UNIQN Mobile - JobPosting Repository Interface
 *
 * @description 구인공고(JobPosting) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { JobPosting, JobPostingFilters, JobPostingStatus } from '@/types';

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
  normal: number;
  urgent: number;
  fixed: number;
  tournament: number;
  total: number;
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
}
