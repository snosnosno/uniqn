/**
 * UNIQN Mobile - 구인공고 서비스
 *
 * @description Firebase Firestore 기반 구인공고 서비스
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { handleServiceError, handleSilentError } from '@/errors';
import { QueryBuilder, processPaginatedResults } from '@/utils/firestore';
import { startApiTrace } from '@/services/performanceService';
import type { JobPosting, JobPostingFilters, JobPostingCard } from '@/types';
import { toJobPostingCard } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'jobPostings';
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Types
// ============================================================================

export interface PaginatedJobPostings {
  items: JobPosting[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// ============================================================================
// Job Service
// ============================================================================

/**
 * 공고 목록 조회 (무한스크롤 지원)
 */
export async function getJobPostings(
  filters?: JobPostingFilters,
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastDocument?: QueryDocumentSnapshot<DocumentData>
): Promise<PaginatedJobPostings> {
  const trace = startApiTrace('getJobPostings');
  trace.putAttribute('pageSize', String(pageSize));
  if (filters?.status) trace.putAttribute('filter_status', filters.status);

  try {
    logger.info('공고 목록 조회', { filters, pageSize });

    const jobsRef = collection(getFirebaseDb(), COLLECTION_NAME);

    // 대회공고 포함 시 클라이언트 필터링 필요 (미승인 제외)
    const includesTournamentInArray = filters?.postingTypes?.includes('tournament') ?? false;

    // QueryBuilder로 쿼리 조합
    const qb = new QueryBuilder(jobsRef)
      // 기본 필터: status
      .whereEqual('status', filters?.status || 'active')
      // 역할 필터 (최대 10개)
      .whereArrayContainsAny('roles', filters?.roles?.slice(0, 10))
      // 지역 필터
      .whereIf(!!filters?.district, 'location.district', '==', filters?.district)
      // 긴급 공고 필터
      .whereIf(filters?.isUrgent !== undefined, 'isUrgent', '==', filters?.isUrgent)
      // 구인자 필터 (내 공고)
      .whereIf(!!filters?.ownerId, 'ownerId', '==', filters?.ownerId)
      // 날짜 범위 필터
      .whereDateRange('workDate', filters?.dateRange);

    // 공고 타입 필터 (복잡한 조건은 분기 처리)
    if (filters?.postingTypes && filters.postingTypes.length > 0) {
      qb.whereIn('postingType', filters.postingTypes);
    } else if (filters?.postingType === 'tournament') {
      // 대회 공고는 승인된(approved) 것만 일반 목록에 노출
      qb.whereEqual('postingType', 'tournament');
      qb.whereEqual('tournamentConfig.approvalStatus', 'approved');
    } else if (filters?.postingType) {
      qb.whereEqual('postingType', filters.postingType);
    }

    // 단일 날짜 필터 (workDates 배열에서 array-contains 쿼리)
    qb.whereIf(!!filters?.workDate && !filters?.dateRange, 'workDates', 'array-contains', filters?.workDate);

    // 정렬 및 페이지네이션
    const q = qb
      .orderByDesc('workDate')
      .orderBy('createdAt', 'desc')
      .paginate(pageSize, lastDocument)
      .build();

    const snapshot = await getDocs(q);

    // 페이지네이션 결과 처리
    const { items, lastDoc, hasMore } = processPaginatedResults(
      snapshot.docs,
      pageSize,
      (docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as JobPosting)
    );

    // 복수 타입 필터에 tournament 포함 시: 미승인 대회공고 제외 (클라이언트 필터링)
    // Firestore에서 OR 조건 불가하므로 클라이언트에서 처리
    const filteredItems = includesTournamentInArray
      ? items.filter(
          (item) =>
            item.postingType !== 'tournament' ||
            item.tournamentConfig?.approvalStatus === 'approved'
        )
      : items;

    logger.info('공고 목록 조회 완료', {
      count: filteredItems.length,
      hasMore,
      tournamentFiltered: includesTournamentInArray ? items.length - filteredItems.length : 0,
    });

    trace.putMetric('result_count', filteredItems.length);
    trace.putAttribute('status', 'success');
    trace.stop();

    return { items: filteredItems, lastDoc, hasMore };
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
 */
export async function getJobPostingById(id: string): Promise<JobPosting | null> {
  const trace = startApiTrace('getJobPostingById');
  trace.putAttribute('jobId', id);

  try {
    logger.info('공고 상세 조회', { id });

    const docRef = doc(getFirebaseDb(), COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      logger.warn('공고를 찾을 수 없음', { id });
      trace.putAttribute('status', 'not_found');
      trace.stop();
      return null;
    }

    const jobPosting = {
      id: docSnap.id,
      ...docSnap.data(),
    } as JobPosting;

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

/**
 * 조회수 증가
 */
export async function incrementViewCount(id: string): Promise<void> {
  try {
    const docRef = doc(getFirebaseDb(), COLLECTION_NAME, id);
    await updateDoc(docRef, {
      viewCount: increment(1),
    });
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
 */
export async function searchJobPostings(
  searchTerm: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<JobPosting[]> {
  try {
    logger.info('공고 검색', { searchTerm });

    // Firestore는 전문 검색을 지원하지 않으므로 클라이언트 사이드 필터링
    // TODO [P2]: Algolia 또는 Typesense 연동

    const { items } = await getJobPostings({ status: 'active' }, 100);

    const normalizedTerm = searchTerm.toLowerCase().trim();

    const filteredItems = items.filter((job) => {
      const title = job.title?.toLowerCase() || '';
      const location = job.location?.name?.toLowerCase() || '';
      const description = job.description?.toLowerCase() || '';

      return (
        title.includes(normalizedTerm) ||
        location.includes(normalizedTerm) ||
        description.includes(normalizedTerm)
      );
    });

    logger.info('공고 검색 완료', { searchTerm, count: filteredItems.length });

    return filteredItems.slice(0, pageSize);
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
export async function getUrgentJobPostings(
  pageSize: number = 10
): Promise<JobPosting[]> {
  try {
    const { items } = await getJobPostings({ status: 'active', isUrgent: true }, pageSize);
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
        getJobPostings({ ownerId, status: 'active' }, 100),
        getJobPostings({ ownerId, status: 'closed' }, 100),
      ]);
      return [...results[0].items, ...results[1].items];
    }

    const { items } = await getJobPostings(
      {
        ownerId,
        status: status || 'active',
      },
      100
    );

    return items;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 공고 조회',
      component: 'jobService',
      context: { ownerId },  // ownerId 자동 마스킹
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
