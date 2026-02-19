/**
 * UNIQN Mobile - Application Repository Queries
 *
 * @description 지원서 읽기 연산 (7개 메서드)
 */

import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type { ApplicationWithJob } from '../../interfaces';
import type { Application, ApplicationStatus, JobPosting } from '@/types';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';

// 단방향 의존: ApplicationRepository → JobPostingRepository (역참조 없음)
// 지연 초기화로 순환 참조 방어
import { FirebaseJobPostingRepository } from '../jobPosting';

let _jobPostingRepository: FirebaseJobPostingRepository | null = null;
function getJobPostingRepository(): FirebaseJobPostingRepository {
  return (_jobPostingRepository ??= new FirebaseJobPostingRepository());
}

// ============================================================================
// Read Operations
// ============================================================================

export async function getById(applicationId: string): Promise<ApplicationWithJob | null> {
  try {
    logger.info('지원 상세 조회', { applicationId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const application = parseApplicationDocument({ id: docSnap.id, ...docSnap.data() });
    if (!application) {
      logger.warn('지원 상세 데이터 파싱 실패', { applicationId });
      return null;
    }

    const jobDoc = await getDoc(
      doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, application.jobPostingId)
    );

    return {
      ...application,
      jobPosting: jobDoc.exists()
        ? (parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() }) ?? undefined)
        : undefined,
    };
  } catch (error) {
    logger.error('지원 상세 조회 실패', toError(error), { applicationId });
    throw handleServiceError(error, {
      operation: '지원 상세 조회',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

export async function getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]> {
  try {
    logger.info('내 지원 내역 조회', { applicantId });

    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.applicantId, '==', applicantId),
      orderBy(FIELDS.APPLICATION.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    const applications: Application[] = [];
    const jobPostingIds = new Set<string>();

    for (const docSnapshot of snapshot.docs) {
      const application = parseApplicationDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (!application) {
        logger.warn('지원서 데이터 파싱 실패', { docId: docSnapshot.id });
        continue;
      }

      applications.push(application);

      if (application.jobPostingId) {
        jobPostingIds.add(application.jobPostingId);
      }
    }

    // 공고 정보 배치 조회 (N+1 최적화: whereIn 배치 쿼리 사용)
    const jobPostingMap = new Map<string, JobPosting>();

    if (jobPostingIds.size > 0) {
      try {
        const jobPostings = await getJobPostingRepository().getByIdBatch(Array.from(jobPostingIds));

        for (const job of jobPostings) {
          jobPostingMap.set(job.id, job);
        }
      } catch (error) {
        logger.warn('공고 배치 조회 실패, 개별 조회로 폴백', { error });
        // Fallback: 배치 조회 실패 시 개별 조회
        for (const jobId of jobPostingIds) {
          try {
            const jobDoc = await getDoc(doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobId));
            if (jobDoc.exists()) {
              const job = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
              if (job) {
                jobPostingMap.set(job.id, job);
              }
            }
          } catch (innerError) {
            logger.warn('공고 개별 조회 실패', { jobId, error: innerError });
          }
        }
      }
    }

    // 지원서에 공고 정보 조인
    const applicationsWithJobs: ApplicationWithJob[] = applications.map((application) => {
      const jobPosting = jobPostingMap.get(application.jobPostingId);
      return jobPosting ? { ...application, jobPosting } : application;
    });

    logger.info('내 지원 내역 조회 완료', {
      applicantId,
      applicationCount: applications.length,
      jobPostingCount: jobPostingMap.size,
    });

    return applicationsWithJobs;
  } catch (error) {
    logger.error('내 지원 내역 조회 실패', toError(error), { applicantId });
    throw handleServiceError(error, {
      operation: '내 지원 내역 조회',
      component: 'ApplicationRepository',
      context: { applicantId },
    });
  }
}

export async function getByApplicantIdWithStatuses(
  applicantId: string,
  statuses: ApplicationStatus[],
  pageSize: number = 50
): Promise<Application[]> {
  try {
    logger.info('상태 필터 지원 내역 조회', { applicantId, statuses, pageSize });

    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.applicantId, '==', applicantId),
      where(FIELDS.APPLICATION.status, 'in', statuses),
      orderBy(FIELDS.APPLICATION.createdAt, 'desc'),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);

    const applications: Application[] = [];
    for (const docSnapshot of snapshot.docs) {
      const application = parseApplicationDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (application) {
        applications.push(application);
      }
    }

    logger.info('상태 필터 지원 내역 조회 완료', {
      applicantId,
      count: applications.length,
    });

    return applications;
  } catch (error) {
    logger.error('상태 필터 지원 내역 조회 실패', toError(error), { applicantId });
    throw handleServiceError(error, {
      operation: '상태 필터 지원 내역 조회',
      component: 'ApplicationRepository',
      context: { applicantId, statuses },
    });
  }
}

export async function getByJobPostingId(jobPostingId: string): Promise<Application[]> {
  try {
    logger.info('공고별 지원서 조회', { jobPostingId });

    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
      orderBy(FIELDS.APPLICATION.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);

    const applications: Application[] = [];
    for (const docSnapshot of snapshot.docs) {
      const application = parseApplicationDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (application) {
        applications.push(application);
      }
    }

    return applications;
  } catch (error) {
    logger.error('공고별 지원서 조회 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고별 지원서 조회',
      component: 'ApplicationRepository',
      context: { jobPostingId },
    });
  }
}

export async function hasApplied(jobPostingId: string, applicantId: string): Promise<boolean> {
  try {
    const applicationId = `${jobPostingId}_${applicantId}`;
    const docRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const data = parseApplicationDocument({ id: docSnap.id, ...docSnap.data() });
    if (!data) {
      return false;
    }
    return data.status !== STATUS.APPLICATION.CANCELLED;
  } catch (error) {
    logger.error('지원 여부 확인 실패', toError(error), { jobPostingId, applicantId });
    return false;
  }
}

/**
 * 지원자별 통계 조회 (경량 쿼리 — 공고 조인 없음)
 *
 * @description applications 컬렉션에서 status만 집계하여 N+1 공고 조회를 방지
 */
export async function getStatsByApplicantId(
  applicantId: string
): Promise<Record<ApplicationStatus, number>> {
  try {
    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(applicationsRef, where(FIELDS.APPLICATION.applicantId, '==', applicantId));
    const snapshot = await getDocs(q);

    const stats: Record<ApplicationStatus, number> = {
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0,
      cancellation_pending: 0,
    };

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const status = data?.status as ApplicationStatus;
      if (status && status in stats) {
        stats[status]++;
      }
    });

    return stats;
  } catch (error) {
    logger.error('지원 통계 조회 실패', toError(error), { applicantId });
    throw handleServiceError(error, {
      operation: '지원 통계 조회',
      component: 'ApplicationRepository',
      context: { applicantId },
    });
  }
}

export async function getCancellationRequests(
  jobPostingId: string,
  ownerId: string
): Promise<ApplicationWithJob[]> {
  try {
    logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

    // 공고 소유자 확인
    const jobDoc = await getDoc(doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId));
    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!jobData) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '공고 데이터가 올바르지 않습니다',
      });
    }
    if (jobData.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
    const q = query(
      applicationsRef,
      where(FIELDS.APPLICATION.jobPostingId, '==', jobPostingId),
      where(FIELDS.APPLICATION.status, '==', STATUS.APPLICATION.CANCELLATION_PENDING),
      orderBy(FIELDS.APPLICATION.updatedAt, 'desc')
    );

    const snapshot = await getDocs(q);

    const applications: ApplicationWithJob[] = [];
    for (const docSnapshot of snapshot.docs) {
      const application = parseApplicationDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
      if (application) {
        applications.push({
          ...application,
          jobPosting: jobData,
        });
      }
    }

    logger.info('취소 요청 목록 조회 완료', {
      jobPostingId,
      count: applications.length,
    });

    return applications;
  } catch (error) {
    logger.error('취소 요청 목록 조회 실패', toError(error), { jobPostingId });

    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: '취소 요청 목록 조회',
      component: 'ApplicationRepository',
      context: { jobPostingId },
    });
  }
}
