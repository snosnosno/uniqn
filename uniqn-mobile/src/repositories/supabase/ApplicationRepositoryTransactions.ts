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
  addCancellationToEntry,
  updatePostingScheduleFilled,
  validateAssignmentSlotCapacity,
} from '@/domains/application';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { normalizeAssignmentRole } from '@/types/assignment';
import { STATUS } from '@/constants';
import type { Application, Assignment, JobPosting, ReviewCancellationInput } from '@/types';
import type { ConfirmWithHistoryResult, CancelConfirmationResult } from '../interfaces';
import {
  TABLES,
  rethrowOrHandle,
  loadApplication,
  loadAndVerifyJobPostingOwner,
  countAssignmentDates,
  fetchRelatedWorkLogIds,
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

    const jobData = await loadAndVerifyJobPostingOwner(
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
    validateConfirmCapacity(isFixedPosting, assignmentsToConfirm, jobData, applicationData);

    // 이력 생성
    let originalApplication = applicationData.originalApplication;
    if (!originalApplication && applicationData.assignments) {
      originalApplication = {
        assignments: applicationData.assignments,
        appliedAt: applicationData.createdAt ?? new Date(),
      };
    }

    const historyEntry = createHistoryEntry(assignmentsToConfirm, ownerId);
    const confirmationHistory = [...(applicationData.confirmationHistory ?? []), historyEntry];
    // 서버사이드 원자적 트랜잭션으로 확정 처리
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_application', {
      p_application_id: applicationId,
      p_owner_id: ownerId,
      p_assignments: assignmentsToConfirm,
      p_original_application: originalApplication,
      p_confirmation_history: confirmationHistory,
      p_notes: notes ?? null,
      p_is_fixed_posting: isFixedPosting,
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
    const jobData = await loadAndVerifyJobPostingOwner(
      applicationData.jobPostingId,
      reviewerId,
      '취소 요청 검토'
    );

    if (jobData.schedule.kind === 'fixed') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다.',
      });
    }

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
      await executeApproveCancellation(applicationData, jobData, reviewerId, now, input);
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

export async function executeCancelConfirmation(
  applicationId: string,
  ownerId: string,
  cancelReason?: string
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 시작', { applicationId, ownerId });

    const applicationData = await loadApplication(applicationId);

    if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '확정된 지원만 취소할 수 있습니다.',
      });
    }

    const jobData = await loadAndVerifyJobPostingOwner(
      applicationData.jobPostingId,
      ownerId,
      '확정 취소'
    );

    if (jobData.schedule.kind === 'fixed') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '고정공고는 1차 범위에서 확정 취소를 지원하지 않습니다.',
      });
    }

    const confirmationHistory = applicationData.confirmationHistory ?? [];
    const activeConfirmation = findActiveConfirmation(confirmationHistory);

    if (!activeConfirmation) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '취소할 확정 이력이 없습니다.',
      });
    }

    // 확정 이력에 취소 정보 추가
    const activeIndex = confirmationHistory.findIndex((entry) => !entry.cancelledAt);
    const updatedHistory = confirmationHistory.map((entry, index) =>
      index === activeIndex ? addCancellationToEntry(entry, cancelReason, ownerId) : entry
    );

    const restoredAssignments =
      applicationData.originalApplication?.assignments ?? applicationData.assignments;
    const now = new Date().toISOString();

    // 지원서 업데이트: 상태를 applied로 복원
    const { error: appError } = await supabase
      .from(TABLES.APPLICATIONS)
      .update({
        status: STATUS.APPLICATION.APPLIED,
        assignments: restoredAssignments,
        confirmation_history: updatedHistory,
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', applicationId)
      .eq('status', STATUS.APPLICATION.CONFIRMED);

    if (appError)
      handleSupabaseError(appError, { operation: '확정 취소', table: TABLES.APPLICATIONS });

    // 공고 정원 업데이트
    await updateJobPostingCapacity(
      applicationData.jobPostingId,
      jobData,
      activeConfirmation.assignments,
      'decrement',
      now
    );

    // 관련 WorkLog 삭제 (scheduled 상태만)
    await deleteScheduledWorkLogs(applicationData.applicantId, applicationData.jobPostingId);

    logger.info('확정 취소 성공', { applicationId });

    return {
      applicationId,
      cancelledAt: new Date(),
      restoredStatus: 'applied',
    };
  } catch (error) {
    rethrowOrHandle(error, '확정 취소 트랜잭션', { applicationId });
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function validateConfirmCapacity(
  isFixedPosting: boolean,
  assignmentsToConfirm: Assignment[],
  jobData: JobPosting,
  applicationData: Application
): void {
  if (isFixedPosting) {
    const fixedRoleId = assignmentsToConfirm[0]?.roleIds?.[0];
    if (
      !fixedRoleId ||
      assignmentsToConfirm.length !== 1 ||
      assignmentsToConfirm[0].roleIds.length !== 1
    ) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '고정공고는 역할 1개만 확정할 수 있습니다.',
      });
    }
    const fixedSchedule = jobData.schedule as {
      roleRequirements?: {
        role?: string;
        customRole?: string;
        count: number;
        filled?: number;
      }[];
    };
    const targetRole = (fixedSchedule.roleRequirements ?? []).find(
      (role) =>
        role.role === fixedRoleId || (role.role === 'other' && role.customRole === fixedRoleId)
    );
    if (!targetRole || (targetRole.filled ?? 0) >= targetRole.count) {
      throw new MaxCapacityReachedError({
        userMessage: '선택한 역할의 모집 인원이 마감되었습니다.',
        jobPostingId: applicationData.jobPostingId,
      });
    }
  } else {
    const slotCapacity = validateAssignmentSlotCapacity(jobData, assignmentsToConfirm);
    if (!slotCapacity.available) {
      throw new MaxCapacityReachedError({
        userMessage: '모집 인원이 마감되었습니다.',
        jobPostingId: applicationData.jobPostingId,
      });
    }
  }
}

/** @internal 서버 RPC 마이그레이션 완료 시 제거 예정 */
export async function createWorkLogsForConfirmation(
  assignmentsToConfirm: Assignment[],
  applicationData: Application,
  jobData: JobPosting,
  now: string
): Promise<string[]> {
  const workLogInserts: Record<string, unknown>[] = [];

  for (const assignment of assignmentsToConfirm) {
    const normalizedRole = normalizeAssignmentRole(assignment.roleIds[0]);
    for (const date of assignment.dates) {
      workLogInserts.push({
        staff_id: applicationData.applicantId,
        staff_name: applicationData.applicantName,
        job_posting_id: applicationData.jobPostingId,
        job_posting_name: jobData.title,
        owner_id: jobData.ownerId,
        role: normalizedRole.role,
        custom_role: normalizedRole.customRole ?? null,
        date,
        time_slot: assignment.timeSlot,
        is_time_to_be_announced: assignment.isTimeToBeAnnounced ?? false,
        tentative_description: assignment.tentativeDescription ?? null,
        status: STATUS.WORK_LOG.SCHEDULED,
        check_in_time: null,
        check_out_time: null,
        work_duration: null,
        payroll_amount: null,
        is_settled: false,
        assignment_group_id: assignment.groupId ?? null,
        check_method: assignment.checkMethod ?? 'individual',
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (workLogInserts.length === 0) return [];

  const { data: wlData, error: wlError } = await supabase
    .from(TABLES.WORK_LOGS)
    .insert(workLogInserts)
    .select('id');

  if (wlError) {
    handleSupabaseError(wlError, { operation: 'WorkLog 생성', table: TABLES.WORK_LOGS });
  }

  return ((wlData ?? []) as Record<string, unknown>[]).map((row) => row.id as string);
}

async function updateJobPostingCapacity(
  jobPostingId: string,
  jobData: JobPosting,
  assignments: Assignment[],
  direction: 'increment' | 'decrement',
  now: string
): Promise<void> {
  const assignmentCount = countAssignmentDates(assignments);
  const updatedSchedule = updatePostingScheduleFilled(jobData.schedule, assignments, direction);

  const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);

  const newFilledPositions =
    direction === 'increment'
      ? Math.max(0, jobData.filledPositions + assignmentCount)
      : Math.max(0, currentFilled - assignmentCount);

  const shouldClose =
    direction === 'increment' &&
    jobData.totalPositions > 0 &&
    newFilledPositions >= jobData.totalPositions;

  const shouldReopen =
    direction === 'decrement' &&
    jobData.status === STATUS.JOB_POSTING.CLOSED &&
    newFilledPositions < totalPositions;

  const jobUpdateData: Record<string, unknown> = {
    filled_positions: newFilledPositions,
    schedule: updatedSchedule,
    updated_at: now,
  };

  if (shouldClose && jobData.status !== STATUS.JOB_POSTING.CLOSED) {
    jobUpdateData.status = STATUS.JOB_POSTING.CLOSED;
  }
  if (shouldReopen) {
    jobUpdateData.status = STATUS.JOB_POSTING.ACTIVE;
  }

  const { error: jobError } = await supabase
    .from(TABLES.JOB_POSTINGS)
    .update(jobUpdateData)
    .eq('id', jobPostingId);

  if (jobError) {
    logger.warn('공고 정원 업데이트 실패 (비치명적)', {
      jobPostingId,
      error: jobError.message,
    });
  }
}

async function deleteScheduledWorkLogs(applicantId: string, jobPostingId: string): Promise<void> {
  const workLogIds = await fetchRelatedWorkLogIds(applicantId, jobPostingId);
  if (workLogIds.length > 0) {
    const { error: wlError } = await supabase
      .from(TABLES.WORK_LOGS)
      .delete()
      .in('id', workLogIds)
      .eq('status', STATUS.WORK_LOG.SCHEDULED);

    if (wlError) {
      logger.warn('WorkLog 삭제 실패 (비치명적)', { error: wlError.message });
    }
  }
}

async function executeApproveCancellation(
  applicationData: Application,
  jobData: JobPosting,
  reviewerId: string,
  now: string,
  input: ReviewCancellationInput
): Promise<void> {
  const confirmationHistory = applicationData.confirmationHistory ?? [];
  const activeConfirmation = findActiveConfirmation(confirmationHistory);

  if (!activeConfirmation) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '취소할 확정 이력이 없습니다.',
    });
  }

  // 확정 이력에 취소 정보 추가
  const activeIndex = confirmationHistory.findIndex((entry) => !entry.cancelledAt);
  const updatedHistory = confirmationHistory.map((entry, index) =>
    index === activeIndex
      ? addCancellationToEntry(entry, applicationData.cancellationRequest?.reason, reviewerId)
      : entry
  );

  const restoredAssignments =
    applicationData.originalApplication?.assignments ?? applicationData.assignments;

  const approvedCancellationRequest = {
    requestedAt: applicationData.cancellationRequest!.requestedAt,
    reason: applicationData.cancellationRequest!.reason,
    reviewedAt: now,
    reviewedBy: reviewerId,
    status: STATUS.CANCELLATION_REQUEST.APPROVED,
  };

  // 지원서 업데이트
  const { error: appError } = await supabase
    .from(TABLES.APPLICATIONS)
    .update({
      status: STATUS.APPLICATION.CANCELLED,
      assignments: restoredAssignments,
      confirmation_history: updatedHistory,
      cancellation_request: approvedCancellationRequest,
      cancelled_at: now,
      updated_at: now,
    })
    .eq('id', input.applicationId)
    .eq('status', STATUS.APPLICATION.CANCELLATION_PENDING);

  if (appError)
    handleSupabaseError(appError, {
      operation: '취소 요청 승인',
      table: TABLES.APPLICATIONS,
    });

  // 공고 정원 업데이트
  await updateJobPostingCapacity(
    applicationData.jobPostingId,
    jobData,
    activeConfirmation.assignments,
    'decrement',
    now
  );

  // 관련 WorkLog 삭제
  await deleteScheduledWorkLogs(applicationData.applicantId, applicationData.jobPostingId);
}

async function executeRejectCancellation(
  applicationData: Application,
  reviewerId: string,
  now: string,
  input: ReviewCancellationInput
): Promise<void> {
  const updatedCancellationRequest = {
    requestedAt: applicationData.cancellationRequest!.requestedAt,
    reason: applicationData.cancellationRequest!.reason,
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
