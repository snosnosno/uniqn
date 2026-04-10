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
  ApplicationStats,
  Assignment,
  ConfirmationHistoryEntry,
  CreateApplicationInput,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  JobPosting,
} from '@/types';
import type { Timestamp } from 'firebase/firestore';
import type { UnsubscribeFn } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

/**
 * 지원서 + 공고 정보 조인 타입
 */
export interface ApplicationWithJob extends Application {
  jobPosting?: JobPosting;
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

/**
 * 지원자 목록 + 통계 결과
 */
export interface ApplicantListWithStats {
  applications: ApplicationWithJob[];
  stats: ApplicationStats;
}

/**
 * 확정 (v2.0 confirmationHistory) 결과
 */
export interface ConfirmWithHistoryResult {
  applicationId: string;
  workLogIds: string[];
  message: string;
  historyEntry: ConfirmationHistoryEntry;
}

/**
 * 확정 취소 (v2.0 confirmationHistory) 결과
 */
export interface CancelConfirmationResult {
  applicationId: string;
  cancelledAt: Timestamp;
  restoredStatus: 'applied';
}

/**
 * 지원자→스태프 변환 결과
 */
export interface ConversionResult {
  applicationId: string;
  staffId: string;
  workLogIds: string[];
  isNewStaff: boolean;
  message: string;
}

/**
 * 지원자→스태프 변환 옵션
 */
export interface ConversionOptions {
  /** 이미 스태프인 경우 건너뛰기 (기본: false, 에러 발생) */
  skipExisting?: boolean;
  /** WorkLog 생성 여부 (기본: true) */
  createWorkLogs?: boolean;
  /** 변환 메모 */
  notes?: string;
}

/**
 * 실시간 구독 콜백
 */
export interface SubscribeCallbacks {
  onUpdate: (result: ApplicantListWithStats) => void;
  onError?: (error: Error) => void;
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
   * 지원자의 지원 내역을 상태 필터와 함께 조회
   *
   * @description scheduleService에서 applied/confirmed 상태 조회에 사용
   * @param applicantId - 지원자 ID
   * @param statuses - 조회할 상태 배열
   * @param pageSize - 페이지 크기 (기본 50)
   * @returns 지원서 목록 (공고 정보 미포함)
   */
  getByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    pageSize?: number
  ): Promise<Application[]>;

  subscribeByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    onData: (applications: Application[]) => void,
    onError: (error: Error) => void,
    pageSize?: number
  ): UnsubscribeFn;

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
   * 4. 공고 stats 재계산은 서버가 담당
   *
   * @param input - 지원 정보 (assignments, preQuestionAnswers 등)
   * @param context - 지원자 정보
   * @returns 생성된 지원서
   * @throws AlreadyAppliedError, ApplicationClosedError, MaxCapacityReachedError
   */
  // Job posting stats are server-owned and reconciled by Cloud Functions.
  applyWithTransaction(input: CreateApplicationInput, context: ApplyContext): Promise<Application>;

  /**
   * 지원 취소 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 본인 확인
   * 2. 취소 가능 상태 확인 (applied만 가능)
   * 3. 지원 상태를 cancelled로 변경
   * 4. 공고 stats 재계산은 서버가 담당
   *
   * @param applicationId - 지원서 ID
   * @param applicantId - 지원자 ID (권한 확인용)
   * @throws BusinessError (이미 취소됨, 확정됨 등)
   */
  // Job posting stats are server-owned and reconciled by Cloud Functions.
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
   * 3. 승인 시: 지원 상태 cancelled로 변경 + occupancy/stats 정리
   * 4. 거절 시: 지원 상태 confirmed로 복원
   *
   * @param input - 검토 결과
   * @param reviewerId - 검토자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), BusinessError (대기 중 아님)
   */
  // Job posting stats are server-owned and reconciled by Cloud Functions.
  reviewCancellationWithTransaction(
    input: ReviewCancellationInput,
    reviewerId: string
  ): Promise<void>;

  /**
   * 지원 거절 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 공고 소유자 확인
   * 2. 지원 상태 확인 (applied만 가능)
   * 3. 지원 상태를 rejected로 변경
   * 4. 거절 사유 저장
   *
   * @param input - 거절 정보 (applicationId, reason)
   * @param reviewerId - 검토자 ID (권한 확인용)
   * @throws PermissionError (소유자 아님), BusinessError (이미 확정/거절됨)
   */
  rejectWithTransaction(input: RejectApplicationInput, reviewerId: string): Promise<void>;

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

  /**
   * 지원 확정 v2.0 (confirmationHistory 지원 트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 공고 소유자 확인
   * 2. 정원 확인 (날짜별/역할별)
   * 3. originalApplication 보존 (최초 확정 시)
   * 4. confirmationHistory에 이력 추가
   * 5. Assignment별 WorkLog 생성
   * 6. 공고 filledPositions + dateSpecificRequirements 업데이트
   *
   * @param applicationId - 지원서 ID
   * @param selectedAssignments - 확정할 일정 (없으면 전체)
   * @param ownerId - 공고 소유자 ID
   * @param notes - 메모
   * @returns 확정 결과
   */
  confirmWithHistoryTransaction(
    applicationId: string,
    selectedAssignments: Assignment[] | undefined,
    ownerId: string,
    notes?: string
  ): Promise<ConfirmWithHistoryResult>;

  /**
   * 확정 취소 v2.0 (confirmationHistory 지원 트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 활성 확정 존재 확인
   * 2. confirmationHistory에 취소 정보 추가
   * 3. 연관 WorkLog cancelled 처리
   * 4. 공고 filledPositions + dateSpecificRequirements 감소
   * 5. 상태를 원본(applied)으로 복원
   *
   * @param applicationId - 지원서 ID
   * @param ownerId - 공고 소유자 ID
   * @param cancelReason - 취소 사유
   * @returns 취소 결과
   */
  cancelConfirmationTransaction(
    applicationId: string,
    ownerId: string,
    cancelReason?: string
  ): Promise<CancelConfirmationResult>;

  // ==========================================================================
  // Conversion Transactions (지원자 → 스태프 변환)
  // ==========================================================================

  /**
   * 지원자를 스태프로 변환 (트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 지원서/공고 상태 확인 + 권한 검증
   * 2. 스태프 중복 확인 (pre-fetch + 트랜잭션 내 재검증)
   * 3. Staff 문서 생성/업데이트
   * 4. Assignment별 WorkLog 생성
   * 5. 지원서 상태를 completed로 변경
   */

  /**
   * 스태프 변환 취소 (롤백 트랜잭션)
   *
   * 원자적으로 처리되는 작업:
   * 1. 지원서/공고 읽기 + 권한 확인
   * 2. 관련 WorkLog cancelled 처리 (scheduled 상태만)
   * 3. 지원서 상태를 confirmed로 복원
   */

  /**
   * 스태프 존재 여부 확인
   */

  /**
   * 변환 가능 여부 확인
   */

  // ==========================================================================
  // 구인자 전용 (Employer)
  // ==========================================================================

  /**
   * 공고별 지원자 목록 + 통계 조회 (구인자용)
   *
   * 처리 로직:
   * 1. 공고 소유자 확인
   * 2. 지원서 목록 조회
   * 3. 상태별 통계 집계
   *
   * @param jobPostingId - 공고 ID
   * @param ownerId - 공고 소유자 ID (권한 확인용)
   * @param statusFilter - 상태 필터 (optional)
   * @returns 지원자 목록 + 통계
   * @throws PermissionError (소유자 아님), BusinessError (공고 없음)
   */
  findByJobPostingWithStats(
    jobPostingId: string,
    ownerId: string,
    statusFilter?: ApplicationStatus | ApplicationStatus[]
  ): Promise<ApplicantListWithStats>;

  /**
   * 공고별 지원자 목록 실시간 구독 (구인자용)
   *
   * @description onSnapshot을 사용하여 지원자 목록을 실시간으로 구독합니다.
   *              새 지원이 들어오거나 상태가 변경되면 즉시 콜백이 호출됩니다.
   *
   * @param jobPostingId - 공고 ID
   * @param ownerId - 공고 소유자 ID (권한 확인용)
   * @param callbacks - 업데이트/에러 콜백
   * @returns Unsubscribe 함수 (컴포넌트 언마운트 시 호출 필요)
   */
  subscribeByJobPosting(
    jobPostingId: string,
    ownerId: string,
    callbacks: SubscribeCallbacks,
    options?: { verifyOwnership?: boolean }
  ): UnsubscribeFn;
}
