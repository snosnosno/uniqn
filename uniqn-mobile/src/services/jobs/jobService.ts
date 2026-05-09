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
import { RealtimeManager } from '@/shared/realtime';
import type { JobPosting, JobPostingFilters, JobPostingCard } from '@/types';
import { toJobPostingCard } from '@/domains/job-posting';
import { STATUS } from '@/constants';

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
 *
 * Phase 2A.후속 (2026-05-09) — active workspace 단위로 좁힌다. workspaceId 미지정
 * 시 RLS 가 허용하는 범위 전체(소유 + 멤버 워크스페이스 합산)가 반환되며 이는
 * Switcher 도입 전 레거시 호출자 호환을 위해서만 유지한다.
 */
export async function getMyJobPostings(
  ownerId: string,
  options?: { status?: JobPosting['status']; includeAll?: boolean; workspaceId?: string }
): Promise<JobPosting[]> {
  const { status, includeAll = true, workspaceId } = options || {};
  try {
    logger.info('관리 가능 공고 목록 조회', { ownerId, status, includeAll, workspaceId });

    if (includeAll && !status) {
      const results = await Promise.all([
        jobPostingRepository.getManagedJobPostings(STATUS.JOB_POSTING.ACTIVE, workspaceId),
        jobPostingRepository.getManagedJobPostings(STATUS.JOB_POSTING.CLOSED, workspaceId),
      ]);
      return [...results[0], ...results[1]];
    }

    return jobPostingRepository.getManagedJobPostings(
      status || STATUS.JOB_POSTING.ACTIVE,
      workspaceId
    );
  } catch (error) {
    throw handleServiceError(error, {
      operation: '관리 가능 공고 조회',
      component: 'jobService',
      context: { ownerId, workspaceId },
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
