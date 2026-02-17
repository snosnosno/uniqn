/**
 * UNIQN Mobile - JobPosting Repository 유틸리티/대회공고 쿼리
 *
 * @description 소유권 검증, 대회공고 타입별/승인상태별 조회
 */

import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument } from '@/schemas';
import { COLLECTIONS, FIELDS } from '@/constants';
import type { JobPosting, TournamentApprovalStatus } from '@/types';

// ============================================================================
// Utility Operations
// ============================================================================

export async function verifyOwnership(jobPostingId: string, ownerId: string): Promise<boolean> {
  try {
    logger.debug('공고 소유권 검증', { jobPostingId, ownerId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const jobPosting = parseJobPostingDocument({
      id: docSnap.id,
      ...docSnap.data(),
    });

    if (!jobPosting) {
      return false;
    }

    // ownerId 또는 createdBy로 소유권 확인
    const postingOwnerId = jobPosting.ownerId ?? jobPosting.createdBy;
    return postingOwnerId === ownerId;
  } catch (error) {
    logger.error('공고 소유권 검증 실패', toError(error), { jobPostingId, ownerId });
    return false;
  }
}

// ============================================================================
// Tournament Operations
// ============================================================================

export async function getByPostingTypeAndApprovalStatus(
  postingType: string,
  approvalStatus: TournamentApprovalStatus
): Promise<JobPosting[]> {
  try {
    logger.info('공고 타입/승인상태별 조회', { postingType, approvalStatus });

    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const q = query(
      jobPostingsRef,
      where(FIELDS.JOB_POSTING.postingType, '==', postingType),
      where(FIELDS.JOB_POSTING.tournamentApprovalStatus, '==', approvalStatus),
      orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);
    const postings: JobPosting[] = [];

    for (const docSnapshot of snapshot.docs) {
      const jobPosting = parseJobPostingDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (jobPosting) {
        postings.push(jobPosting);
      }
    }

    logger.info('공고 타입/승인상태별 조회 완료', {
      postingType,
      approvalStatus,
      count: postings.length,
    });

    return postings;
  } catch (error) {
    logger.error('공고 타입/승인상태별 조회 실패', toError(error), {
      postingType,
      approvalStatus,
    });
    throw handleServiceError(error, {
      operation: '공고 타입/승인상태별 조회',
      component: 'JobPostingRepository',
      context: { postingType, approvalStatus },
    });
  }
}

export async function getByOwnerAndPostingType(
  ownerId: string,
  postingType: string,
  approvalStatuses: TournamentApprovalStatus[]
): Promise<JobPosting[]> {
  try {
    logger.info('소유자/공고타입별 조회', {
      ownerId,
      postingType,
      approvalStatuses,
    });

    const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const q = query(
      jobPostingsRef,
      where(FIELDS.JOB_POSTING.postingType, '==', postingType),
      where(FIELDS.JOB_POSTING.ownerId, '==', ownerId),
      where(FIELDS.JOB_POSTING.tournamentApprovalStatus, 'in', approvalStatuses),
      orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);
    const postings: JobPosting[] = [];

    for (const docSnapshot of snapshot.docs) {
      const jobPosting = parseJobPostingDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (jobPosting) {
        postings.push(jobPosting);
      }
    }

    logger.info('소유자/공고타입별 조회 완료', {
      ownerId,
      postingType,
      count: postings.length,
    });

    return postings;
  } catch (error) {
    logger.error('소유자/공고타입별 조회 실패', toError(error), {
      ownerId,
      postingType,
    });
    throw handleServiceError(error, {
      operation: '소유자/공고타입별 조회',
      component: 'JobPostingRepository',
      context: { ownerId, postingType, approvalStatuses },
    });
  }
}
