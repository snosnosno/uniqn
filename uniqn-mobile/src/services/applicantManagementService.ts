/**
 * UNIQN Mobile - 지원자 관리 서비스 (구인자용)
 *
 * @description 지원자 목록 조회, 확정, 거절 서비스
 * @version 2.0.0 - Assignment v2.0 지원
 */

import { type Unsubscribe } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { MaxCapacityReachedError, BusinessError, PermissionError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { confirmApplicationWithHistory } from './applicationHistoryService';
import { applicationRepository, jobPostingRepository } from '@/repositories';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import type {
  Application,
  ApplicationStatus,
  ApplicationStats,
  ConfirmApplicationInput,
  ConfirmApplicationInputV2,
  RejectApplicationInput,
  JobPosting,
  StaffRole,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantWithDetails extends Application {
  jobPosting?: JobPosting;
}

export interface ApplicantListResult {
  applicants: ApplicantWithDetails[];
  stats: ApplicationStats;
}

export interface ConfirmResult {
  applicationId: string;
  workLogId: string;
  message: string;
}

export interface BulkConfirmResult {
  successCount: number;
  failedCount: number;
  failedIds: string[];
  workLogIds: string[];
}

// ============================================================================
// Applicant Management Service
// ============================================================================

/**
 * 공고별 지원자 목록 조회 (구인자용)
 *
 * @description Repository 패턴을 통해 데이터 접근 추상화
 */
export async function getApplicantsByJobPosting(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListResult> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    // Repository를 통한 데이터 조회
    const result = await applicationRepository.findByJobPostingWithStats(
      jobPostingId,
      ownerId,
      statusFilter
    );

    logger.info('지원자 목록 조회 완료', {
      jobPostingId,
      count: result.applications.length,
      stats: result.stats,
    });

    return {
      applicants: result.applications as ApplicantWithDetails[],
      stats: result.stats,
    };
  } catch (error) {
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원자 목록 조회',
      component: 'applicantManagementService',
      context: { jobPostingId },
    });
  }
}

/**
 * 지원 확정
 *
 * @description 모든 확정은 confirmApplicationWithHistory를 통해 처리됩니다.
 *
 * 비즈니스 로직:
 * 1. 공고 소유자 확인
 * 2. 정원 확인
 * 3. 지원 상태 변경 (confirmed)
 * 4. 공고 filledPositions 증가
 * 5. 근무 기록(WorkLog) 생성
 */
export async function confirmApplication(
  input: ConfirmApplicationInput | ConfirmApplicationInputV2,
  ownerId: string
): Promise<ConfirmResult> {
  try {
    logger.info('지원 확정 시작', { applicationId: input.applicationId, ownerId });

    // Repository를 통한 지원서 조회
    const applicationData = await applicationRepository.getById(input.applicationId);

    if (!applicationData) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 지원입니다',
      });
    }

    const v2Input = input as ConfirmApplicationInputV2;
    const selectedAssignments = v2Input.selectedAssignments ?? applicationData.assignments;

    // 항상 confirmApplicationWithHistory로 처리
    const historyResult = await confirmApplicationWithHistory(
      input.applicationId,
      selectedAssignments,
      ownerId,
      input.notes
    );

    logger.info('지원 확정 완료', {
      applicationId: input.applicationId,
      workLogIds: historyResult.workLogIds,
    });

    return {
      applicationId: historyResult.applicationId,
      workLogId: historyResult.workLogIds[0] ?? '',
      message: historyResult.message,
    };
  } catch (error) {
    if (
      error instanceof BusinessError ||
      error instanceof PermissionError ||
      error instanceof MaxCapacityReachedError
    ) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 확정',
      component: 'applicantManagementService',
      context: { applicationId: input.applicationId },
    });
  }
}

/**
 * 지원 거절 (트랜잭션)
 *
 * @description Repository의 rejectWithTransaction을 활용하여 데이터 접근 추상화
 */
export async function rejectApplication(
  input: RejectApplicationInput,
  ownerId: string
): Promise<void> {
  try {
    logger.info('지원 거절 시작', { applicationId: input.applicationId, ownerId });

    await applicationRepository.rejectWithTransaction(input, ownerId);

    logger.info('지원 거절 완료', { applicationId: input.applicationId });
  } catch (error) {
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 거절',
      component: 'applicantManagementService',
      context: { applicationId: input.applicationId },
    });
  }
}

/**
 * 일괄 확정 (구인자용)
 */
export async function bulkConfirmApplications(
  applicationIds: string[],
  ownerId: string
): Promise<BulkConfirmResult> {
  try {
    logger.info('일괄 확정 시작', { count: applicationIds.length, ownerId });

    const result: BulkConfirmResult = {
      successCount: 0,
      failedCount: 0,
      failedIds: [],
      workLogIds: [],
    };

    // 순차적으로 처리 (트랜잭션 충돌 방지)
    for (const applicationId of applicationIds) {
      try {
        const confirmResult = await confirmApplication({ applicationId }, ownerId);
        result.successCount++;
        result.workLogIds.push(confirmResult.workLogId);
      } catch (error) {
        result.failedCount++;
        result.failedIds.push(applicationId);
        logger.warn('일괄 확정 중 실패', { applicationId, error });
      }
    }

    logger.info('일괄 확정 완료', {
      successCount: result.successCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일괄 확정',
      component: 'applicantManagementService',
    });
  }
}

/**
 * 지원 읽음 처리 (구인자가 지원서를 확인)
 *
 * @description Repository의 markAsRead를 활용하여 데이터 접근 추상화
 */
export async function markApplicationAsRead(applicationId: string, ownerId: string): Promise<void> {
  try {
    await applicationRepository.markAsRead(applicationId, ownerId);
  } catch (error) {
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 읽음 처리',
      component: 'applicantManagementService',
      context: { applicationId },
    });
  }
}

/**
 * 역할별 지원자 통계
 */
export async function getApplicantStatsByRole(
  jobPostingId: string,
  ownerId: string
): Promise<Record<StaffRole, ApplicationStats>> {
  try {
    logger.info('역할별 지원자 통계 조회', { jobPostingId, ownerId });

    const { applicants } = await getApplicantsByJobPosting(jobPostingId, ownerId);

    const statsByRole: Record<string, ApplicationStats> = {};

    applicants.forEach((app) => {
      // 역할 필터링: assignments 기반 (appliedRole 제거됨)
      const primaryRole = app.assignments[0]?.roleIds?.[0] || 'other';
      // 커스텀 역할 지원: primaryRole이 'other'이면 customRole을 키로 사용
      const effectiveRole =
        primaryRole === 'other' && app.customRole ? app.customRole : primaryRole;

      if (!statsByRole[effectiveRole]) {
        statsByRole[effectiveRole] = {
          total: 0,
          applied: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        };
      }

      // 통계 집계 (STATUS_TO_STATS_KEY 매핑 사용)
      statsByRole[effectiveRole].total++;
      const statsKey = STATUS_TO_STATS_KEY[app.status];
      if (statsKey && statsKey !== 'total') {
        statsByRole[effectiveRole][statsKey]++;
      }
    });

    logger.info('역할별 지원자 통계 조회 완료', { jobPostingId, statsByRole });

    return statsByRole as Record<StaffRole, ApplicationStats>;
  } catch (error) {
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '역할별 지원자 통계 조회',
      component: 'applicantManagementService',
      context: { jobPostingId },
    });
  }
}

// ============================================================================
// 실시간 구독 (Realtime Subscription)
// ============================================================================

export interface SubscribeToApplicantsCallbacks {
  onUpdate: (result: ApplicantListResult) => void;
  onError?: (error: Error) => void;
}

/**
 * 공고 소유권 검증 (구독 전 권한 확인용)
 *
 * @description Repository 패턴을 통해 데이터 접근 추상화
 * @returns true: 소유자, false: 비소유자 또는 공고 없음
 */
export async function verifyJobPostingOwnership(
  jobPostingId: string,
  ownerId: string
): Promise<boolean> {
  return jobPostingRepository.verifyOwnership(jobPostingId, ownerId);
}

/**
 * 공고별 지원자 목록 실시간 구독 (구인자용)
 *
 * @description Repository 패턴을 통해 실시간 구독을 추상화합니다.
 *              새 지원이 들어오거나 상태가 변경되면 즉시 콜백이 호출됩니다.
 *
 * @note 치명적 에러(권한, 인증) 발생 시 자동으로 구독이 해제됩니다.
 *
 * @returns Unsubscribe 함수 (컴포넌트 언마운트 시 호출 필요)
 */
export function subscribeToApplicants(
  jobPostingId: string,
  ownerId: string,
  callbacks: SubscribeToApplicantsCallbacks
): Unsubscribe {
  logger.info('지원자 목록 실시간 구독 시작', { jobPostingId, ownerId });

  // Repository를 통한 실시간 구독
  return applicationRepository.subscribeByJobPosting(jobPostingId, ownerId, {
    onUpdate: (result) => {
      callbacks.onUpdate({
        applicants: result.applications as ApplicantWithDetails[],
        stats: result.stats,
      });
    },
    onError: callbacks.onError,
  });
}

/**
 * 비동기 권한 검증 후 지원자 목록 실시간 구독 (S1)
 *
 * @description 구독 전 권한을 먼저 확인하여 불필요한 구독을 방지합니다.
 *              권한이 없으면 onSnapshot을 호출하지 않고 즉시 에러를 반환합니다.
 *
 * @returns Promise<Unsubscribe> - 구독 해제 함수
 */
export async function subscribeToApplicantsAsync(
  jobPostingId: string,
  ownerId: string,
  callbacks: SubscribeToApplicantsCallbacks
): Promise<Unsubscribe> {
  // 1. 구독 전 권한 검증
  const isOwner = await verifyJobPostingOwnership(jobPostingId, ownerId);

  if (!isOwner) {
    const error = new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage: '해당 공고의 소유자가 아닙니다',
    });
    logger.warn('구독 전 권한 검증 실패', { jobPostingId, ownerId });
    callbacks.onError?.(error);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {}; // 빈 unsubscribe 반환 (권한 없음으로 구독 시작 안 함)
  }

  // 2. 권한 확인 후 구독 시작
  logger.info('구독 전 권한 검증 통과, 구독 시작', { jobPostingId, ownerId });
  return subscribeToApplicants(jobPostingId, ownerId, callbacks);
}
