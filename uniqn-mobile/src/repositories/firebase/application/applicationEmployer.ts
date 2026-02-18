/**
 * UNIQN Mobile - Application Repository Employer
 *
 * @description 구인자 전용 메서드 (2개 메서드)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  ERROR_CODES,
  toError,
  isAppError,
  isPermissionError,
  isAuthError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type {
  ApplicationWithJob,
  ApplicantListWithStats,
  SubscribeCallbacks,
} from '../../interfaces';
import type { ApplicationStatus, ApplicationStats, JobPosting } from '@/types';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import { COLLECTIONS, FIELDS } from '@/constants';

// ============================================================================
// Employer Operations
// ============================================================================

export async function findByJobPostingWithStats(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListWithStats> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    // 공고 소유자 확인 (읽기 전용이므로 트랜잭션 불필요 — 최신성보다 성능 우선)
    const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 공고입니다',
      });
    }

    const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!jobData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '데이터가 올바르지 않습니다',
      });
    }

    // 공고 소유자 확인
    if (jobData.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    // 지원자 목록 조회 (전체 조회 후 클라이언트 필터링)
    // 통계는 항상 전체 데이터 기준으로 계산하기 위해 필터 없이 조회
    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
      orderBy(FIELDS.APPLICATION.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);
    const allApplications: ApplicationWithJob[] = [];
    const stats: ApplicationStats = {
      total: 0,
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0,
      cancellationPending: 0,
    };

    snapshot.docs.forEach((docSnapshot) => {
      const parsed = parseApplicationDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (!parsed) return;

      const application: ApplicationWithJob = {
        ...parsed,
        jobPosting: { ...jobData, id: jobDoc.id },
      };

      allApplications.push(application);

      // 통계 집계 (전체 기준)
      stats.total++;
      const statsKey = STATUS_TO_STATS_KEY[application.status];
      if (statsKey && statsKey !== 'total') {
        stats[statsKey]++;
      }
    });

    // 상태 필터 적용 (클라이언트 사이드)
    const statusSet = statusFilter
      ? new Set(Array.isArray(statusFilter) ? statusFilter : [statusFilter])
      : null;
    const applications = statusSet
      ? allApplications.filter((app) => statusSet.has(app.status))
      : allApplications;

    logger.info('지원자 목록 조회 완료', {
      jobPostingId,
      total: allApplications.length,
      filtered: applications.length,
      stats,
    });

    return { applications, stats };
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
  callbacks: SubscribeCallbacks
): Unsubscribe {
  logger.info('지원자 목록 실시간 구독 시작', { jobPostingId, ownerId });

  const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
  const q = query(
    applicationsRef,
    where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
    orderBy(FIELDS.APPLICATION.createdAt, 'desc')
  );

  // 공고 정보 캐싱 (소유권 확인 및 지원자 데이터에 포함)
  // TODO: 최초 1회만 조회하므로 공고 변경 시 반영 안 됨. 장기 구독 시 주기적 갱신 검토.
  let cachedJobPosting: JobPosting | null = null;
  let isOwnerVerified = false;
  let unsubscribeFn: Unsubscribe | null = null;

  /**
   * 치명적 에러 시 구독 자동 해제
   */
  const handleFatalError = (error: Error) => {
    if (isPermissionError(error) || isAuthError(error)) {
      logger.warn('치명적 에러로 구독 자동 해제', {
        errorCode: error.code,
        jobPostingId,
      });
      unsubscribeFn?.();
    }
    callbacks.onError?.(error);
  };

  unsubscribeFn = onSnapshot(
    q,
    async (snapshot) => {
      try {
        // 첫 호출 시 공고 소유자 확인
        if (!isOwnerVerified) {
          const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
          const jobDoc = await getDoc(jobRef);

          if (!jobDoc.exists()) {
            const error = new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
              userMessage: '존재하지 않는 공고입니다',
            });
            callbacks.onError?.(error);
            return;
          }

          const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
          if (!jobData) {
            const error = new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '데이터가 올바르지 않습니다',
            });
            callbacks.onError?.(error);
            return;
          }

          if (jobData.ownerId !== ownerId) {
            const error = new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
              userMessage: '본인의 공고만 조회할 수 있습니다',
            });
            handleFatalError(error);
            return;
          }

          cachedJobPosting = jobData;
          isOwnerVerified = true;
        }

        // 지원자 목록 처리
        const applications: ApplicationWithJob[] = [];
        const stats: ApplicationStats = {
          total: 0,
          applied: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        };

        snapshot.docs.forEach((docSnapshot) => {
          const parsed = parseApplicationDocument({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          });
          if (!parsed) return;

          const application: ApplicationWithJob = {
            ...parsed,
            jobPosting: cachedJobPosting ?? undefined,
          };

          applications.push(application);

          // 통계 집계
          stats.total++;
          const statsKey = STATUS_TO_STATS_KEY[application.status];
          if (statsKey && statsKey !== 'total') {
            stats[statsKey]++;
          }
        });

        logger.debug('지원자 목록 실시간 업데이트', {
          jobPostingId,
          count: applications.length,
          stats,
        });

        callbacks.onUpdate({ applications, stats });
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
