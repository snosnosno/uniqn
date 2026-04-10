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
  MaxCapacityReachedError,
  ValidationError,
  ERROR_CODES,
  isAppError,
} from '@/errors';
import { handleSupabaseError, toCamelCase, createRealtimeSubscription } from '@/utils/supabase';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import {
  applicationValidator,
  validateRequiredAnswers,
  createHistoryEntry,
  findActiveConfirmation,
  addCancellationToEntry,
  updatePostingScheduleFilled,
  validateAssignmentSlotCapacity,
} from '@/domains/application';
import { selectPostingWorkflow } from '@/domains/job-posting';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import {
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  normalizeAssignmentRole,
  isValidAssignment,
} from '@/types/assignment';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import { STATUS } from '@/constants';
import type { UnsubscribeFn } from '@/types/common';
import type {
  Application,
  ApplicationStatus,
  ApplicationStats,
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

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  APPLICATIONS: 'applications',
  JOB_POSTINGS: 'job_postings',
  WORK_LOGS: 'work_logs',
} as const;

const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  STATUS.APPLICATION.APPLIED,
  STATUS.APPLICATION.CONFIRMED,
  STATUS.APPLICATION.CANCELLATION_PENDING,
]);

const EMPLOYER_REALTIME_LIMIT = 300;

// ============================================================================
// Helpers
// ============================================================================

function toApplication(row: Record<string, unknown>): Application | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseApplicationDocument({ ...camel, id: row.id });
}

function rowsToApplications(rows: Record<string, unknown>[]): Application[] {
  const items: Application[] = [];
  for (const row of rows) {
    const app = toApplication(row);
    if (app) items.push(app);
  }
  return items;
}

function toJobPosting(row: Record<string, unknown>): JobPosting | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseJobPostingDocument({ ...camel, id: row.id });
}

function createEmptyApplicationStats(): ApplicationStats {
  return {
    total: 0,
    applied: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    cancellationPending: 0,
  };
}

/** 공통 catch 핸들러 — isAppError이면 rethrow, 아니면 로그 + handleSupabaseError */
function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLES.APPLICATIONS });
}

async function loadApplication(applicationId: string): Promise<Application> {
  const { data, error } = await supabase
    .from(TABLES.APPLICATIONS)
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation: '지원서 조회', table: TABLES.APPLICATIONS });
  if (!data) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: '지원 내역을 찾을 수 없습니다.',
    });
  }

  const app = toApplication(data as Record<string, unknown>);
  if (!app) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '지원 데이터가 올바르지 않습니다.',
    });
  }
  return app;
}

async function loadJobPosting(jobPostingId: string): Promise<JobPosting> {
  const { data, error } = await supabase
    .from(TABLES.JOB_POSTINGS)
    .select('*')
    .eq('id', jobPostingId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation: '공고 조회', table: TABLES.JOB_POSTINGS });
  if (!data) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  const jp = toJobPosting(data as Record<string, unknown>);
  if (!jp) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공고 데이터가 올바르지 않습니다.',
    });
  }
  return jp;
}

async function loadAndVerifyJobPostingOwner(
  jobPostingId: string,
  ownerId: string,
  operation: string
): Promise<JobPosting> {
  const jobData = await loadJobPosting(jobPostingId);
  if (jobData.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage: `본인 공고만 관리할 수 있습니다: ${operation}`,
    });
  }
  return jobData;
}

function countAssignmentDates(assignments: Assignment[]): number {
  return assignments.reduce((sum, a) => sum + a.dates.length, 0);
}

function buildCanonicalFixedAssignment(jobData: JobPosting, roleId: string): Assignment {
  if (jobData.schedule.kind !== 'fixed') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '고정공고 assignment를 생성할 수 없습니다.',
    });
  }
  return {
    roleIds: [roleId],
    timeSlot: jobData.schedule.startTime ?? FIXED_TIME_MARKER,
    dates: [FIXED_DATE_MARKER],
    isGrouped: false,
    checkMethod: 'individual',
  };
}

function buildApplicantListWithStats(
  applications: Application[],
  jobPosting: JobPosting,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): ApplicantListWithStats {
  const allApps: ApplicationWithJob[] = [];
  const stats = createEmptyApplicationStats();

  for (const app of applications) {
    allApps.push({ ...app, jobPosting });
    stats.total++;
    const statsKey = STATUS_TO_STATS_KEY[app.status];
    if (statsKey && statsKey !== 'total') {
      stats[statsKey]++;
    }
  }

  if (!statusFilter) {
    return { applications: allApps, stats };
  }

  const statusSet = new Set(Array.isArray(statusFilter) ? statusFilter : [statusFilter]);
  return {
    applications: allApps.filter((a) => statusSet.has(a.status)),
    stats,
  };
}

async function fetchRelatedWorkLogIds(
  applicantId: string,
  jobPostingId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.WORK_LOGS)
      .select('id')
      .eq('staff_id', applicantId)
      .eq('job_posting_id', jobPostingId);

    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map((r) => r.id as string);
  } catch {
    return [];
  }
}

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
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
      }
    );
  }

  async getByJobPostingId(jobPostingId: string): Promise<Application[]> {
    try {
      logger.info('공고별 지원서 조회', { jobPostingId });

      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('*')
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
      const applicationId = `${jobPostingId}_${applicantId}`;
      const { data, error } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('id, status')
        .eq('id', applicationId)
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
        .select('*')
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
      const applicationId = `${input.jobPostingId}_${context.applicantId}`;
      const { data: existingData } = await supabase
        .from(TABLES.APPLICATIONS)
        .select('id, status')
        .eq('id', applicationId)
        .maybeSingle();

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
        .select('*')
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
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
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
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
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
        // 승인: 확정 해제 + 상태 cancelled + WorkLog 삭제 + 공고 정원 감소
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

        // 공고 정원 감소
        const cancelledAssignments = activeConfirmation.assignments;
        const decrementCount = countAssignmentDates(cancelledAssignments);
        const updatedSchedule = updatePostingScheduleFilled(
          jobData.schedule,
          cancelledAssignments,
          'decrement'
        );

        const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
        const newFilledPositions = Math.max(0, currentFilled - decrementCount);
        const shouldReopen =
          jobData.status === STATUS.JOB_POSTING.CLOSED && newFilledPositions < totalPositions;

        const restoredAssignments =
          applicationData.originalApplication?.assignments ?? applicationData.assignments;

        const approvedCancellationRequest = {
          requestedAt: applicationData.cancellationRequest.requestedAt,
          reason: applicationData.cancellationRequest.reason,
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

        // 공고 업데이트
        const jobUpdateData: Record<string, unknown> = {
          filled_positions: newFilledPositions,
          schedule: updatedSchedule,
          updated_at: now,
        };
        if (shouldReopen) {
          jobUpdateData.status = STATUS.JOB_POSTING.ACTIVE;
        }

        const { error: jobError } = await supabase
          .from(TABLES.JOB_POSTINGS)
          .update(jobUpdateData)
          .eq('id', applicationData.jobPostingId);

        if (jobError) {
          logger.warn('공고 정원 업데이트 실패 (비치명적)', {
            jobPostingId: applicationData.jobPostingId,
            error: jobError.message,
          });
        }

        // 관련 WorkLog 삭제
        const workLogIds = await fetchRelatedWorkLogIds(
          applicationData.applicantId,
          applicationData.jobPostingId
        );
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
      } else {
        // 거절: 상태를 confirmed로 복원
        const updatedCancellationRequest = {
          requestedAt: applicationData.cancellationRequest.requestedAt,
          reason: applicationData.cancellationRequest.reason,
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
      const workLogIds: string[] = [];
      const now = new Date().toISOString();

      // WorkLog 생성 (비고정 공고만)
      if (!isFixedPosting) {
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

        if (workLogInserts.length > 0) {
          const { data: wlData, error: wlError } = await supabase
            .from(TABLES.WORK_LOGS)
            .insert(workLogInserts)
            .select('id');

          if (wlError) {
            handleSupabaseError(wlError, { operation: 'WorkLog 생성', table: TABLES.WORK_LOGS });
          }
          for (const row of (wlData ?? []) as Record<string, unknown>[]) {
            workLogIds.push(row.id as string);
          }
        }
      }

      // 지원서 업데이트
      const { error: appError } = await supabase
        .from(TABLES.APPLICATIONS)
        .update({
          status: STATUS.APPLICATION.CONFIRMED,
          assignments: assignmentsToConfirm,
          original_application: originalApplication,
          confirmation_history: confirmationHistory,
          confirmed_at: now,
          processed_by: ownerId,
          processed_at: now,
          ...(notes ? { notes } : {}),
          updated_at: now,
        })
        .eq('id', applicationId)
        .eq('status', STATUS.APPLICATION.APPLIED);

      if (appError)
        handleSupabaseError(appError, { operation: '지원 확정', table: TABLES.APPLICATIONS });

      // 공고 정원 업데이트
      const assignmentCount = countAssignmentDates(assignmentsToConfirm);
      const updatedSchedule = updatePostingScheduleFilled(
        jobData.schedule,
        assignmentsToConfirm,
        'increment'
      );
      const nextFilledPositions = Math.max(0, jobData.filledPositions + assignmentCount);
      const shouldClose =
        jobData.totalPositions > 0 && nextFilledPositions >= jobData.totalPositions;

      const jobUpdateData: Record<string, unknown> = {
        filled_positions: nextFilledPositions,
        schedule: updatedSchedule,
        updated_at: now,
      };
      if (shouldClose && jobData.status !== STATUS.JOB_POSTING.CLOSED) {
        jobUpdateData.status = STATUS.JOB_POSTING.CLOSED;
      }

      const { error: jobError } = await supabase
        .from(TABLES.JOB_POSTINGS)
        .update(jobUpdateData)
        .eq('id', applicationData.jobPostingId);

      if (jobError) {
        logger.warn('공고 정원 업데이트 실패 (비치명적)', {
          jobPostingId: applicationData.jobPostingId,
          error: jobError.message,
        });
      }

      logger.info('지원 확정 성공', { applicationId, workLogIds });

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

  async cancelConfirmationTransaction(
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

      // 공고 정원 감소
      const cancelledAssignments = activeConfirmation.assignments;
      const decrementCount = countAssignmentDates(cancelledAssignments);
      const updatedSchedule = updatePostingScheduleFilled(
        jobData.schedule,
        cancelledAssignments,
        'decrement'
      );

      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
      const newFilledPositions = Math.max(0, currentFilled - decrementCount);
      const shouldReopen =
        jobData.status === STATUS.JOB_POSTING.CLOSED && newFilledPositions < totalPositions;

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
      const jobUpdateData: Record<string, unknown> = {
        filled_positions: newFilledPositions,
        schedule: updatedSchedule,
        updated_at: now,
      };
      if (shouldReopen) {
        jobUpdateData.status = STATUS.JOB_POSTING.ACTIVE;
      }

      const { error: jobError } = await supabase
        .from(TABLES.JOB_POSTINGS)
        .update(jobUpdateData)
        .eq('id', applicationData.jobPostingId);

      if (jobError) {
        logger.warn('공고 정원 업데이트 실패 (비치명적)', {
          jobPostingId: applicationData.jobPostingId,
          error: jobError.message,
        });
      }

      // 관련 WorkLog 삭제 (scheduled 상태만)
      const workLogIds = await fetchRelatedWorkLogIds(
        applicationData.applicantId,
        applicationData.jobPostingId
      );
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
        .select('*')
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
          .select('*')
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
