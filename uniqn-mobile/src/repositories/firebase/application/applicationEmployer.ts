/**
 * UNIQN Mobile - Application Repository Employer
 *
 * @description Employer-facing applicant list queries and realtime subscription.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS, FIELDS } from '@/constants';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import {
  BusinessError,
  ERROR_CODES,
  isAppError,
  isAuthError,
  isPermissionError,
  PermissionError,
  toError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { getFirebaseDb } from '@/lib/firebase';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type { ApplicationStats, ApplicationStatus, JobPosting } from '@/types';
import { logger } from '@/utils/logger';
import type {
  ApplicantListWithStats,
  ApplicationWithJob,
  SubscribeCallbacks,
} from '../../interfaces';

const EMPLOYER_REALTIME_LIMIT = 300;

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

async function getEmployerJobPosting(
  jobPostingId: string,
  ownerId: string,
  verifyOwnership = true
): Promise<JobPosting> {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
  const jobDoc = await getDoc(jobRef);

  if (!jobDoc.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: '존재하지 않는 공고입니다.',
    });
  }

  const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
  if (!jobData) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공고 데이터가 올바르지 않습니다.',
    });
  }

  if (verifyOwnership && jobData.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage: '본인 공고만 조회할 수 있습니다.',
    });
  }

  return { ...jobData, id: jobDoc.id };
}

function buildApplicantListWithStats(
  snapshots: { id: string; data(): Record<string, unknown> }[],
  jobPosting: JobPosting,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): ApplicantListWithStats {
  const applications: ApplicationWithJob[] = [];
  const stats = createEmptyApplicationStats();

  snapshots.forEach((docSnapshot) => {
    const parsed = parseApplicationDocument({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    });
    if (!parsed) {
      return;
    }

    const application: ApplicationWithJob = {
      ...parsed,
      jobPosting,
    };

    applications.push(application);
    stats.total++;

    const statsKey = STATUS_TO_STATS_KEY[application.status];
    if (statsKey && statsKey !== 'total') {
      stats[statsKey]++;
    }
  });

  if (!statusFilter) {
    return { applications, stats };
  }

  const statusSet = new Set(Array.isArray(statusFilter) ? statusFilter : [statusFilter]);

  return {
    applications: applications.filter((application) => statusSet.has(application.status)),
    stats,
  };
}

export async function findByJobPostingWithStats(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListWithStats> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    const jobPosting = await getEmployerJobPosting(jobPostingId, ownerId);
    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
      orderBy(FIELDS.APPLICATION.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);
    const result = buildApplicantListWithStats(snapshot.docs, jobPosting, statusFilter);

    logger.info('지원자 목록 조회 완료', {
      jobPostingId,
      total: result.stats.total,
      filtered: result.applications.length,
      stats: result.stats,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '지원자 목록 조회',
      component: 'ApplicationRepository',
      context: { jobPostingId },
    });
  }
}

export function subscribeByJobPosting(
  jobPostingId: string,
  ownerId: string,
  callbacks: SubscribeCallbacks,
  options: { verifyOwnership?: boolean } = {}
): Unsubscribe {
  logger.info('지원자 목록 실시간 구독 시작', { jobPostingId, ownerId });

  const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
  const q = query(
    applicationsRef,
    where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
    orderBy(FIELDS.APPLICATION.createdAt, 'desc'),
    limit(EMPLOYER_REALTIME_LIMIT)
  );

  let cachedJobPosting: JobPosting | null = null;
  let isOwnerVerified = false;
  let limitWarningLogged = false;
  let unsubscribeFn: Unsubscribe | null = null;

  const handleFatalError = (error: Error) => {
    if (isPermissionError(error) || isAuthError(error)) {
      logger.warn('치명적 오류로 지원자 구독을 해제합니다', {
        jobPostingId,
        errorCode: error.code,
      });
      unsubscribeFn?.();
    }

    callbacks.onError?.(error);
  };

  unsubscribeFn = onSnapshot(
    q,
    async (snapshot) => {
      try {
        if (!isOwnerVerified) {
          cachedJobPosting = await getEmployerJobPosting(
            jobPostingId,
            ownerId,
            options.verifyOwnership !== false
          );
          isOwnerVerified = true;
        }

        if (snapshot.size >= EMPLOYER_REALTIME_LIMIT && !limitWarningLogged) {
          limitWarningLogged = true;
          logger.warn('employer_applicants_realtime_limit_reached', {
            jobPostingId,
            count: snapshot.size,
            limit: EMPLOYER_REALTIME_LIMIT,
          });
        }

        const result = buildApplicantListWithStats(snapshot.docs, cachedJobPosting as JobPosting);

        logger.debug('지원자 목록 실시간 업데이트', {
          jobPostingId,
          count: result.applications.length,
          stats: result.stats,
        });

        callbacks.onUpdate(result);
      } catch (error) {
        logger.error('지원자 목록 실시간 구독 처리 실패', toError(error), { jobPostingId });
        handleFatalError(toError(error));
      }
    },
    (firebaseError) => {
      try {
        const appError = handleServiceError(firebaseError, {
          operation: '지원자 목록 실시간 구독',
          component: 'ApplicationRepository',
          context: { jobPostingId },
        });
        handleFatalError(appError);
      } catch (error) {
        handleFatalError(toError(error));
      }
    }
  );

  return () => unsubscribeFn?.();
}
