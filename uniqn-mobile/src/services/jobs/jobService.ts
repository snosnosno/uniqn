/**
 * UNIQN Mobile - 구인공고 서비스
 *
 * @description Repository 패턴 기반 구인공고 서비스
 * @version 2.1.0 - getJobPostings Repository 이관
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Firebase
 *
 * 책임 분리:
 * - Service: 비즈니스 로직 조합, 검색, Analytics
 * - Repository: 데이터 접근 + 쿼리 빌딩 캡슐화
 */

import type { UnsubscribeFn, PaginationCursor } from '@/types/common';
import { logger } from '@/utils/logger';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import { handleServiceError, handleSilentError } from '@/errors/serviceErrorHandler';
import { startApiTrace } from '@/services/observability';
import { jobPostingRepository, type PaginatedJobPostings } from '@/repositories';
import { supabase } from '@/lib/supabase';
import { RealtimeManager } from '@/shared/realtime';
import type { JobPosting, JobPostingFilters, JobPostingCard } from '@/types';
import { toJobPostingCard } from '@/domains/job-posting';
import { STATUS } from '@/constants';

/**
 * 공고 ID 목록에 대해 활성 지원 카운트를 실시간으로 조회해서 stats 를 덮어쓴다.
 * denormalized counter(job_postings.stats.totalApplicants) 가 trigger drift 로 상세/목록 간 불일치를
 * 보이는 이슈(QA: EJ-001) 방어용. 단일 배치 쿼리로 N+1 회피.
 */
async function hydrateApplicantCounts(postings: JobPosting[]): Promise<JobPosting[]> {
  if (postings.length === 0) return postings;
  const ids = postings.map((p) => p.id);
  const { data, error } = await supabase
    .from('applications')
    .select('job_posting_id,status')
    .in('job_posting_id', ids)
    .in('status', [
      STATUS.APPLICATION.APPLIED,
      STATUS.APPLICATION.CONFIRMED,
      STATUS.APPLICATION.CANCELLATION_PENDING,
    ]);
  if (error) {
    handleSilentError(error, { operation: '지원자 카운트 하이드레이션', component: 'jobService' });
    return postings;
  }
  type Counts = { total: number; active: number; confirmed: number; cancellationPending: number };
  const bucket = new Map<string, Counts>();
  for (const row of (data ?? []) as { job_posting_id: string; status: string }[]) {
    const counts = bucket.get(row.job_posting_id) ?? {
      total: 0,
      active: 0,
      confirmed: 0,
      cancellationPending: 0,
    };
    counts.total += 1;
    if (row.status === STATUS.APPLICATION.APPLIED) counts.active += 1;
    else if (row.status === STATUS.APPLICATION.CONFIRMED) counts.confirmed += 1;
    else if (row.status === STATUS.APPLICATION.CANCELLATION_PENDING)
      counts.cancellationPending += 1;
    bucket.set(row.job_posting_id, counts);
  }
  return postings.map((posting) => {
    const live = bucket.get(posting.id);
    if (!live) {
      return {
        ...posting,
        stats: {
          ...(posting.stats ?? {
            totalApplicants: 0,
            activeApplicants: 0,
            confirmedApplicants: 0,
            cancellationPendingApplicants: 0,
            filledPositions: 0,
          }),
          totalApplicants: 0,
          activeApplicants: 0,
          confirmedApplicants: 0,
          cancellationPendingApplicants: 0,
        },
      };
    }
    return {
      ...posting,
      stats: {
        ...(posting.stats ?? { filledPositions: 0 }),
        totalApplicants: live.total,
        activeApplicants: live.active,
        confirmedApplicants: live.confirmed,
        cancellationPendingApplicants: live.cancellationPending,
        filledPositions: posting.stats?.filledPositions ?? 0,
      },
    };
  });
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { PaginatedJobPostings } from '@/repositories';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Job Service
// ============================================================================

/**
 * 공고 목록 조회 (무한스크롤 지원)
 *
 * @description Repository를 통한 필터링 + 페이지네이션
 */
export async function getJobPostings(
  filters?: JobPostingFilters,
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastDocument?: PaginationCursor
): Promise<PaginatedJobPostings> {
  const trace = startApiTrace('getJobPostings');
  trace.putAttribute('pageSize', String(pageSize));
  if (filters?.status) trace.putAttribute('filter_status', filters.status);

  try {
    logger.info('공고 목록 조회', { filters, pageSize });

    const result = await jobPostingRepository.getList(filters, pageSize, lastDocument);

    logger.info('공고 목록 조회 완료', {
      count: result.items.length,
      hasMore: result.hasMore,
    });

    trace.putMetric('result_count', result.items.length);
    trace.putAttribute('status', 'success');
    trace.stop();

    return result;
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();
    throw handleServiceError(error, {
      operation: '공고 목록 조회',
      component: 'jobService',
      context: { filters, pageSize },
    });
  }
}

/**
 * 공고 상세 조회
 *
 * @description Repository를 통해 조회
 */
export async function getJobPostingById(id: string): Promise<JobPosting | null> {
  const trace = startApiTrace('getJobPostingById');
  trace.putAttribute('jobId', id);

  try {
    logger.info('공고 상세 조회', { id });

    const jobPosting = await jobPostingRepository.getById(id);

    if (!jobPosting) {
      logger.warn('공고를 찾을 수 없음', { id });
      trace.putAttribute('status', 'not_found');
      trace.stop();
      return null;
    }

    logger.info('공고 상세 조회 완료', { id, title: jobPosting.title });

    trace.putAttribute('status', 'success');
    trace.stop();

    return jobPosting;
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();
    throw handleServiceError(error, {
      operation: '공고 상세 조회',
      component: 'jobService',
      context: { jobPostingId: id },
    });
  }
}

export function subscribeToJobPosting(
  jobPostingId: string,
  callbacks: {
    onUpdate: (jobPosting: JobPosting | null) => void;
    onError?: (error: Error) => void;
  }
): UnsubscribeFn {
  return RealtimeManager.subscribe(RealtimeManager.Keys.jobPosting(jobPostingId), () => {
    logger.info('공고 상세 실시간 구독 시작', { jobPostingId });

    return jobPostingRepository.subscribeById(jobPostingId, {
      onUpdate: callbacks.onUpdate,
      onError: (error) => {
        const appError = handleServiceError(error, {
          operation: '공고 상세 구독',
          component: 'jobService',
          context: { jobPostingId },
        });
        callbacks.onError?.(appError as Error);
      },
    });
  });
}

/**
 * 조회수 증가
 *
 * @description Repository를 통해 업데이트
 */
export async function incrementViewCount(id: string): Promise<void> {
  try {
    await jobPostingRepository.incrementViewCount(id);
  } catch (error) {
    // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
    handleSilentError(error, {
      operation: '조회수 증가',
      component: 'jobService',
      context: { jobPostingId: id },
      logLevel: 'warn',
    });
  }
}

/**
 * 검색어로 공고 검색
 *
 * @description SearchProvider 추상화 사용 - 향후 Algolia 전환 용이
 * @see searchService.ts
 */
export async function searchJobPostings(
  searchTerm: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<JobPosting[]> {
  try {
    // 최소 검색어 길이 2글자 (노이즈 제거)
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      return [];
    }

    // 지연 로딩으로 순환 참조 방지
    const { ClientSideSearchProvider } = await import('./searchService');

    const searchProvider = new ClientSideSearchProvider(async () => {
      const { items } = await getJobPostings({ status: STATUS.JOB_POSTING.ACTIVE }, 300);
      return items.filter(isCanonicalDatedPosting);
    });

    const result = await searchProvider.search(trimmed, {
      limit: pageSize,
      fields: ['title', 'location.name', 'description', 'ownerName'],
    });

    return result.items;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 검색',
      component: 'jobService',
      context: { searchTerm },
    });
  }
}

/**
 * 긴급 공고 목록 조회
 */
export async function getUrgentJobPostings(pageSize: number = 10): Promise<JobPosting[]> {
  try {
    const { items } = await getJobPostings(
      { status: STATUS.JOB_POSTING.ACTIVE, isUrgent: true },
      pageSize
    );
    return items;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '긴급 공고 조회',
      component: 'jobService',
      context: { pageSize },
    });
  }
}

/**
 * 내 공고 목록 조회 (구인자용)
 */
export async function getMyJobPostings(
  ownerId: string,
  options?: { status?: JobPosting['status']; includeAll?: boolean }
): Promise<JobPosting[]> {
  try {
    const { status, includeAll = true } = options || {};
    logger.info('내 공고 목록 조회', { ownerId, status, includeAll });

    // includeAll이 true면 모든 상태의 공고 조회 (active, closed)
    if (includeAll && !status) {
      const results = await Promise.all([
        jobPostingRepository.getByOwnerId(ownerId, STATUS.JOB_POSTING.ACTIVE),
        jobPostingRepository.getByOwnerId(ownerId, STATUS.JOB_POSTING.CLOSED),
      ]);
      return hydrateApplicantCounts([...results[0], ...results[1]]);
    }

    const postings = await jobPostingRepository.getByOwnerId(
      ownerId,
      status || STATUS.JOB_POSTING.ACTIVE
    );
    return hydrateApplicantCounts(postings);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 공고 조회',
      component: 'jobService',
      context: { ownerId }, // ownerId 자동 마스킹
    });
  }
}

/**
 * JobPosting을 카드 형태로 변환
 *
 * @description toJobPostingCard 함수를 사용하여 변환
 */
export function convertToCard(posting: JobPosting): JobPostingCard {
  return toJobPostingCard(posting);
}
