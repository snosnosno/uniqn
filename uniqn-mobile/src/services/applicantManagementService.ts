/**
 * UNIQN Mobile - 지원자 관리 서비스 (구인자용)
 *
 * @description 지원자 목록 조회, 확정, 거절 서비스
 * @version 2.0.0 - Assignment v2.0 지원
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  MaxCapacityReachedError,
  BusinessError,
  PermissionError,
  AuthError,
  isPermissionError,
  isAuthError,
  ERROR_CODES,
  toError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import { confirmApplicationWithHistory } from './applicationHistoryService';
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
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';

/**
 * ApplicationStatus → ApplicationStats 필드명 매핑
 *
 * @description ApplicationStatus는 snake_case (cancellation_pending)
 *              ApplicationStats 필드는 camelCase (cancellationPending)
 */
const STATUS_TO_STATS_KEY: Record<ApplicationStatus, keyof ApplicationStats | null> = {
  applied: 'applied',
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancellation_pending: 'cancellationPending',
};

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
 */
export async function getApplicantsByJobPosting(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListResult> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    // 공고 소유자 확인
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 공고입니다',
      });
    }

    const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!jobData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '데이터가 올바르지 않습니다',
      });
    }
    // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
    const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
    if (postingOwnerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    // 지원자 목록 조회
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    let q = query(
      applicationsRef,
      where('jobPostingId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    // 상태 필터 적용
    if (statusFilter) {
      const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
      if (statuses.length === 1) {
        q = query(
          applicationsRef,
          where('jobPostingId', '==', jobPostingId),
          where('status', '==', statuses[0]),
          orderBy('createdAt', 'desc')
        );
      }
      // 복수 상태 필터는 클라이언트에서 처리 (Firestore 제약)
    }

    const snapshot = await getDocs(q);
    const applicants: ApplicantWithDetails[] = [];
    const stats: ApplicationStats = {
      total: 0,
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0,
      cancellationPending: 0,
    };

    snapshot.docs.forEach((docSnapshot) => {
      const application = {
        ...docSnapshot.data(),
        id: docSnapshot.id,
        jobPosting: { ...jobData, id: jobDoc.id },
      } as ApplicantWithDetails;

      // 복수 상태 필터 적용
      if (statusFilter && Array.isArray(statusFilter) && statusFilter.length > 1) {
        if (!statusFilter.includes(application.status)) {
          return;
        }
      }

      applicants.push(application);

      // 통계 집계 (STATUS_TO_STATS_KEY 매핑 사용)
      stats.total++;
      const statsKey = STATUS_TO_STATS_KEY[application.status];
      if (statsKey && statsKey !== 'total') {
        stats[statsKey]++;
      }
    });

    logger.info('지원자 목록 조회 완료', {
      jobPostingId,
      count: applicants.length,
      stats,
    });

    return { applicants, stats };
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

    const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 지원입니다',
      });
    }

    const applicationData = parseApplicationDocument({ id: applicationDoc.id, ...applicationDoc.data() });
    if (!applicationData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '데이터가 올바르지 않습니다',
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
 */
export async function rejectApplication(
  input: RejectApplicationInput,
  ownerId: string
): Promise<void> {
  try {
    logger.info('지원 거절 시작', { applicationId: input.applicationId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = parseApplicationDocument({ id: applicationDoc.id, ...applicationDoc.data() });
      if (!applicationData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '데이터가 올바르지 않습니다',
        });
      }

      // 이미 처리된 경우
      if (applicationData.status === 'confirmed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 확정된 지원은 거절할 수 없습니다',
        });
      }

      if (applicationData.status === 'rejected') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 거절된 지원입니다',
        });
      }

      // 공고 소유자 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
      if (!jobData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '데이터가 올바르지 않습니다',
        });
      }
      // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
      const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
      if (postingOwnerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 지원 상태 변경
      transaction.update(applicationRef, {
        status: 'rejected',
        processedBy: ownerId,
        processedAt: serverTimestamp(),
        ...(input.reason && { rejectionReason: input.reason }),
        updatedAt: serverTimestamp(),
      });
    });

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
 */
export async function markApplicationAsRead(
  applicationId: string,
  ownerId: string
): Promise<void> {
  try {
    const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 지원입니다',
      });
    }

    const applicationData = parseApplicationDocument({ id: applicationDoc.id, ...applicationDoc.data() });
    if (!applicationData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '데이터가 올바르지 않습니다',
      });
    }

    // 공고 소유자 확인
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 공고입니다',
      });
    }

    const markReadJobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!markReadJobData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '데이터가 올바르지 않습니다',
      });
    }

    if (markReadJobData.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      transaction.update(applicationRef, {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    });
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
      const effectiveRole = primaryRole === 'other' && app.customRole
        ? app.customRole
        : primaryRole;

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
 * @returns true: 소유자, false: 비소유자 또는 공고 없음
 */
export async function verifyJobPostingOwnership(
  jobPostingId: string,
  ownerId: string
): Promise<boolean> {
  try {
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      return false;
    }

    const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!jobData) {
      return false;
    }
    const postingOwnerId = jobData.ownerId ?? jobData.createdBy;

    return postingOwnerId === ownerId;
  } catch (error) {
    logger.error('공고 소유권 검증 실패', toError(error), { jobPostingId, ownerId });
    return false;
  }
}

/**
 * 공고별 지원자 목록 실시간 구독 (구인자용)
 *
 * @description onSnapshot을 사용하여 지원자 목록을 실시간으로 구독합니다.
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

  const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
  const q = query(
    applicationsRef,
    where('jobPostingId', '==', jobPostingId),
    orderBy('createdAt', 'desc')
  );

  // 공고 정보 캐싱 (소유권 확인 및 지원자 데이터에 포함)
  let cachedJobPosting: JobPosting | null = null;
  let isOwnerVerified = false;
  let unsubscribeFn: Unsubscribe | null = null;

  /**
   * 치명적 에러 시 구독 자동 해제 (W5)
   */
  const handleFatalError = (error: Error) => {
    if (isPermissionError(error) || isAuthError(error)) {
      logger.warn('치명적 에러로 구독 자동 해제', {
        errorCode: (error as PermissionError | AuthError).code,
        jobPostingId,
      });
      unsubscribeFn?.();
    }
    callbacks.onError?.(error);
  };

  unsubscribeFn = onSnapshot(
    q,
    async (snapshot) => {
      try {
        // 첫 호출 시 공고 소유자 확인
        if (!isOwnerVerified) {
          const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
          const jobDoc = await getDoc(jobRef);

          if (!jobDoc.exists()) {
            const error = new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
              userMessage: '존재하지 않는 공고입니다',
            });
            callbacks.onError?.(error);
            return;
          }

          const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
          if (!jobData) {
            const error = new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '데이터가 올바르지 않습니다',
            });
            callbacks.onError?.(error);
            return;
          }
          const postingOwnerId = jobData.ownerId ?? jobData.createdBy;

          if (postingOwnerId !== ownerId) {
            const error = new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
              userMessage: '본인의 공고만 조회할 수 있습니다',
            });
            // 권한 에러는 치명적 → 자동 해제
            handleFatalError(error);
            return;
          }

          cachedJobPosting = jobData;
          isOwnerVerified = true;
        }

        // 지원자 목록 처리
        const applicants: ApplicantWithDetails[] = [];
        const stats: ApplicationStats = {
          total: 0,
          applied: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        };

        snapshot.docs.forEach((docSnapshot) => {
          const application = {
            ...docSnapshot.data(),
            id: docSnapshot.id,
            jobPosting: cachedJobPosting,
          } as ApplicantWithDetails;

          applicants.push(application);

          // 통계 집계
          stats.total++;
          const statsKey = STATUS_TO_STATS_KEY[application.status];
          if (statsKey && statsKey !== 'total') {
            stats[statsKey]++;
          }
        });

        logger.debug('지원자 목록 실시간 업데이트', {
          jobPostingId,
          count: applicants.length,
          stats,
        });

        callbacks.onUpdate({ applicants, stats });
      } catch (error) {
        logger.error('지원자 목록 실시간 구독 처리 실패', toError(error), { jobPostingId });
        handleFatalError(toError(error));
      }
    },
    (firebaseError) => {
      const appError = handleServiceError(firebaseError, {
        operation: '지원자 목록 실시간 구독',
        component: 'applicantManagementService',
        context: { jobPostingId },
      });

      // Firebase 에러도 치명적 에러 여부 확인 후 처리
      handleFatalError(appError as Error);
    }
  );

  return () => unsubscribeFn?.();
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
    return () => {}; // 빈 unsubscribe 반환
  }

  // 2. 권한 확인 후 구독 시작
  logger.info('구독 전 권한 검증 통과, 구독 시작', { jobPostingId, ownerId });
  return subscribeToApplicants(jobPostingId, ownerId, callbacks);
}
