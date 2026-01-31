/**
 * UNIQN Mobile - Application Repository Interface
 *
 * @description 지원(Application) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 트랜잭션 로직 캡슐화 → 데이터 정합성 보장
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  ConfirmApplicationInputV2,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  JobPosting,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 지원서 + 공고 정보 조인 타입
 */
export interface ApplicationWithJob extends Application {
  jobPosting?: Partial<JobPosting>;
}

/**
 * 지원 생성 컨텍스트 (트랜잭션에서 사용)
 */
export interface ApplyContext {
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantNickname?: string;
  applicantPhotoURL?: string;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Application Repository 인터페이스
 *
 * 구현체:
 * - FirebaseApplicationRepository (프로덕션)
 * - MockApplicationRepository (테스트)
 */
export interface IApplicationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 지원서 조회
   * @param applicationId - 지원서 ID
   * @returns 지원서 (공고 정보 포함) 또는 null
   */
  getById(applicationId: string): Promise<ApplicationWithJob | null>;

  /**
   * 지원자의 모든 지원 내역 조회
   * @param applicantId - 지원자 ID
   * @returns 지원서 목록 (공고 정보 포함)
   */
  getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]>;

  /**
   * 특정 공고의 지원서 목록 조회
   * @param jobPostingId - 공고 ID
   * @returns 지원서 목록
   */
  getByJobPostingId(jobPostingId: string): Promise<Application[]>;

  /**
   * 특정 공고에 지원했는지 확인
   * @param jobPostingId - 공고 ID
   * @param applicantId - 지원자 ID
   * @returns 지원 여부 (취소된 경우 false)
   */
  hasApplied(jobPostingId: string, applicantId: string): Promise<boolean>;

  /**
   * 지원 상태별 통계 조회
   * @param applicantId - 지원자 ID
   * @returns 상태별 개수
   */
  getStatsByApplicantId(applicantId: string): Promise<Record<ApplicationStatus, number>>;

  /**
   * 취소 요청 목록 조회 (구인자용)
   * @param jobPostingId - 공고 ID
   * @param ownerId - 공고 소유자 ID (권한 확인용)
   * @returns 취소 요청 대기 중인 지원서 목록
   */
  getCancellationRequests(jobPostingId: string, ownerId: string): Promise<ApplicationWithJob[]>;

  // ==========================================================================
  // 트랜잭션 (Write) - Firebase 특화
  // ==========================================================================

  /**
   * 지원하기 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 중복 지원 검사
   * 2. 공고 상태/정원 확인
   * 3. 지원서 생성
   * 4. 공고의 applicationCount 증가
   *
   * @param input - 지원 정보 (assignments, preQuestionAnswers 등)
   * @param context - 지원자 정보
   * @returns 생성된 지원서
   * @throws AlreadyAppliedError, ApplicationClosedError, MaxCapacityReachedError
   */
  applyWithTransaction(
    input: CreateApplicationInput,
    context: ApplyContext
  ): Promise<Application>;

  /**
   * 지원 취소 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 본인 확인
   * 2. 취소 가능 상태 확인 (applied/pending만 가능)
   * 3. 지원 상태를 cancelled로 변경
   * 4. 공고의 applicationCount 감소
   *
   * @param applicationId - 지원서 ID
   * @param applicantId - 지원자 ID (권한 확인용)
   * @throws BusinessError (이미 취소됨, 확정됨 등)
   */
  cancelWithTransaction(applicationId: string, applicantId: string): Promise<void>;

  /**
   * 취소 요청 제출 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 본인 확인
   * 2. 확정 상태 확인
   * 3. 기존 취소 요청 확인
   * 4. 취소 요청 생성 + 상태 변경
   *
   * @param input - 취소 요청 정보
   * @param applicantId - 지원자 ID (권한 확인용)
   * @throws BusinessError (이미 요청됨, 거절됨 등)
   */
  requestCancellationWithTransaction(
    input: RequestCancellationInput,
    applicantId: string
  ): Promise<void>;

  /**
   * 취소 요청 검토 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 공고 소유자 확인
   * 2. 취소 요청 상태 확인
   * 3. 승인 시: 지원 상태 cancelled로 변경 + applicationCount 감소
   * 4. 거절 시: 지원 상태 confirmed로 복원
   *
   * @param input - 검토 결과
   * @param reviewerId - 검토자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), BusinessError (대기 중 아님)
   */
  reviewCancellationWithTransaction(
    input: ReviewCancellationInput,
    reviewerId: string
  ): Promise<void>;

  /**
   * 지원 확정 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 공고 소유자 확인
   * 2. 지원 상태 확인 (applied/pending만 가능)
   * 3. 정원 확인
   * 4. 지원 상태를 confirmed로 변경
   * 5. filledPositions 증가
   * 6. WorkLog 생성 (각 assignment별)
   *
   * @param input - 확정 정보 (applicationId, selectedAssignments, notes)
   * @param reviewerId - 검토자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), MaxCapacityReachedError (정원 초과)
   */
  confirmWithTransaction(
    input: ConfirmApplicationInputV2,
    reviewerId: string
  ): Promise<void>;

  /**
   * 지원 거절 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 공고 소유자 확인
   * 2. 지원 상태 확인 (applied/pending만 가능)
   * 3. 지원 상태를 rejected로 변경
   * 4. 거절 사유 저장
   *
   * @param input - 거절 정보 (applicationId, reason)
   * @param reviewerId - 검토자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), BusinessError (이미 확정/거절됨)
   */
  rejectWithTransaction(
    input: RejectApplicationInput,
    reviewerId: string
  ): Promise<void>;

  /**
   * 지원 읽음 처리 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 지원서 존재 확인
   * 2. 공고 소유자 확인
   * 3. isRead 플래그 업데이트
   *
   * @param applicationId - 지원서 ID
   * @param ownerId - 공고 소유자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), BusinessError (존재하지 않음)
   */
  markAsRead(applicationId: string, ownerId: string): Promise<void>;
}
