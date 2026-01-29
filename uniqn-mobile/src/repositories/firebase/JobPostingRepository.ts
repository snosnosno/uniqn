/**
 * UNIQN Mobile - Firebase JobPosting Repository
 *
 * @description Firebase Firestore 기반 JobPosting Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 문서 파싱 및 타입 변환
 * 3. 기본적인 CRUD 연산 캡슐화
 *
 * 비즈니스 로직:
 * - 공고 생성/수정 → jobManagementService
 * - 필터링/검색 → jobService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  startAfter,
  updateDoc,
  increment,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument } from '@/schemas';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
} from '../interfaces';
import type { JobPosting, JobPostingFilters, JobPostingStatus } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'jobPostings';
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase JobPosting Repository
 */
export class FirebaseJobPostingRepository implements IJobPostingRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(jobPostingId: string): Promise<JobPosting | null> {
    try {
      logger.info('공고 상세 조회', { jobPostingId });

      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
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

  async getList(
    filters?: JobPostingFilters,
    pageSize: number = DEFAULT_PAGE_SIZE,
    lastDocument?: QueryDocumentSnapshot<DocumentData>
  ): Promise<PaginatedJobPostings> {
    try {
      logger.info('공고 목록 조회', { filters, pageSize });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      // QueryBuilder로 쿼리 구성
      let builder = new QueryBuilder(jobPostingsRef)
        .whereEqual('status', filters?.status ?? 'active');

      // 공고 타입 필터
      if (filters?.postingType) {
        builder = builder.whereEqual('postingType', filters.postingType);
      }

      // 지역 필터
      if (filters?.district) {
        builder = builder.whereEqual('district', filters.district);
      }

      // 역할 필터 (첫 번째 역할만 적용 - Firestore 제약)
      if (filters?.roles && filters.roles.length > 0) {
        builder = builder.whereArrayContains('roleKeys', filters.roles[0]);
      }

      // 정렬 및 페이지네이션
      builder = builder.orderByDesc('createdAt').limit(pageSize + 1);

      // 커서 기반 페이지네이션
      let q = builder.build();
      if (lastDocument) {
        q = query(q, startAfter(lastDocument));
      }

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

  async getByOwnerId(
    ownerId: string,
    status?: JobPostingStatus
  ): Promise<JobPosting[]> {
    try {
      logger.info('소유자별 공고 조회', { ownerId, status });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      let builder = new QueryBuilder(jobPostingsRef)
        .whereEqual('ownerId', ownerId);

      if (status) {
        builder = builder.whereEqual('status', status);
      }

      const q = builder.orderByDesc('createdAt').build();
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

  async getTypeCounts(
    filters?: Pick<JobPostingFilters, 'status'>
  ): Promise<PostingTypeCounts> {
    try {
      logger.info('공고 타입별 개수 조회', { filters });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTION_NAME);
      const status = filters?.status ?? 'active';

      const q = query(
        jobPostingsRef,
        where('status', '==', status)
      );

      const snapshot = await getDocs(q);

      const counts: PostingTypeCounts = {
        normal: 0,
        urgent: 0,
        fixed: 0,
        tournament: 0,
        total: 0,
      };

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const postingType = data.postingType as string;

        counts.total++;

        switch (postingType) {
          case 'normal':
            counts.normal++;
            break;
          case 'urgent':
            counts.urgent++;
            break;
          case 'fixed':
            counts.fixed++;
            break;
          case 'tournament':
            counts.tournament++;
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

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async incrementViewCount(jobPostingId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);

      await updateDoc(docRef, {
        viewCount: increment(1),
      });

      logger.debug('조회수 증가', { jobPostingId });
    } catch (error) {
      // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
      logger.warn('조회수 증가 실패', { jobPostingId, error: toError(error) });
    }
  }

  async updateStatus(
    jobPostingId: string,
    status: JobPostingStatus
  ): Promise<void> {
    try {
      logger.info('공고 상태 변경', { jobPostingId, status });

      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);

      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      logger.info('공고 상태 변경 완료', { jobPostingId, status });
    } catch (error) {
      logger.error('공고 상태 변경 실패', toError(error), {
        jobPostingId,
        status,
      });
      throw handleServiceError(error, {
        operation: '공고 상태 변경',
        component: 'JobPostingRepository',
        context: { jobPostingId, status },
      });
    }
  }
}
