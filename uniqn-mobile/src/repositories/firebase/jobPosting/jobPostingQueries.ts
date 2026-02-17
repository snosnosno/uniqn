/**
 * UNIQN Mobile - JobPosting Repository 읽기 연산
 *
 * @description 공고 조회, 배치 조회, 목록 조회, 통계 등 읽기 전용 연산
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument } from '@/schemas';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type { PaginatedJobPostings, PostingTypeCounts } from '../../interfaces';
import type { JobPosting, JobPostingFilters, JobPostingStatus } from '@/types';
import { DEFAULT_PAGE_SIZE } from './constants';

// ============================================================================
// Read Operations
// ============================================================================

export async function getById(jobPostingId: string): Promise<JobPosting | null> {
  try {
    logger.info('공고 상세 조회', { jobPostingId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const jobPosting = parseJobPostingDocument({
      id: docSnap.id,
      ...docSnap.data(),
    });

    if (!jobPosting) {
      logger.warn('공고 데이터 파싱 실패', { jobPostingId });
      return null;
    }

    return jobPosting;
  } catch (error) {
    logger.error('공고 상세 조회 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고 상세 조회',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function getByIdBatch(jobPostingIds: string[]): Promise<JobPosting[]> {
  try {
    if (jobPostingIds.length === 0) {
      return [];
    }

    logger.info('공고 배치 조회', { count: jobPostingIds.length });

    const uniqueIds = [...new Set(jobPostingIds)];
    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const items: JobPosting[] = [];

    // Firestore whereIn은 최대 30개 제한
    const BATCH_SIZE = 30;
    const chunks: string[][] = [];

    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      chunks.push(uniqueIds.slice(i, i + BATCH_SIZE));
    }

    // 병렬 처리
    const results = await Promise.allSettled(
      chunks.map(async (chunk) => {
        const q = query(jobPostingsRef, where(documentId(), 'in', chunk));
        return getDocs(q);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const docSnapshot of result.value.docs) {
          const jobPosting = parseJobPostingDocument({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          });

          if (jobPosting) {
            items.push(jobPosting);
          }
        }
      } else {
        logger.warn('공고 배치 조회 일부 실패', { error: result.reason });
      }
    }

    logger.info('공고 배치 조회 완료', {
      requested: jobPostingIds.length,
      found: items.length,
    });

    return items;
  } catch (error) {
    logger.error('공고 배치 조회 실패', toError(error), {
      count: jobPostingIds.length,
    });
    throw handleServiceError(error, {
      operation: '공고 배치 조회',
      component: 'JobPostingRepository',
      context: { count: jobPostingIds.length },
    });
  }
}

export async function getList(
  filters?: JobPostingFilters,
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastDocument?: QueryDocumentSnapshot<DocumentData>
): Promise<PaginatedJobPostings> {
  try {
    logger.info('공고 목록 조회', { filters, pageSize });

    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);

    // QueryBuilder로 쿼리 구성
    const qb = new QueryBuilder(jobPostingsRef)
      // 기본 필터: status
      .whereEqual(FIELDS.JOB_POSTING.status, filters?.status || STATUS.JOB_POSTING.ACTIVE)
      // 역할 필터 (최대 10개)
      .whereArrayContainsAny('roles', filters?.roles?.slice(0, 10))
      // 지역 필터
      .whereIf(!!filters?.district, FIELDS.JOB_POSTING.locationDistrict, '==', filters?.district)
      // 긴급 공고 필터
      .whereIf(
        filters?.isUrgent !== undefined,
        FIELDS.JOB_POSTING.isUrgent,
        '==',
        filters?.isUrgent
      )
      // 구인자 필터 (내 공고)
      .whereIf(!!filters?.ownerId, FIELDS.JOB_POSTING.ownerId, '==', filters?.ownerId)
      // 날짜 범위 필터
      .whereDateRange(FIELDS.JOB_POSTING.workDate, filters?.dateRange);

    // 공고 타입 필터
    if (filters?.postingType === 'tournament') {
      // 대회 공고는 승인된(approved) 것만 일반 목록에 노출
      qb.whereEqual(FIELDS.JOB_POSTING.postingType, 'tournament');
      qb.whereEqual(FIELDS.JOB_POSTING.tournamentApprovalStatus, STATUS.TOURNAMENT.APPROVED);
    } else if (filters?.postingType) {
      qb.whereEqual(FIELDS.JOB_POSTING.postingType, filters.postingType);
    }

    // 단일 날짜 필터 (workDates 배열에서 array-contains 쿼리)
    qb.whereIf(
      !!filters?.workDate && !filters?.dateRange,
      'workDates',
      'array-contains',
      filters?.workDate
    );

    // 정렬 및 페이지네이션
    const q = qb
      .orderByDesc(FIELDS.JOB_POSTING.workDate)
      .orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
      .paginate(pageSize, lastDocument)
      .build();

    const snapshot = await getDocs(q);

    const items: JobPosting[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let hasMore = false;

    snapshot.docs.forEach((docSnapshot, index) => {
      // 마지막 요소는 hasMore 확인용
      if (index === pageSize) {
        hasMore = true;
        return;
      }

      const jobPosting = parseJobPostingDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });

      if (jobPosting) {
        items.push(jobPosting);
        lastDoc = docSnapshot;
      }
    });

    logger.info('공고 목록 조회 완료', {
      count: items.length,
      hasMore,
    });

    return { items, lastDoc, hasMore };
  } catch (error) {
    logger.error('공고 목록 조회 실패', toError(error), { filters });
    throw handleServiceError(error, {
      operation: '공고 목록 조회',
      component: 'JobPostingRepository',
      context: { filters },
    });
  }
}

export async function getByOwnerId(
  ownerId: string,
  status?: JobPostingStatus
): Promise<JobPosting[]> {
  try {
    logger.info('소유자별 공고 조회', { ownerId, status });

    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);

    let builder = new QueryBuilder(jobPostingsRef).whereEqual(FIELDS.JOB_POSTING.ownerId, ownerId);

    if (status) {
      builder = builder.whereEqual(FIELDS.JOB_POSTING.status, status);
    }

    const q = builder.orderByDesc(FIELDS.JOB_POSTING.createdAt).build();
    const snapshot = await getDocs(q);

    const items: JobPosting[] = [];

    for (const docSnapshot of snapshot.docs) {
      const jobPosting = parseJobPostingDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });

      if (jobPosting) {
        items.push(jobPosting);
      }
    }

    logger.info('소유자별 공고 조회 완료', {
      ownerId,
      count: items.length,
    });

    return items;
  } catch (error) {
    logger.error('소유자별 공고 조회 실패', toError(error), { ownerId });
    throw handleServiceError(error, {
      operation: '소유자별 공고 조회',
      component: 'JobPostingRepository',
      context: { ownerId, status },
    });
  }
}

export async function getTypeCounts(
  filters?: Pick<JobPostingFilters, 'status'>
): Promise<PostingTypeCounts> {
  try {
    logger.info('공고 타입별 개수 조회', { filters });

    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const status = filters?.status ?? STATUS.JOB_POSTING.ACTIVE;

    const q = query(jobPostingsRef, where(FIELDS.JOB_POSTING.status, '==', status));

    const snapshot = await getDocs(q);

    const counts: PostingTypeCounts = {
      regular: 0,
      urgent: 0,
      fixed: 0,
      tournament: 0,
      total: 0,
    };

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const postingType = data.postingType as string;

      // 대회공고는 승인된 것만 카운팅
      if (postingType === 'tournament') {
        if (data.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED) {
          counts.tournament++;
          counts.total++;
        }
        continue;
      }

      counts.total++;

      switch (postingType) {
        case 'regular':
          counts.regular++;
          break;
        case 'urgent':
          counts.urgent++;
          break;
        case 'fixed':
          counts.fixed++;
          break;
      }
    }

    logger.info('공고 타입별 개수 조회 완료', { counts });

    return counts;
  } catch (error) {
    logger.error('공고 타입별 개수 조회 실패', toError(error));
    throw handleServiceError(error, {
      operation: '공고 타입별 개수 조회',
      component: 'JobPostingRepository',
      context: { filters },
    });
  }
}
