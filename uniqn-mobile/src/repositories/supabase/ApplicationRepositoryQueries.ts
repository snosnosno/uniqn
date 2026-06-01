/**
 * UNIQN Mobile - Application Repository Queries
 *
 * @description ApplicationRepository에서 사용하는 조회/실시간 구독 standalone 함수
 * 읽기 전용 쿼리(getById/getByApplicantId/...)와 Realtime 구독(subscribeXxx)
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, NetworkError, ERROR_CODES } from '@/errors';
import { handleSupabaseError, createRealtimeSubscription } from '@/utils/supabase';
import { STATUS } from '@/constants';
import type { UnsubscribeFn } from '@/types/common';
import type { Application, ApplicationStatus, JobPosting } from '@/types';
import type { ApplicationWithJob, ApplicantListWithStats, SubscribeCallbacks } from '../interfaces';
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
  loadJobPosting,
  loadAndVerifyJobPostingAccess,
  buildApplicantListWithStats,
} from './ApplicationRepositoryHelpers';

// ============================================================================
// 조회 (Read)
// ============================================================================

export async function executeGetById(applicationId: string): Promise<ApplicationWithJob | null> {
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

export async function executeGetByApplicantId(applicantId: string): Promise<ApplicationWithJob[]> {
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

export async function executeGetByApplicantIdWithStatuses(
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

export function subscribeByApplicantIdWithStatuses(
  applicantId: string,
  statuses: ApplicationStatus[],
  onData: (applications: Application[]) => void,
  onError: (error: Error) => void,
  pageSize: number = 50
): UnsubscribeFn {
  logger.info('지원 상태 필터 실시간 구독 시작', { applicantId, statuses });

  if (statuses.length === 0) {
    onData([]);
    return () => undefined;
  }

  // 초기 데이터 1회 fetch — 변경 이벤트가 오지 않아도 구독자가 빈 상태에서 탈출
  void executeGetByApplicantIdWithStatuses(applicantId, statuses, pageSize)
    .then(onData)
    .catch((error) => onError(toError(error)));

  return createRealtimeSubscription(
    TABLES.APPLICATIONS,
    `applicant_id=eq.${applicantId}`,
    (payload) => {
      try {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        if (!row) return;

        // Realtime은 개별 변경만 오므로, 전체 목록을 다시 조회
        void executeGetByApplicantIdWithStatuses(applicantId, statuses, pageSize)
          .then(onData)
          .catch(onError);
      } catch (error) {
        onError(toError(error));
      }
    },
    (status) => {
      if (status === 'CHANNEL_ERROR') {
        // 일시 장애 — 상위에 통지하되, Phoenix가 자동 재연결을 시도한다.
        // 'RECOVERED' 신호가 오면 데이터를 재동기화한다.
        // isRetryable=true로 소비자가 warn 수준으로 다운그레이드할 수 있도록 표시.
        onError(
          new NetworkError(ERROR_CODES.NETWORK_REALTIME_TRANSIENT, {
            message: `Realtime 채널 에러: ${TABLES.APPLICATIONS}`,
            severity: 'low',
          })
        );
      } else if (status === 'RECOVERED') {
        // 재연결 성공 — 끊긴 동안 놓친 변경을 반영하기 위해 전체 목록 재조회.
        logger.info('Realtime 채널 복구 — 데이터 재동기화', { applicantId });
        void executeGetByApplicantIdWithStatuses(applicantId, statuses, pageSize)
          .then(onData)
          .catch(onError);
      }
      // TIMED_OUT은 Phoenix가 자동 재시도 — 상위로 전파하지 않음
    }
  );
}

export async function executeGetByJobPostingId(jobPostingId: string): Promise<Application[]> {
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

export async function executeHasApplied(
  jobPostingId: string,
  applicantId: string
): Promise<boolean> {
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

export async function executeGetStatsByApplicantId(
  applicantId: string
): Promise<Record<ApplicationStatus, number>> {
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

export async function executeGetCancellationRequests(
  jobPostingId: string,
  ownerId: string
): Promise<ApplicationWithJob[]> {
  try {
    logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

    const jobData = await loadAndVerifyJobPostingAccess(
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

// ============================================================================
// 구인자 전용 (Employer)
// ============================================================================

export async function executeFindByJobPostingWithStats(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListWithStats> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    const jobPosting = await loadAndVerifyJobPostingAccess(
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

export function subscribeByJobPosting(
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
        cachedJobPosting = await loadAndVerifyJobPostingAccess(
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
