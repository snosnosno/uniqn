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
  toError,
  BusinessError,
  PermissionError,
  AlreadyAppliedError,
  ApplicationClosedError,
  ValidationError,
  ERROR_CODES,
} from '@/errors';
import { handleSupabaseError, createRealtimeSubscription } from '@/utils/supabase';
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
  SubscribeCallbacks,
} from '../interfaces';
import {
  TABLES,
  ACTIVE_APPLICATION_STATUSES,
  EMPLOYER_REALTIME_LIMIT,
  APPLICATION_COLUMNS,
  JOB_POSTING_COLUMNS,
  toApplication,
  rowsToApplications,
  toJobPosting,
  rethrowOrHandle,
  loadApplication,
  loadJobPosting,
  loadAndVerifyJobPostingOwner,
  buildCanonicalFixedAssignment,
  buildApplicantListWithStats,
} from './ApplicationRepositoryHelpers';
import {
  executeConfirmWithHistory,
  executeReviewCancellation,
  executeCancelConfirmation,
} from './ApplicationRepositoryTransactions';

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseApplicationRepository implements IApplicationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(applicationId: string): Promise<ApplicationWithJob | null> {
    try {
      logger.info('지원 상세 조회', { applicationId });

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('id', applicationId)
        .maybeSingle();

      if (error)
        handleSupabaseError(error, { operation: '지원 상세 조회', table: TABLES.APPLICATIONS });
      if (!data) return null;

      const application = toApplication(data as Record<string, unknown>);
      if (!application) {
        logger.warn('지원 상세 데이터 파싱 실패', { applicationId });
        return null;
      }

      // 공고 정보 조인
      const { data: jobData } = await supabase
        .from(TABLES.JOB_POSTINGS)
        .select(JOB_POSTING_COLUMNS)
        .eq('id', application.jobPostingId)
        .maybeSingle();

      const jobPosting = jobData ? toJobPosting(jobData as Record<string, unknown>) : null;

      return {
        ...application,
        ...(jobPosting ? { jobPosting } : {}),
      };
    } catch (error) {
      rethrowOrHandle(error, '지원 상세 조회', { applicationId });
    }
  }

  async getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]> {
    try {
      logger.info('내 지원 내역 조회', { applicantId });

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('applicant_id', applicantId)
        .order('created_at', { ascending: false });

      if (error)
        handleSupabaseError(error, { operation: '내 지원 내역 조회', table: TABLES.APPLICATIONS });

      const applications = rowsToApplications((data ?? []) as Record<string, unknown>[]);
      if (applications.length === 0) return [];

      // 공고 배치 조회
      const jobPostingIds = [...new Set(applications.map((a) => a.jobPostingId))];
      const { data: jobData } = await supabase
        .from(TABLES.JOB_POSTINGS)
        .select(JOB_POSTING_COLUMNS)
        .in('id', jobPostingIds);

      const jobMap = new Map<string, JobPosting>();
      for (const row of (jobData ?? []) as Record<string, unknown>[]) {
        const jp = toJobPosting(row);
        if (jp) jobMap.set(jp.id, jp);
      }

      return applications.map((app) => {
        const jp = jobMap.get(app.jobPostingId);
        return jp ? { ...app, jobPosting: jp } : app;
      });
    } catch (error) {
      rethrowOrHandle(error, '내 지원 내역 조회', { applicantId });
    }
  }

  async getByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    pageSize: number = 50
  ): Promise<Application[]> {
    try {
      logger.info('상태 필터 지원 내역 조회', { applicantId, statuses, pageSize });

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('applicant_id', applicantId)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error)
        handleSupabaseError(error, {
          operation: '상태 필터 지원 내역 조회',
          table: TABLES.APPLICATIONS,
        });

      return rowsToApplications((data ?? []) as Record<string, unknown>[]);
    } catch (error) {
      rethrowOrHandle(error, '상태 필터 지원 내역 조회', { applicantId, statuses });
    }
  }

  subscribeByApplicantIdWithStatuses(
    applicantId: string,
    statuses: ApplicationStatus[],
    onData: (applications: Application[]) => void,
    onError: (error: Error) => void,
    _pageSize: number = 50
  ): UnsubscribeFn {
    logger.info('지원 상태 필터 실시간 구독 시작', { applicantId, statuses });

    if (statuses.length === 0) {
      onData([]);
      return () => undefined;
    }

    return createRealtimeSubscription(
      TABLES.APPLICATIONS,
      `applicant_id=eq.${applicantId}`,
      (payload) => {
        try {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
          if (!row) return;

          // Realtime은 개별 변경만 오므로, 전체 목록을 다시 조회
          void this.getByApplicantIdWithStatuses(applicantId, statuses, _pageSize)
            .then(onData)
            .catch(onError);
        } catch (error) {
          onError(toError(error));
        }
      },
      (status) => {
        // TIMED_OUT은 Phoenix가 자동 재시도 — CHANNEL_ERROR만 상위로 전파
        if (status === 'CHANNEL_ERROR') {
          onError(new Error(`Realtime 채널 에러: ${TABLES.APPLICATIONS}`));
        }
      }
    );
  }

  async getByJobPostingId(jobPostingId: string): Promise<Application[]> {
    try {
      logger.info('공고별 지원서 조회', { jobPostingId });

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .order('created_at', { ascending: false });

      if (error)
        handleSupabaseError(error, { operation: '공고별 지원서 조회', table: TABLES.APPLICATIONS });

      return rowsToApplications((data ?? []) as Record<string, unknown>[]);
    } catch (error) {
      rethrowOrHandle(error, '공고별 지원서 조회', { jobPostingId });
    }
  }

  async hasApplied(jobPostingId: string, applicantId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('id, status')
        .eq('job_posting_id', jobPostingId)
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (error || !data) return false;

      const row = data as Record<string, unknown>;
      return ACTIVE_APPLICATION_STATUSES.has(row.status as ApplicationStatus);
    } catch {
      return false;
    }
  }

  async getStatsByApplicantId(applicantId: string): Promise<Record<ApplicationStatus, number>> {
    try {
      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('status')
        .eq('applicant_id', applicantId);

      if (error)
        handleSupabaseError(error, { operation: '지원 통계 조회', table: TABLES.APPLICATIONS });

      const stats: Record<ApplicationStatus, number> = {
        applied: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        completed: 0,
        cancellation_pending: 0,
      };

      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const status = row.status as ApplicationStatus;
        if (status && status in stats) {
          stats[status]++;
        }
      }

      return stats;
    } catch (error) {
      rethrowOrHandle(error, '지원 통계 조회', { applicantId });
    }
  }

  async getCancellationRequests(
    jobPostingId: string,
    ownerId: string
  ): Promise<ApplicationWithJob[]> {
    try {
      logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

      const jobData = await loadAndVerifyJobPostingOwner(
        jobPostingId,
        ownerId,
        '취소 요청 목록 조회'
      );

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('status', STATUS.APPLICATION.CANCELLATION_PENDING)
        .order('updated_at', { ascending: false });

      if (error)
        handleSupabaseError(error, {
          operation: '취소 요청 목록 조회',
          table: TABLES.APPLICATIONS,
        });

      const applications = rowsToApplications((data ?? []) as Record<string, unknown>[]);

      return applications.map((app) => ({ ...app, jobPosting: jobData }));
    } catch (error) {
      rethrowOrHandle(error, '취소 요청 목록 조회', { jobPostingId });
    }
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
        ? (() => {
            if (input.assignments.length !== 1) {
              throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
                userMessage: '고정공고는 역할 1개만 선택해 지원할 수 있습니다.',
              });
            }
            const requestedRoleId = input.assignments[0]?.roleIds?.[0];
            if (!requestedRoleId || input.assignments[0].roleIds.length !== 1) {
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
          })()
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
      const applicationId = (existingData as Record<string, unknown> | null)?.id as
        | string
        | undefined;

      const existingStatus = existingData
        ? ((existingData as Record<string, unknown>).status as ApplicationStatus)
        : null;

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
      const jobData = await loadAndVerifyJobPostingOwner(
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
      await loadAndVerifyJobPostingOwner(applicationData.jobPostingId, ownerId, '지원 읽음 처리');

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
    cancelReason?: string
  ): Promise<CancelConfirmationResult> {
    return executeCancelConfirmation(applicationId, ownerId, cancelReason);
  }

  // ==========================================================================
  // 구인자 전용 (Employer)
  // ==========================================================================

  async findByJobPostingWithStats(
    jobPostingId: string,
    ownerId: string,
    statusFilter?: ApplicationStatus | ApplicationStatus[]
  ): Promise<ApplicantListWithStats> {
    try {
      logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

      const jobPosting = await loadAndVerifyJobPostingOwner(
        jobPostingId,
        ownerId,
        '지원자 목록 조회'
      );

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select(APPLICATION_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .order('created_at', { ascending: false });

      if (error)
        handleSupabaseError(error, { operation: '지원자 목록 조회', table: TABLES.APPLICATIONS });

      const applications = rowsToApplications((data ?? []) as Record<string, unknown>[]);
      const result = buildApplicantListWithStats(applications, jobPosting, statusFilter);

      logger.info('지원자 목록 조회 완료', {
        jobPostingId,
        total: result.stats.total,
        filtered: result.applications.length,
      });

      return result;
    } catch (error) {
      rethrowOrHandle(error, '지원자 목록 조회', { jobPostingId });
    }
  }

  subscribeByJobPosting(
    jobPostingId: string,
    ownerId: string,
    callbacks: SubscribeCallbacks,
    options?: { verifyOwnership?: boolean }
  ): UnsubscribeFn {
    logger.info('지원자 목록 실시간 구독 시작', { jobPostingId, ownerId });

    let cachedJobPosting: JobPosting | null = null;
    let isOwnerVerified = false;

    const handleUpdate = async () => {
      try {
        if (!isOwnerVerified) {
          cachedJobPosting = await loadAndVerifyJobPostingOwner(
            jobPostingId,
            ownerId,
            '지원자 실시간 구독'
          );
          if (options?.verifyOwnership === false) {
            cachedJobPosting = await loadJobPosting(jobPostingId);
          }
          isOwnerVerified = true;
        }

        const { data, error } = await supabase
          .from(TABLES.APPLICATIONS)
          .select(APPLICATION_COLUMNS)
          .eq('job_posting_id', jobPostingId)
          .order('created_at', { ascending: false })
          .limit(EMPLOYER_REALTIME_LIMIT);

        if (error) {
          handleSupabaseError(error, {
            operation: '지원자 실시간 조회',
            table: TABLES.APPLICATIONS,
          });
        }

        const applications = rowsToApplications((data ?? []) as Record<string, unknown>[]);
        const result = buildApplicantListWithStats(applications, cachedJobPosting as JobPosting);

        callbacks.onUpdate(result);
      } catch (error) {
        logger.error('지원자 목록 실시간 구독 처리 실패', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    };

    // 초기 로드
    void handleUpdate();

    // Realtime 구독: 변경 시 전체 목록 재조회
    return createRealtimeSubscription(
      TABLES.APPLICATIONS,
      `job_posting_id=eq.${jobPostingId}`,
      () => {
        void handleUpdate();
      }
    );
  }
}
