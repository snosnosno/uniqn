/**
 * UNIQN Mobile - 지원 서비스
 *
 * @description Firebase Firestore 기반 지원 서비스 (트랜잭션 필수)
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
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  mapFirebaseError,
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
} from '@/errors';
import type { Application, ApplicationStatus, CreateApplicationInput } from '@/types';
import type { JobPosting } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';

// ============================================================================
// Types
// ============================================================================

export interface ApplicationWithJob extends Application {
  jobPosting?: JobPosting;
}

// ============================================================================
// Application Service
// ============================================================================

/**
 * 공고에 지원하기 (트랜잭션 필수)
 *
 * 비즈니스 로직:
 * 1. 중복 지원 검사
 * 2. 공고 상태 확인 (active인지)
 * 3. 정원 확인
 * 4. 지원서 생성 + 지원자 수 증가 (원자적)
 */
export async function applyToJob(
  input: CreateApplicationInput,
  applicantId: string,
  applicantName: string,
  applicantPhone?: string
): Promise<Application> {
  try {
    logger.info('지원하기 시작', { jobPostingId: input.jobPostingId, applicantId });

    const result = await runTransaction(db, async (transaction) => {
      // 1. 공고 정보 읽기
      const jobRef = doc(db, JOB_POSTINGS_COLLECTION, input.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ApplicationClosedError({
          userMessage: '존재하지 않는 공고입니다',
          jobPostingId: input.jobPostingId,
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      // 2. 공고 상태 확인
      if (jobData.status !== 'active') {
        throw new ApplicationClosedError({
          userMessage: '지원이 마감된 공고입니다',
          jobPostingId: input.jobPostingId,
        });
      }

      // 3. 정원 확인
      const currentApplications = jobData.applicationCount || 0;
      const totalPositions = jobData.totalPositions || 0;

      if (totalPositions > 0 && currentApplications >= totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다',
          jobPostingId: input.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentApplications,
        });
      }

      // 4. 중복 지원 검사 (쿼리는 트랜잭션 밖에서 해야 함 - 아래 별도 처리)
      // Note: Firestore 트랜잭션 내에서 쿼리는 지원되지 않음
      // 대신 복합 ID를 사용하여 중복 방지

      // 5. 지원서 생성
      const applicationId = `${input.jobPostingId}_${applicantId}`;
      const applicationRef = doc(db, APPLICATIONS_COLLECTION, applicationId);

      // 기존 지원 확인 (복합 키로 중복 방지)
      const existingApp = await transaction.get(applicationRef);
      if (existingApp.exists()) {
        const existingData = existingApp.data() as Application;
        if (existingData.status !== 'cancelled') {
          throw new AlreadyAppliedError({
            userMessage: '이미 지원한 공고입니다',
            jobPostingId: input.jobPostingId,
            applicationId: existingApp.id,
          });
        }
      }

      const now = serverTimestamp();
      const applicationData: Omit<Application, 'id'> = {
        applicantId,
        applicantName,
        applicantPhone,
        applicantRole: input.appliedRole,
        jobPostingId: input.jobPostingId,
        jobPostingTitle: jobData.title,
        jobPostingDate: jobData.workDate,
        status: 'applied',
        appliedRole: input.appliedRole,
        message: input.message,
        isRead: false,
        createdAt: now as Timestamp,
        updatedAt: now as Timestamp,
      };

      // 6. 트랜잭션 쓰기
      transaction.set(applicationRef, applicationData);
      transaction.update(jobRef, {
        applicationCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      return {
        id: applicationId,
        ...applicationData,
      } as Application;
    });

    logger.info('지원하기 성공', {
      applicationId: result.id,
      jobPostingId: input.jobPostingId,
    });

    return result;
  } catch (error) {
    logger.error('지원하기 실패', error as Error, {
      jobPostingId: input.jobPostingId,
      applicantId,
    });
    throw error instanceof AlreadyAppliedError ||
      error instanceof ApplicationClosedError ||
      error instanceof MaxCapacityReachedError
      ? error
      : mapFirebaseError(error);
  }
}

/**
 * 내 지원 내역 조회
 */
export async function getMyApplications(applicantId: string): Promise<ApplicationWithJob[]> {
  try {
    logger.info('내 지원 내역 조회', { applicantId });

    const applicationsRef = collection(db, APPLICATIONS_COLLECTION);
    const q = query(
      applicationsRef,
      where('applicantId', '==', applicantId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const applications: ApplicationWithJob[] = [];

    for (const docSnapshot of snapshot.docs) {
      const application = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as Application;

      // 공고 정보 가져오기 (선택적)
      try {
        const jobDoc = await getDoc(doc(db, JOB_POSTINGS_COLLECTION, application.jobPostingId));
        if (jobDoc.exists()) {
          applications.push({
            ...application,
            jobPosting: { id: jobDoc.id, ...jobDoc.data() } as JobPosting,
          });
        } else {
          applications.push(application);
        }
      } catch {
        applications.push(application);
      }
    }

    logger.info('내 지원 내역 조회 완료', { applicantId, count: applications.length });

    return applications;
  } catch (error) {
    logger.error('내 지원 내역 조회 실패', error as Error, { applicantId });
    throw mapFirebaseError(error);
  }
}

/**
 * 지원 상세 조회
 */
export async function getApplicationById(
  applicationId: string
): Promise<ApplicationWithJob | null> {
  try {
    logger.info('지원 상세 조회', { applicationId });

    const docRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const application = {
      id: docSnap.id,
      ...docSnap.data(),
    } as Application;

    // 공고 정보 가져오기
    const jobDoc = await getDoc(doc(db, JOB_POSTINGS_COLLECTION, application.jobPostingId));

    return {
      ...application,
      jobPosting: jobDoc.exists()
        ? ({ id: jobDoc.id, ...jobDoc.data() } as JobPosting)
        : undefined,
    };
  } catch (error) {
    logger.error('지원 상세 조회 실패', error as Error, { applicationId });
    throw mapFirebaseError(error);
  }
}

/**
 * 지원 취소 (트랜잭션)
 */
export async function cancelApplication(
  applicationId: string,
  applicantId: string
): Promise<void> {
  try {
    logger.info('지원 취소 시작', { applicationId, applicantId });

    await runTransaction(db, async (transaction) => {
      const applicationRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new Error('지원 내역을 찾을 수 없습니다');
      }

      const applicationData = applicationDoc.data() as Application;

      // 본인 확인
      if (applicationData.applicantId !== applicantId) {
        throw new Error('본인의 지원만 취소할 수 있습니다');
      }

      // 이미 취소된 경우
      if (applicationData.status === 'cancelled') {
        throw new Error('이미 취소된 지원입니다');
      }

      // 확정된 경우 취소 불가
      if (applicationData.status === 'confirmed') {
        throw new Error('확정된 지원은 취소할 수 없습니다');
      }

      // 지원 취소 처리
      transaction.update(applicationRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // 공고의 지원자 수 감소
      const jobRef = doc(db, JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      transaction.update(jobRef, {
        applicationCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('지원 취소 성공', { applicationId });
  } catch (error) {
    logger.error('지원 취소 실패', error as Error, { applicationId });
    throw mapFirebaseError(error);
  }
}

/**
 * 특정 공고의 지원 여부 확인
 */
export async function hasAppliedToJob(
  jobPostingId: string,
  applicantId: string
): Promise<boolean> {
  try {
    // 복합 키로 직접 확인
    const applicationId = `${jobPostingId}_${applicantId}`;
    const docRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const data = docSnap.data() as Application;
    return data.status !== 'cancelled';
  } catch (error) {
    logger.error('지원 여부 확인 실패', error as Error, { jobPostingId, applicantId });
    return false;
  }
}

/**
 * 지원 상태별 개수 조회
 */
export async function getApplicationStats(
  applicantId: string
): Promise<Record<ApplicationStatus, number>> {
  try {
    const applications = await getMyApplications(applicantId);

    const stats: Record<ApplicationStatus, number> = {
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
      waitlisted: 0,
      completed: 0,
    };

    applications.forEach((app) => {
      if (app.status in stats) {
        stats[app.status]++;
      }
    });

    return stats;
  } catch (error) {
    logger.error('지원 통계 조회 실패', error as Error, { applicantId });
    throw mapFirebaseError(error);
  }
}
