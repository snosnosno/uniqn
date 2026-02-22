/**
 * UNIQN Mobile - Review Repository Interface
 *
 * @description 리뷰/평가(버블) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 트랜잭션 로직 캡슐화 → 중복 평가 방지 + 버블 점수 원자적 업데이트
 * 3. 결정적 문서 ID 활용 → getDoc 직접 접근 (인덱스 불필요)
 */

import type { Review, CreateReviewInput, ReviewerType, ReviewBlindResult } from '@/types/review';

// ============================================================================
// Types
// ============================================================================

/**
 * 리뷰 생성 컨텍스트 (트랜잭션에서 사용)
 */
export interface CreateReviewContext {
  /** 평가자 ID */
  reviewerId: string;
  /** 평가자 이름 */
  reviewerName: string;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Review Repository 인터페이스
 *
 * 구현체:
 * - FirebaseReviewRepository (프로덕션)
 * - MockReviewRepository (테스트)
 */
export interface IReviewRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * WorkLog ID + reviewerType으로 리뷰 조회 (결정적 ID)
   *
   * @param workLogId - 근무 기록 ID
   * @param reviewerType - 평가자 유형
   * @returns 리뷰 또는 null
   */
  getByWorkLogAndType(workLogId: string, reviewerType: ReviewerType): Promise<Review | null>;

  /**
   * 블라인드 조회 (내 리뷰 + 상대 리뷰)
   *
   * @description 내 리뷰가 있으면 상대 리뷰도 열람 가능
   * @param workLogId - 근무 기록 ID
   * @param myReviewerType - 내 평가자 유형
   * @param currentUserId - 현재 사용자 ID (권한 검증용)
   * @returns 블라인드 조회 결과
   */
  getReviewsWithBlindCheck(
    workLogId: string,
    myReviewerType: ReviewerType,
    currentUserId: string
  ): Promise<ReviewBlindResult>;

  /**
   * 피평가자별 받은 리뷰 목록 (최신순)
   *
   * @param revieweeId - 피평가자 ID
   * @param limit - 조회 개수 (기본 20)
   * @returns 리뷰 목록
   */
  getByRevieweeId(revieweeId: string, limit?: number): Promise<Review[]>;

  /**
   * 평가자별 작성한 리뷰 목록 (최신순)
   *
   * @param reviewerId - 평가자 ID
   * @param limit - 조회 개수 (기본 20)
   * @returns 리뷰 목록
   */
  getByReviewerId(reviewerId: string, limit?: number): Promise<Review[]>;

  // ==========================================================================
  // 트랜잭션 (Write) - 원자적 처리
  // ==========================================================================

  /**
   * 리뷰 생성 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 중복 리뷰 확인 (결정적 ID로 getDoc)
   * 2. WorkLog 상태 확인
   * 3. 리뷰 문서 생성
   * 4. 피평가자 bubbleScore 업데이트 (users 컬렉션)
   *
   * @param input - 리뷰 정보
   * @param context - 평가자 컨텍스트 (ID, 이름)
   * @returns 생성된 리뷰 문서 ID
   * @throws AlreadyReviewedError (이미 평가함)
   * @throws ReviewNotFoundError (WorkLog 없음)
   * @throws ReviewPeriodExpiredError (기한 만료)
   * @throws CannotReviewSelfError (본인 평가)
   * @throws UnauthorizedReviewError (권한 없음)
   */
  createWithTransaction(
    input: CreateReviewInput,
    context: CreateReviewContext
  ): Promise<string>;
}
