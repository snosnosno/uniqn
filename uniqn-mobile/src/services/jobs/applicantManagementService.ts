/**
 * UNIQN Mobile - applicant management service
 *
 * @description Employer-facing applicant queries, mutations, and realtime helpers.
 */

import type { UnsubscribeFn } from '@/types/common';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import { BusinessError, ERROR_CODES, isAppError, PermissionError, ValidationError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { applicationRepository, jobPostingRepository } from '@/repositories';
import { loadAndVerifyJobPostingAccess } from '@/repositories/supabase/ApplicationRepositoryHelpers';
import { rejectApplicationSchema } from '@/schemas';
import { RealtimeManager } from '@/shared/realtime';
import type {
  Application,
  ApplicationStats,
  ApplicationStatus,
  ConfirmApplicationInput,
  ConfirmApplicationInputV2,
  JobPosting,
  RejectApplicationInput,
  StaffRole,
} from '@/types';
import { logger } from '@/utils/logger';
import { confirmApplicationWithHistory } from './applicationHistoryService';

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

/** 일괄 확정 중 개별 실패 항목 (UI가 사유별로 구분 가능하도록 구조화) */
export interface BulkConfirmFailure {
  /** 실패한 지원 ID */
  applicationId: string;
  /** AppError 코드 (예: BUSINESS_MAX_CAPACITY_REACHED). 비-AppError 실패 시 undefined */
  code?: string;
  /** 사용자 노출용 실패 사유 메시지 */
  reason: string;
}

export interface BulkConfirmResult {
  successCount: number;
  failedCount: number;
  /** 실패한 지원 ID 목록 (호환용 — 사유는 failed 사용) */
  failedIds: string[];
  /** 실패 항목별 사유 (정원마감 N건 등 구분용) */
  failed: BulkConfirmFailure[];
  workLogIds: string[];
}

export async function getApplicantsByJobPosting(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListResult> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

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
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '지원자 목록 조회',
      component: 'applicantManagementService',
      context: { jobPostingId },
    });
  }
}

export async function confirmApplication(
  input: ConfirmApplicationInput | ConfirmApplicationInputV2,
  ownerId: string
): Promise<ConfirmResult> {
  try {
    logger.info('지원자 확정 시작', { applicationId: input.applicationId, ownerId });

    const applicationData = await applicationRepository.getById(input.applicationId);

    if (!applicationData) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '존재하지 않는 지원자입니다.',
      });
    }

    const v2Input = input as ConfirmApplicationInputV2;
    const selectedAssignments = v2Input.selectedAssignments ?? applicationData.assignments;

    const historyResult = await confirmApplicationWithHistory(
      input.applicationId,
      selectedAssignments,
      ownerId,
      input.notes
    );

    logger.info('지원자 확정 완료', {
      applicationId: input.applicationId,
      workLogIds: historyResult.workLogIds,
    });

    return {
      applicationId: historyResult.applicationId,
      workLogId: historyResult.workLogIds[0] ?? '',
      message: historyResult.message,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '지원자 확정',
      component: 'applicantManagementService',
      context: { applicationId: input.applicationId },
    });
  }
}

export async function rejectApplication(
  input: RejectApplicationInput,
  ownerId: string
): Promise<void> {
  const validationResult = rejectApplicationSchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요.',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }

  try {
    logger.info('지원 거절 시작', { applicationId: input.applicationId, ownerId });

    await applicationRepository.rejectWithTransaction(validationResult.data, ownerId);

    logger.info('지원 거절 완료', { applicationId: input.applicationId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '지원 거절',
      component: 'applicantManagementService',
      context: { applicationId: input.applicationId },
    });
  }
}

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
      failed: [],
      workLogIds: [],
    };

    for (const applicationId of applicationIds) {
      try {
        const confirmResult = await confirmApplication({ applicationId }, ownerId);
        result.successCount++;
        result.workLogIds.push(confirmResult.workLogId);
      } catch (error) {
        result.failedCount++;
        result.failedIds.push(applicationId);
        // AppError면 code/userMessage를 캡처해 UI가 사유별(정원마감 등) 구분 가능하게 한다.
        const failure: BulkConfirmFailure = isAppError(error)
          ? {
              applicationId,
              code: error.code,
              reason: error.userMessage || error.message,
            }
          : {
              applicationId,
              reason: error instanceof Error ? error.message : String(error),
            };
        result.failed.push(failure);
        logger.warn('일괄 확정 중 개별 확정 실패', { applicationId, code: failure.code, error });
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

export async function markApplicationAsRead(applicationId: string, ownerId: string): Promise<void> {
  try {
    await applicationRepository.markAsRead(applicationId, ownerId);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '지원서 읽음 처리',
      component: 'applicantManagementService',
      context: { applicationId },
    });
  }
}

export async function getApplicantStatsByRole(
  jobPostingId: string,
  ownerId: string
): Promise<Record<StaffRole, ApplicationStats>> {
  try {
    logger.info('역할별 지원자 통계 조회', { jobPostingId, ownerId });

    const { applicants } = await getApplicantsByJobPosting(jobPostingId, ownerId);
    const statsByRole: Record<string, ApplicationStats> = {};

    const ensureBucket = (role: string): ApplicationStats => {
      if (!statsByRole[role]) {
        statsByRole[role] = {
          total: 0,
          applied: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        };
      }
      return statsByRole[role];
    };

    applicants.forEach((application) => {
      // 한 지원자가 여러 assignment·여러 역할을 선택할 수 있으므로 전체를 순회해
      // 각 역할별로 카운트한다 (중복 역할은 1회만 집계).
      const rawRoles = application.assignments.flatMap((assignment) => assignment.roleIds ?? []);
      const effectiveRoles = (rawRoles.length > 0 ? rawRoles : ['other']).map((role) =>
        role === 'other' && application.customRole ? application.customRole : role
      );
      const uniqueRoles = Array.from(new Set(effectiveRoles));

      const statsKey = STATUS_TO_STATS_KEY[application.status];

      uniqueRoles.forEach((role) => {
        const bucket = ensureBucket(role);
        bucket.total++;
        if (statsKey && statsKey !== 'total') {
          bucket[statsKey]++;
        }
      });
    });

    logger.info('역할별 지원자 통계 조회 완료', { jobPostingId, statsByRole });

    return statsByRole as Record<StaffRole, ApplicationStats>;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '역할별 지원자 통계 조회',
      component: 'applicantManagementService',
      context: { jobPostingId },
    });
  }
}

export interface SubscribeToApplicantsCallbacks {
  onUpdate: (result: ApplicantListResult) => void;
  onError?: (error: Error) => void;
}

const applicantRealtimeObservers = new Map<string, Set<SubscribeToApplicantsCallbacks>>();

function broadcastApplicantUpdate(key: string, result: ApplicantListResult) {
  applicantRealtimeObservers.get(key)?.forEach((observer) => observer.onUpdate(result));
}

function broadcastApplicantError(key: string, error: Error) {
  applicantRealtimeObservers.get(key)?.forEach((observer) => observer.onError?.(error));
}

function addApplicantObserver(key: string, callbacks: SubscribeToApplicantsCallbacks) {
  const observers =
    applicantRealtimeObservers.get(key) ?? new Set<SubscribeToApplicantsCallbacks>();
  observers.add(callbacks);
  applicantRealtimeObservers.set(key, observers);
}

function removeApplicantObserver(key: string, callbacks: SubscribeToApplicantsCallbacks) {
  const observers = applicantRealtimeObservers.get(key);
  if (!observers) {
    return;
  }

  observers.delete(callbacks);
  if (observers.size === 0) {
    applicantRealtimeObservers.delete(key);
  }
}

export async function verifyJobPostingOwnership(
  jobPostingId: string,
  ownerId: string
): Promise<boolean> {
  return jobPostingRepository.verifyOwnership(jobPostingId, ownerId);
}

export function subscribeToApplicants(
  jobPostingId: string,
  ownerId: string,
  callbacks: SubscribeToApplicantsCallbacks,
  options: { verifyOwnership?: boolean } = {}
): UnsubscribeFn {
  logger.info('지원자 목록 실시간 구독 시작', {
    jobPostingId,
    ownerId,
    verifyOwnership: options.verifyOwnership !== false,
  });

  const realtimeKey = RealtimeManager.Keys.applicants(jobPostingId);
  addApplicantObserver(realtimeKey, callbacks);

  const unsubscribeManager = RealtimeManager.subscribe(realtimeKey, () =>
    applicationRepository.subscribeByJobPosting(
      jobPostingId,
      ownerId,
      {
        onUpdate: (result) => {
          broadcastApplicantUpdate(realtimeKey, {
            applicants: result.applications as ApplicantWithDetails[],
            stats: result.stats,
          });
        },
        onError: (error) => {
          broadcastApplicantError(realtimeKey, error);
        },
      },
      { verifyOwnership: options.verifyOwnership !== false }
    )
  );

  return () => {
    removeApplicantObserver(realtimeKey, callbacks);
    unsubscribeManager();
  };
}

export async function subscribeToApplicantsAsync(
  jobPostingId: string,
  ownerId: string,
  callbacks: SubscribeToApplicantsCallbacks
): Promise<UnsubscribeFn> {
  // Phase 2A.후속 P0 hotfix (2026-05-10) — owner-only 가드 → owner|member|admin.
  // PR #71 의 `loadAndVerifyJobPostingAccess` (read-side helper) 와 동일 시맨틱.
  try {
    await loadAndVerifyJobPostingAccess(jobPostingId, ownerId, '지원자 구독');
  } catch (error) {
    if (error instanceof PermissionError) {
      logger.warn('구독 전 권한 검증 실패', { jobPostingId, ownerId });
      callbacks.onError?.(error);
      return () => undefined;
    }
    throw error;
  }

  logger.info('구독 전 권한 검증 통과, 지원자 구독 시작', { jobPostingId, ownerId });
  return subscribeToApplicants(jobPostingId, ownerId, callbacks, {
    verifyOwnership: false,
  });
}
