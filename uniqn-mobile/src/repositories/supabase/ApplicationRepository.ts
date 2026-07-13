/**
 * UNIQN Mobile - Supabase Application Repository
 *
 * @description Supabase PostgREST 기반 Application Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 지원서 CRUD 및 상태 전이
 * 2. 지원/취소/확정/거절 트랜잭션 (PostgREST 순차 호출 + 낙관적 잠금)
 * 3. 구인자 전용 지원자 목록 및 실시간 구독
 * 4. 확정 이력(confirmationHistory) 관리
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  AlreadyAppliedError,
  ApplicationClosedError,
  ValidationError,
  ERROR_CODES,
} from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import { applicationValidator, validateRequiredAnswers } from '@/domains/application';
import { selectPostingWorkflow } from '@/domains/job-posting';
import { normalizeAssignmentRole, isValidAssignment } from '@/types/assignment';
import { STATUS } from '@/constants';
import type { UnsubscribeFn } from '@/types/common';
import type {
  Application,
  ApplicationStatus,
  Assignment,
  CreateApplicationInput,
  RecruitmentType,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  JobPosting,
} from '@/types';
import type {
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
  ApplicantListWithStats,
  ConfirmWithHistoryResult,
  CancelConfirmationResult,
  CancelActorType,
  SubscribeCallbacks,
} from '../interfaces';
import {
  TABLES,
  APPLICATION_COLUMNS,
  toApplication,
  rethrowOrHandle,
  loadApplication,
  loadJobPosting,
  loadAndVerifyJobPostingAccess,
  buildCanonicalFixedAssignment,
} from './ApplicationRepositoryHelpers';
import {
  executeGetById,
  executeGetByApplicantId,
  executeGetByApplicantIdWithStatuses,
  subscribeByApplicantIdWithStatuses,
  executeGetByJobPostingId,
  executeHasApplied,
  executeGetStatsByApplicantId,
  executeGetCancellationRequests,
  executeFindByJobPostingWithStats,
  subscribeByJobPosting,
} from './ApplicationRepositoryQueries';
import {
  executeConfirmWithHistory,
  executeReviewCancellation,
  executeCancelConfirmation,
} from './ApplicationRepositoryTransactions';

// ============================================================================
// Helpers
// ============================================================================

/**
 * 고정공고 지원의 assignment 정규화 + 정원 검증.
 * 역할 1개 단일 선택 강제 → 전체/역할별 정원 확인 → canonical assignment 생성.
 */
function normalizeFixedAssignment(
  jobData: JobPosting,
  assignments: CreateApplicationInput['assignments']
): Assignment[] {
  if (assignments.length !== 1) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '고정공고는 역할 1개만 선택해 지원할 수 있습니다.',
    });
  }
  const requestedRoleId = assignments[0]?.roleIds?.[0];
  if (!requestedRoleId || assignments[0].roleIds.length !== 1) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '지원할 역할을 선택해 주세요.',
    });
  }
  const totalCapacity = applicationValidator.checkTotalCapacity(jobData);
  if (!totalCapacity.available) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: totalCapacity.reason ?? '모집 인원이 마감되었습니다.',
    });
  }
  const roleCapacity = applicationValidator.checkRoleCapacity(jobData, requestedRoleId);
  if (!roleCapacity.available) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: roleCapacity.reason ?? '선택한 역할은 마감되었습니다.',
    });
  }
  return [buildCanonicalFixedAssignment(jobData, requestedRoleId)];
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseApplicationRepository implements IApplicationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(applicationId: string): Promise<ApplicationWithJob | null> {
    return executeGetById(applicationId);
  }

  async getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]> {
    return executeGetByApplicantId(applicantId);
  }

  async getByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    pageSize: number = 50
  ): Promise<Application[]> {
    return executeGetByApplicantIdWithStatuses(applicantId, statuses, pageSize);
  }

  subscribeByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    onData: (applications: Application[]) => void,
    onError: (error: Error) => void,
    pageSize: number = 50
  ): UnsubscribeFn {
    return subscribeByApplicantIdWithStatuses(applicantId, statuses, onData, onError, pageSize);
  }

  async getByJobPostingId(jobPostingId: string): Promise<Application[]> {
    return executeGetByJobPostingId(jobPostingId);
  }

  async hasApplied(jobPostingId: string, applicantId: string): Promise<boolean> {
    return executeHasApplied(jobPostingId, applicantId);
  }

  async getStatsByApplicantId(applicantId: string): Promise<Record<ApplicationStatus, number>> {
    return executeGetStatsByApplicantId(applicantId);
  }

  async getCancellationRequests(
    jobPostingId: string,
    ownerId: string
  ): Promise<ApplicationWithJob[]> {
    return executeGetCancellationRequests(jobPostingId, ownerId);
  }

  // ==========================================================================
  // 트랜잭션 (Write)
  // ==========================================================================

  async applyWithTransaction(
    input: CreateApplicationInput,
    context: ApplyContext
  ): Promise<Application> {
    try {
      logger.info('지원하기 시작', {
        jobPostingId: input.jobPostingId,
        applicantId: context.applicantId,
      });

      for (const assignment of input.assignments) {
        if (!isValidAssignment(assignment)) {
          throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
            userMessage: '지원 정보가 올바르지 않습니다. 역할, 시간, 날짜를 확인해 주세요.',
          });
        }
      }

      // 1. 공고 로드 + 상태 확인
      const jobData = await loadJobPosting(input.jobPostingId);

      if (jobData.status !== STATUS.JOB_POSTING.ACTIVE) {
        throw new ApplicationClosedError({
          userMessage: '지원이 마감된 공고입니다.',
          jobPostingId: input.jobPostingId,
        });
      }

      // 2. Assignment 정규화 + 검증
      const isFixedPosting = jobData.schedule.kind === 'fixed';
      const normalizedAssignments = isFixedPosting
        ? normalizeFixedAssignment(jobData, input.assignments)
        : input.assignments;

      if (!isFixedPosting) {
        const validation = applicationValidator.validateApplication(
          jobData,
          normalizedAssignments,
          input.preQuestionAnswers
        );
        if (!validation.isValid) {
          const firstError = validation.errors[0];
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: firstError?.message ?? '지원 정보를 확인해 주세요.',
          });
        }
      }

      // 사전 질문 답변 검증
      const questions = jobData.questions.items ?? [];
      if (questions.length > 0) {
        if (!input.preQuestionAnswers?.length) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '사전질문에 답변해 주세요.',
          });
        }
        if (!validateRequiredAnswers(input.preQuestionAnswers)) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '필수 질문에 모두 답변해 주세요.',
          });
        }
      }

      // 3. 중복 지원 확인 (낙관적 잠금 대신 사전 확인)
      const { data: existingData } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('id, status')
        .eq('job_posting_id', input.jobPostingId)
        .eq('applicant_id', context.applicantId)
        .maybeSingle();
      const existingRow = existingData as Record<string, unknown> | null;
      const applicationId = existingRow?.id as string | undefined;
      const existingStatus = existingRow ? (existingRow.status as ApplicationStatus) : null;

      if (existingStatus && existingStatus !== STATUS.APPLICATION.CANCELLED) {
        throw new AlreadyAppliedError({
          userMessage: '이미 지원한 공고입니다.',
          jobPostingId: input.jobPostingId,
          applicationId,
        });
      }

      // 4. 지원서 생성/재생성
      const recruitmentType: RecruitmentType = selectPostingWorkflow(jobData).recruitmentType;
      const firstAssignment = normalizedAssignments[0];
      const normalizedPrimaryRole = normalizeAssignmentRole(
        firstAssignment?.roleIds[0] ?? 'dealer'
      );
      const now = new Date().toISOString();

      const applicationData = {
        id: applicationId,
        applicant_id: context.applicantId,
        applicant_name: context.applicantName,
        ...(context.applicantPhone && { applicant_phone: context.applicantPhone }),
        ...(context.applicantEmail && { applicant_email: context.applicantEmail }),
        ...(context.applicantNickname && { applicant_nickname: context.applicantNickname }),
        ...(context.applicantPhotoURL && { applicant_photo_url: context.applicantPhotoURL }),
        ...(context.applicantPhotoURLBlurhash && {
          applicant_photo_url_blurhash: context.applicantPhotoURLBlurhash,
        }),
        applicant_role: normalizedPrimaryRole.role,
        ...(normalizedPrimaryRole.customRole && { custom_role: normalizedPrimaryRole.customRole }),
        job_posting_id: input.jobPostingId,
        job_posting_title: jobData.title || '',
        ...(jobData.workDate ? { job_posting_date: jobData.workDate } : {}),
        status: STATUS.APPLICATION.APPLIED,
        ...(input.message && { message: input.message }),
        recruitment_type: recruitmentType,
        assignments: normalizedAssignments,
        ...(input.preQuestionAnswers && { pre_question_answers: input.preQuestionAnswers }),
        is_read: false,
        // 개보법 §17 — 지원 시점 제3자 제공 동의 기록
        applicant_provision_consent_at: input.provisionConsentAt,
        applicant_provision_consent_version: input.provisionConsentVersion,
        updated_at: now,
        ...(existingStatus ? {} : { created_at: now }),
      };

      const { data: upsertedData, error: upsertError } = await supabase
        .from(TABLES.APPLICATIONS)
        .upsert(applicationData)
        .select(APPLICATION_COLUMNS)
        .single();

      if (upsertError) {
        handleSupabaseError(upsertError, { operation: '지원하기', table: TABLES.APPLICATIONS });
      }

      const result = toApplication(upsertedData as Record<string, unknown>);
      if (!result) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '지원 데이터 생성 후 파싱에 실패했습니다.',
        });
      }

      logger.info('지원하기 성공', { applicationId, jobPostingId: input.jobPostingId });
      return result;
    } catch (error) {
      rethrowOrHandle(error, '지원하기 트랜잭션', {
        jobPostingId: input.jobPostingId,
        applicantId: context.applicantId,
      });
    }
  }

  async cancelWithTransaction(applicationId: string, applicantId: string): Promise<void> {
    try {
      logger.info('지원 취소 시작', { applicationId, applicantId });

      const applicationData = await loadApplication(applicationId);

      if (applicationData.applicantId !== applicantId) {
        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '본인 지원만 취소할 수 있습니다.',
        });
      }

      if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_CANCELLED, {
          userMessage: '이미 취소된 지원입니다.',
        });
      }

      if (applicationData.status === STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED, {
          userMessage: '확정된 지원은 직접 취소할 수 없습니다. 취소 요청을 이용해 주세요.',
        });
      }

      // 낙관적 잠금: 현재 상태 일치 시에만 업데이트
      const { error } = await supabase
        .from(TABLES.APPLICATIONS)
        .update({
          status: STATUS.APPLICATION.CANCELLED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('status', applicationData.status);

      if (error) handleSupabaseError(error, { operation: '지원 취소', table: TABLES.APPLICATIONS });

      logger.info('지원 취소 성공', { applicationId });
    } catch (error) {
      rethrowOrHandle(error, '지원 취소', { applicationId, applicantId });
    }
  }

  async requestCancellationWithTransaction(
    input: RequestCancellationInput,
    applicantId: string
  ): Promise<void> {
    try {
      logger.info('취소 요청 제출 시작', { applicationId: input.applicationId, applicantId });

      if (!input.reason || input.reason.trim().length < 5) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '취소 사유를 5자 이상 입력해 주세요.',
        });
      }

      const applicationData = await loadApplication(input.applicationId);
      const jobData = await loadJobPosting(applicationData.jobPostingId);

      if (applicationData.applicantId !== applicantId) {
        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '본인 지원만 취소 요청할 수 있습니다.',
        });
      }

      if (jobData.schedule.kind === 'fixed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다.',
        });
      }

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원만 취소 요청할 수 있습니다.',
        });
      }

      if (applicationData.cancellationRequest?.status === STATUS.CANCELLATION_REQUEST.PENDING) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
          userMessage: '이미 취소 요청이 진행 중입니다.',
        });
      }

      const cancellationRequest = {
        requestedAt: new Date().toISOString(),
        reason: input.reason.trim(),
        status: STATUS.CANCELLATION_REQUEST.PENDING,
      };

      const { error } = await supabase
        .from(TABLES.APPLICATIONS)
        .update({
          status: STATUS.APPLICATION.CANCELLATION_PENDING,
          cancellation_request: cancellationRequest,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.applicationId)
        .eq('status', STATUS.APPLICATION.CONFIRMED);

      if (error)
        handleSupabaseError(error, { operation: '취소 요청 제출', table: TABLES.APPLICATIONS });

      logger.info('취소 요청 제출 성공', { applicationId: input.applicationId });
    } catch (error) {
      rethrowOrHandle(error, '취소 요청 제출', {
        applicationId: input.applicationId,
        applicantId,
      });
    }
  }

  async reviewCancellationWithTransaction(
    input: ReviewCancellationInput,
    reviewerId: string
  ): Promise<void> {
    return executeReviewCancellation(input, reviewerId);
  }

  async rejectWithTransaction(input: RejectApplicationInput, reviewerId: string): Promise<void> {
    try {
      logger.info('지원 거절 시작', { applicationId: input.applicationId, reviewerId });

      const applicationData = await loadApplication(input.applicationId);
      const jobData = await loadAndVerifyJobPostingAccess(
        applicationData.jobPostingId,
        reviewerId,
        '지원 거절'
      );

      void jobData; // 소유자 검증만 수행

      if (applicationData.status !== STATUS.APPLICATION.APPLIED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: `지원 상태가 '${applicationData.status}'입니다. 대기중인 지원만 거절할 수 있습니다.`,
        });
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLES.APPLICATIONS)
        .update({
          status: STATUS.APPLICATION.REJECTED,
          rejection_reason: input.reason || '',
          processed_by: reviewerId,
          processed_at: now,
          updated_at: now,
        })
        .eq('id', input.applicationId)
        .eq('status', STATUS.APPLICATION.APPLIED);

      if (error) handleSupabaseError(error, { operation: '지원 거절', table: TABLES.APPLICATIONS });

      logger.info('지원 거절 성공', { applicationId: input.applicationId });
    } catch (error) {
      rethrowOrHandle(error, '지원 거절', {
        applicationId: input.applicationId,
        reviewerId,
      });
    }
  }

  async markAsRead(applicationId: string, ownerId: string): Promise<void> {
    try {
      logger.info('지원 읽음 처리 시작', { applicationId, ownerId });

      const applicationData = await loadApplication(applicationId);
      await loadAndVerifyJobPostingAccess(applicationData.jobPostingId, ownerId, '지원 읽음 처리');

      const { error } = await supabase
        .from(TABLES.APPLICATIONS)
        .update({
          is_read: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error)
        handleSupabaseError(error, { operation: '지원 읽음 처리', table: TABLES.APPLICATIONS });

      logger.info('지원 읽음 처리 성공', { applicationId });
    } catch (error) {
      rethrowOrHandle(error, '지원 읽음 처리', { applicationId, ownerId });
    }
  }

  async confirmWithHistoryTransaction(
    applicationId: string,
    selectedAssignments: Assignment[] | undefined,
    ownerId: string,
    notes?: string
  ): Promise<ConfirmWithHistoryResult> {
    return executeConfirmWithHistory(applicationId, selectedAssignments, ownerId, notes);
  }

  async cancelConfirmationTransaction(
    applicationId: string,
    ownerId: string,
    cancelReason?: string,
    actorType?: CancelActorType
  ): Promise<CancelConfirmationResult> {
    return executeCancelConfirmation(applicationId, ownerId, cancelReason, actorType);
  }

  // ==========================================================================
  // 구인자 전용 (Employer)
  // ==========================================================================

  async findByJobPostingWithStats(
    jobPostingId: string,
    ownerId: string,
    statusFilter?: ApplicationStatus | ApplicationStatus[]
  ): Promise<ApplicantListWithStats> {
    return executeFindByJobPostingWithStats(jobPostingId, ownerId, statusFilter);
  }

  subscribeByJobPosting(
    jobPostingId: string,
    ownerId: string,
    callbacks: SubscribeCallbacks,
    options?: { verifyOwnership?: boolean }
  ): UnsubscribeFn {
    return subscribeByJobPosting(jobPostingId, ownerId, callbacks, options);
  }
}
