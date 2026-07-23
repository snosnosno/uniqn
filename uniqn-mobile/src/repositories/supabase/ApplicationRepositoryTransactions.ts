/**
 * UNIQN Mobile - Application Repository Transactions
 *
 * @description ApplicationRepository에서 사용하는 대형 트랜잭션 함수
 * confirmWithHistoryTransaction, reviewCancellationWithTransaction, cancelConfirmationTransaction
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, MaxCapacityReachedError, ValidationError, ERROR_CODES } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import {
  createHistoryEntry,
  findActiveConfirmation,
  validateAssignmentSlotCapacity,
} from '@/domains/application';
import { normalizeAssignmentRole } from '@/types/assignment';
import { toDate } from '@/utils/date';
import { STATUS } from '@/constants';
import type { Application, Assignment, JobPosting, ReviewCancellationInput } from '@/types';
import type {
  ConfirmWithHistoryResult,
  CancelConfirmationResult,
  CancelActorType,
} from '../interfaces';
import {
  TABLES,
  rethrowOrHandle,
  loadApplication,
  loadAndVerifyJobPostingAccess,
} from './ApplicationRepositoryHelpers';

// ============================================================================
// confirmWithHistoryTransaction
// ============================================================================

export async function executeConfirmWithHistory(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('지원 확정 시작', { applicationId, ownerId });

    const applicationData = await loadApplication(applicationId);

    const confirmableStatuses: string[] = [STATUS.APPLICATION.APPLIED];
    if (!confirmableStatuses.includes(applicationData.status)) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '대기중인 지원만 확정할 수 있습니다.',
      });
    }

    if (applicationData.confirmationHistory?.length) {
      const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
      if (activeConfirmation) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 확정된 지원자입니다.',
        });
      }
    }

    const jobData = await loadAndVerifyJobPostingAccess(
      applicationData.jobPostingId,
      ownerId,
      '지원 확정'
    );

    const isFixedPosting = jobData.schedule.kind === 'fixed';
    const assignmentsToConfirm = isFixedPosting
      ? (applicationData.assignments ?? [])
      : (selectedAssignments ?? applicationData.assignments ?? []);

    if (assignmentsToConfirm.length === 0) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '확정할 일정을 선택해 주세요.',
      });
    }

    // 정원 검증
    validateConfirmCapacity(assignmentsToConfirm, jobData, applicationData);

    // 이력 생성
    let originalApplication = applicationData.originalApplication;
    if (!originalApplication && applicationData.assignments) {
      originalApplication = {
        assignments: applicationData.assignments,
        // createdAt 은 ISO string(timestampSchema) — OriginalApplication.appliedAt(Date 계약)
        // 으로 변환. 부재 시 현재 시각.
        appliedAt: toDate(applicationData.createdAt) ?? new Date(),
      };
    }

    const historyEntry = createHistoryEntry(assignmentsToConfirm, ownerId);
    const confirmationHistory = [...(applicationData.confirmationHistory ?? []), historyEntry];

    // Assignment v3(dates[], roleIds[]) → RPC가 기대하는 flat 형식 변환
    // RPC는 {groupId, date, timeSlot, role, customRole} 구조를 기대함
    const flatAssignments = assignmentsToConfirm.flatMap((a) =>
      a.dates.flatMap((date) =>
        a.roleIds.map((roleId) => {
          const { role, customRole } = normalizeAssignmentRole(roleId);
          return {
            groupId: a.groupId ?? null,
            date,
            timeSlot: a.timeSlot,
            // RPC confirm_application은 'other'를 알 수 없는 역할로 처리 → 'staff'로 전달
            // customRole 필드에 실제 역할명이 담겨 있음 (normalizeAssignmentRole 참고)
            role: role === 'other' ? 'staff' : role,
            customRole: customRole ?? null,
          };
        })
      )
    );

    // 서버사이드 원자적 트랜잭션으로 확정 처리
    // p_assignments: work_logs INSERT용 flat 포맷
    // p_assignments_v3: applications.assignments 컬럼용 v3 canonical 포맷 (덮어쓰기 버그 방지)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_application', {
      p_application_id: applicationId,
      p_owner_id: ownerId,
      p_assignments: flatAssignments,
      p_original_application: originalApplication,
      p_confirmation_history: confirmationHistory,
      p_notes: notes ?? null,
      p_assignments_v3: assignmentsToConfirm,
    });

    if (rpcError) {
      handleSupabaseError(rpcError, { operation: '지원 확정 RPC', table: TABLES.APPLICATIONS });
    }

    const workLogIds: string[] = (rpcResult?.workLogIds as string[]) ?? [];

    logger.info('지원 확정 성공 (RPC)', { applicationId, workLogIds });

    return {
      applicationId,
      workLogIds,
      message: `${applicationData.applicantName}님의 지원이 확정되었습니다.`,
      historyEntry,
    };
  } catch (error) {
    rethrowOrHandle(error, '지원 확정 트랜잭션', { applicationId });
  }
}

// ============================================================================
// reviewCancellationWithTransaction
// ============================================================================

export async function executeReviewCancellation(
  input: ReviewCancellationInput,
  reviewerId: string
): Promise<void> {
  try {
    logger.info('취소 요청 검토 시작', {
      applicationId: input.applicationId,
      approved: input.approved,
      reviewerId,
    });

    if (!input.approved && (!input.rejectionReason || input.rejectionReason.trim().length < 3)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '거절 사유를 3자 이상 입력해 주세요.',
      });
    }

    const applicationData = await loadApplication(input.applicationId);
    await loadAndVerifyJobPostingAccess(applicationData.jobPostingId, reviewerId, '취소 요청 검토');

    if (applicationData.status !== STATUS.APPLICATION.CANCELLATION_PENDING) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '검토 대기중인 취소 요청이 없습니다.',
      });
    }

    if (
      !applicationData.cancellationRequest ||
      applicationData.cancellationRequest.status !== STATUS.CANCELLATION_REQUEST.PENDING
    ) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '유효한 취소 요청이 없습니다.',
      });
    }

    const now = new Date().toISOString();

    if (input.approved) {
      await executeApproveCancellation(input.applicationId, reviewerId);
    } else {
      await executeRejectCancellation(applicationData, reviewerId, now, input);
    }

    logger.info('취소 요청 검토 성공', {
      applicationId: input.applicationId,
      approved: input.approved,
    });
  } catch (error) {
    rethrowOrHandle(error, '취소 요청 검토', {
      applicationId: input.applicationId,
      reviewerId,
    });
  }
}

// ============================================================================
// cancelConfirmationTransaction
// ============================================================================

/**
 * 확정 취소 (T-B1+B2: cancel_application_atomically RPC 호출)
 *
 * @description 기존 3단계 분리 write(applications/job_postings/work_logs)를
 *              단일 PL/pgSQL RPC로 원자화. SELECT FOR UPDATE + SECURITY DEFINER
 *              + 수동 권한 검사로 race condition 제거.
 *              인가 주체 판정(소유자/워크스페이스 멤버/협업자/admin, 또는 본인)은 RPC가
 *              수행하며, 여기서는 어떤 경로에서 호출했는지만 actorType 으로 전달한다.
 * @param applicationId - 취소할 지원서 ID
 * @param actorId - 액션 수행자 (호출자 본인의 user.uid)
 * @param cancelReason - 취소 사유 (선택)
 * @param actorType - 취소 주체 유형(기본 staff_initiates). 구인자 해제는 employer_initiates.
 * @see docs/qa/2026-04-14/team-b-atomicity-spec.md §2
 */
export async function executeCancelConfirmation(
  applicationId: string,
  actorId: string,
  cancelReason?: string,
  actorType: CancelActorType = 'staff_initiates'
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 시작 (RPC)', { applicationId, actorId, actorType });

    const { data, error } = await supabase.rpc('cancel_application_atomically', {
      p_application_id: applicationId,
      p_actor_type: actorType,
      p_actor_id: actorId,
      p_cancel_reason: cancelReason ?? null,
      p_rejection_reason: null,
    });

    if (error) {
      handleSupabaseError(error, {
        operation: '확정 취소 RPC',
        table: TABLES.APPLICATIONS,
      });
    }

    const result = data as Record<string, unknown> | null;
    if (!result || result.success !== true) {
      const errorCode = (result?.error as string | undefined) ?? 'unknown';
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: mapCancelErrorToMessage(errorCode),
        metadata: { errorCode, rpc: 'cancel_application_atomically' },
      });
    }

    logger.info('확정 취소 성공 (RPC)', {
      applicationId,
      idempotent: result.idempotent === true,
      deletedWorkLogCount: result.deleted_work_log_count,
    });

    const cancelledAtRaw = result.cancelled_at as string | undefined;
    return {
      applicationId,
      cancelledAt: cancelledAtRaw ? new Date(cancelledAtRaw) : new Date(),
      restoredStatus: 'applied',
    };
  } catch (error) {
    rethrowOrHandle(error, '확정 취소 트랜잭션', { applicationId });
  }
}

/**
 * RPC 에러 코드를 사용자 메시지로 매핑
 * @internal
 */
function mapCancelErrorToMessage(errorCode: string): string {
  switch (errorCode) {
    case 'application_not_found':
      return '지원서를 찾을 수 없습니다.';
    case 'job_posting_not_found':
      return '공고를 찾을 수 없습니다.';
    case 'invalid_status_for_cancellation':
      return '확정된 지원만 취소할 수 있습니다.';
    case 'invalid_status_for_approval':
      return '검토 대기중인 취소 요청이 없습니다.';
    case 'no_pending_cancellation_request':
      return '유효한 취소 요청이 없습니다.';
    case 'no_active_confirmation':
      return '취소할 확정 이력이 없습니다.';
    case 'unauthorized':
      return '취소 권한이 없습니다.';
    case 'invalid_actor_type':
      return '취소 액션 유형이 올바르지 않습니다.';
    case 'staff_already_checked_in':
      return '이미 출근한 스태프예요. 정산 처리 후 취소할 수 있어요.';
    default:
      return '확정 취소에 실패했습니다.';
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function validateConfirmCapacity(
  assignmentsToConfirm: Assignment[],
  jobData: JobPosting,
  applicationData: Application
): void {
  const slotCapacity = validateAssignmentSlotCapacity(jobData, assignmentsToConfirm);
  if (!slotCapacity.available) {
    throw new MaxCapacityReachedError({
      userMessage: '모집 인원이 마감되었습니다.',
      jobPostingId: applicationData.jobPostingId,
    });
  }
}

/**
 * 구인자 취소요청 승인 (T-B1+B2: cancel_application_atomically RPC 호출)
 *
 * @description 기존 다단계 분리 write를 단일 RPC로 원자화.
 *              actor_type='staff_approves_cancel_request' 로 호출.
 * @param applicationId - 취소 승인 대상 지원서 ID
 * @param reviewerId - 승인 액션 수행자 (구인자 owner_id, RPC 내부에서 검증)
 * @see docs/qa/2026-04-14/team-b-atomicity-spec.md §2
 */
async function executeApproveCancellation(
  applicationId: string,
  reviewerId: string
): Promise<void> {
  logger.info('취소 요청 승인 RPC 호출', { applicationId, reviewerId });

  const { data, error } = await supabase.rpc('cancel_application_atomically', {
    p_application_id: applicationId,
    p_actor_type: 'staff_approves_cancel_request',
    p_actor_id: reviewerId,
    p_cancel_reason: null,
    p_rejection_reason: null,
  });

  if (error) {
    handleSupabaseError(error, {
      operation: '취소 요청 승인 RPC',
      table: TABLES.APPLICATIONS,
    });
  }

  const result = data as Record<string, unknown> | null;
  if (!result || result.success !== true) {
    const errorCode = (result?.error as string | undefined) ?? 'unknown';
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: mapCancelErrorToMessage(errorCode),
      metadata: { errorCode, rpc: 'cancel_application_atomically' },
    });
  }

  logger.info('취소 요청 승인 성공 (RPC)', {
    applicationId,
    idempotent: result.idempotent === true,
    deletedWorkLogCount: result.deleted_work_log_count,
  });
}

async function executeRejectCancellation(
  applicationData: Application,
  reviewerId: string,
  now: string,
  input: ReviewCancellationInput
): Promise<void> {
  const cancellationRequest = applicationData.cancellationRequest;
  if (!cancellationRequest) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      message: 'executeRejectCancellation: cancellationRequest 누락',
      userMessage: '취소 요청 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.',
      metadata: { applicationId: input.applicationId },
    });
  }

  const updatedCancellationRequest = {
    requestedAt: cancellationRequest.requestedAt,
    reason: cancellationRequest.reason,
    reviewedAt: now,
    reviewedBy: reviewerId,
    status: STATUS.CANCELLATION_REQUEST.REJECTED,
    rejectionReason: input.rejectionReason?.trim() || '거절',
  };

  const { error } = await supabase
    .from(TABLES.APPLICATIONS)
    .update({
      status: STATUS.APPLICATION.CONFIRMED,
      cancellation_request: updatedCancellationRequest,
      updated_at: now,
    })
    .eq('id', input.applicationId)
    .eq('status', STATUS.APPLICATION.CANCELLATION_PENDING);

  if (error)
    handleSupabaseError(error, { operation: '취소 요청 거절', table: TABLES.APPLICATIONS });
}
