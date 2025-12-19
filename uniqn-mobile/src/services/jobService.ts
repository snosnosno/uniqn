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
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import type { JobPosting, JobPostingFilters, JobPostingCard } from '@/types';

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
  try {
    logger.info('공고 목록 조회', { filters, pageSize });

    const jobsRef = collection(db, COLLECTION_NAME);
    const constraints: Parameters<typeof query>[1][] = [];

    // 기본 필터: active 상태만
    constraints.push(where('status', '==', filters?.status || 'active'));

    // 역할 필터
    if (filters?.roles && filters.roles.length > 0) {
      // Firestore에서 array-contains-any는 최대 10개까지
      constraints.push(where('roles', 'array-contains-any', filters.roles.slice(0, 10)));
    }

    // 지역 필터
    if (filters?.district) {
      constraints.push(where('location.district', '==', filters.district));
    }

    // 긴급 공고 필터
    if (filters?.isUrgent !== undefined) {
      constraints.push(where('isUrgent', '==', filters.isUrgent));
    }

    // 구인자 필터 (내 공고)
    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    // 날짜 범위 필터
    if (filters?.dateRange) {
      constraints.push(where('workDate', '>=', filters.dateRange.start));
      constraints.push(where('workDate', '<=', filters.dateRange.end));
    }

    // 정렬: 날짜순 (최신순)
    constraints.push(orderBy('workDate', 'desc'));
    constraints.push(orderBy('createdAt', 'desc'));

    // 페이지네이션
    if (lastDocument) {
      constraints.push(startAfter(lastDocument));
    }

    constraints.push(limit(pageSize + 1)); // 다음 페이지 존재 여부 확인용

    const q = query(jobsRef, ...constraints);
    const snapshot = await getDocs(q);

    const items: JobPosting[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let hasMore = false;

    snapshot.docs.forEach((docSnapshot, index) => {
      if (index < pageSize) {
        items.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as JobPosting);
        lastDoc = docSnapshot;
      } else {
        hasMore = true;
      }
    });

    logger.info('공고 목록 조회 완료', { count: items.length, hasMore });

    return { items, lastDoc, hasMore };
  } catch (error) {
    logger.error('공고 목록 조회 실패', error as Error);
    throw mapFirebaseError(error);
  }
}

/**
 * 공고 상세 조회
 */
export async function getJobPostingById(id: string): Promise<JobPosting | null> {
  try {
    logger.info('공고 상세 조회', { id });

    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      logger.warn('공고를 찾을 수 없음', { id });
      return null;
    }

    const jobPosting = {
      id: docSnap.id,
      ...docSnap.data(),
    } as JobPosting;

    logger.info('공고 상세 조회 완료', { id, title: jobPosting.title });

    return jobPosting;
  } catch (error) {
    logger.error('공고 상세 조회 실패', error as Error, { id });
    throw mapFirebaseError(error);
  }
}

/**
 * 조회수 증가
 */
export async function incrementViewCount(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      viewCount: increment(1),
    });
  } catch (error) {
    // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
    logger.warn('조회수 증가 실패', { id, error });
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
    logger.error('공고 검색 실패', error as Error, { searchTerm });
    throw mapFirebaseError(error);
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
    logger.error('긴급 공고 조회 실패', error as Error);
    throw mapFirebaseError(error);
  }
}

/**
 * 내 공고 목록 조회 (구인자용)
 */
export async function getMyJobPostings(
  ownerId: string,
  status?: JobPosting['status']
): Promise<JobPosting[]> {
  try {
    logger.info('내 공고 목록 조회', { ownerId, status });

    const { items } = await getJobPostings(
      {
        ownerId,
        status: status || 'active',
      },
      100
    );

    return items;
  } catch (error) {
    logger.error('내 공고 조회 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

/**
 * JobPosting을 카드 형태로 변환
 */
export function convertToCard(posting: JobPosting): JobPostingCard {
  return {
    id: posting.id,
    title: posting.title,
    location: posting.location.name,
    workDate: posting.workDate,
    timeSlot: posting.timeSlot,
    roles: posting.roles.map((r) => r.role),
    salary: {
      type: posting.salary.type,
      amount: posting.salary.amount,
    },
    status: posting.status,
    isUrgent: posting.isUrgent,
    applicationCount: posting.applicationCount,
  };
}
