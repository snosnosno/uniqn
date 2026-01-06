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
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  mapFirebaseError,
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
  ValidationError,
  ERROR_CODES,
} from '@/errors';
import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationInputV2,
  Assignment,
  PreQuestionAnswer,
  JobPosting,
  RecruitmentType,
  StaffRole,
} from '@/types';
import { isValidAssignment, validateRequiredAnswers } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';

// ============================================================================
// Types
// ============================================================================

export interface ApplicationWithJob extends Application {
  jobPosting?: Partial<JobPosting>;
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

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 공고 정보 읽기
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, input.jobPostingId);
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
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);

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
 *
 * @description N+1 쿼리 최적화: 공고 정보를 배치로 조회
 */
export async function getMyApplications(applicantId: string): Promise<ApplicationWithJob[]> {
  try {
    logger.info('내 지원 내역 조회', { applicantId });

    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const q = query(
      applicationsRef,
      where('applicantId', '==', applicantId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    // 1. 모든 지원서 매핑 + 고유 공고 ID 수집
    const applications: Application[] = [];
    const jobPostingIds = new Set<string>();

    for (const docSnapshot of snapshot.docs) {
      const application = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as Application;

      applications.push(application);

      if (application.jobPostingId) {
        jobPostingIds.add(application.jobPostingId);
      }
    }

    // 2. 공고 정보 배치 조회 (Promise.all로 병렬 처리)
    const jobPostingMap = new Map<string, JobPosting>();

    if (jobPostingIds.size > 0) {
      const jobPromises = Array.from(jobPostingIds).map(async (jobId) => {
        try {
          const jobDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobId));
          if (jobDoc.exists()) {
            return { id: jobDoc.id, ...jobDoc.data() } as JobPosting;
          }
          return null;
        } catch {
          return null;
        }
      });

      const jobResults = await Promise.all(jobPromises);

      for (const job of jobResults) {
        if (job) {
          jobPostingMap.set(job.id, job);
        }
      }
    }

    // 3. 지원서에 공고 정보 조인 (O(1) 조회)
    const applicationsWithJobs: ApplicationWithJob[] = applications.map((application) => {
      const jobPosting = jobPostingMap.get(application.jobPostingId);
      return jobPosting
        ? { ...application, jobPosting }
        : application;
    });

    logger.info('내 지원 내역 조회 완료', {
      applicantId,
      applicationCount: applications.length,
      jobPostingCount: jobPostingMap.size,
    });

    return applicationsWithJobs;
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

    const docRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const application = {
      id: docSnap.id,
      ...docSnap.data(),
    } as Application;

    // 공고 정보 가져오기
    const jobDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, application.jobPostingId));

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

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
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
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
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
    const docRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
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

// ============================================================================
// Application Service v2.0 (Assignment + PreQuestion 지원)
// ============================================================================

/**
 * 공고에 지원하기 v2.0 (트랜잭션)
 *
 * @description Assignment 배열 + 사전질문 답변 지원
 *
 * 비즈니스 로직:
 * 1. Assignment 유효성 검증
 * 2. 사전질문 필수 답변 검증
 * 3. 중복 지원 검사
 * 4. 공고 상태/정원 확인
 * 5. 지원서 생성 (v2.0 형식)
 */
export async function applyToJobV2(
  input: CreateApplicationInputV2,
  applicantId: string,
  applicantName: string,
  applicantPhone?: string,
  applicantEmail?: string
): Promise<Application> {
  try {
    logger.info('지원하기 v2.0 시작', {
      jobPostingId: input.jobPostingId,
      applicantId,
      assignmentCount: input.assignments.length,
    });

    // 1. Assignment 유효성 검증
    for (const assignment of input.assignments) {
      if (!isValidAssignment(assignment)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해주세요.',
        });
      }
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 2. 공고 정보 읽기
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, input.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ApplicationClosedError({
          userMessage: '존재하지 않는 공고입니다',
          jobPostingId: input.jobPostingId,
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      // 3. 공고 상태 확인
      if (jobData.status !== 'active') {
        throw new ApplicationClosedError({
          userMessage: '지원이 마감된 공고입니다',
          jobPostingId: input.jobPostingId,
        });
      }

      // 4. 사전질문 필수 답변 검증
      if (jobData.usesPreQuestions && jobData.preQuestions?.length) {
        if (!input.preQuestionAnswers?.length) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '사전질문에 답변해주세요',
          });
        }

        const isValid = validateRequiredAnswers(input.preQuestionAnswers);
        if (!isValid) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '필수 질문에 모두 답변해주세요',
          });
        }
      }

      // 5. 정원 확인
      const currentApplications = jobData.applicationCount ?? 0;
      const totalPositions = jobData.totalPositions ?? 0;

      if (totalPositions > 0 && currentApplications >= totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다',
          jobPostingId: input.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentApplications,
        });
      }

      // 6. 중복 지원 검사 (복합 키)
      const applicationId = `${input.jobPostingId}_${applicantId}`;
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);

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

      // 7. 모집 유형 결정
      const recruitmentType: RecruitmentType =
        jobData.postingType === 'fixed' ? 'fixed' : 'event';

      // 8. 대표 역할 결정 (레거시 호환)
      const firstAssignment = input.assignments[0];
      const primaryRole = (
        firstAssignment?.role ?? firstAssignment?.roles?.[0] ?? 'dealer'
      ) as StaffRole;

      // 9. 지원서 데이터 생성 (v2.0)
      const now = serverTimestamp();
      const applicationData: Omit<Application, 'id'> = {
        // 지원자 정보
        applicantId,
        applicantName,
        applicantPhone,
        applicantEmail,
        applicantRole: primaryRole,

        // 공고 정보 (레거시 호환)
        jobPostingId: input.jobPostingId,
        jobPostingTitle: jobData.title,
        jobPostingDate: jobData.workDate,

        // 공고 정보 (v2.0 표준)
        eventId: input.jobPostingId,
        postId: input.jobPostingId,
        postTitle: jobData.title,

        // 지원 정보
        status: 'applied',
        appliedRole: primaryRole,
        message: input.message,
        recruitmentType,

        // v2.0 핵심 필드
        assignments: input.assignments,
        preQuestionAnswers: input.preQuestionAnswers,

        // 메타데이터
        isRead: false,
        createdAt: now as Timestamp,
        updatedAt: now as Timestamp,
      };

      // 10. 트랜잭션 쓰기
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

    logger.info('지원하기 v2.0 성공', {
      applicationId: result.id,
      jobPostingId: input.jobPostingId,
      assignmentCount: input.assignments.length,
    });

    return result;
  } catch (error) {
    logger.error('지원하기 v2.0 실패', error as Error, {
      jobPostingId: input.jobPostingId,
      applicantId,
    });

    if (
      error instanceof AlreadyAppliedError ||
      error instanceof ApplicationClosedError ||
      error instanceof MaxCapacityReachedError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 레거시 지원 함수 래퍼
 *
 * @description 기존 applyToJob을 내부적으로 v2 형식으로 변환하여 처리
 */
export async function applyToJobLegacy(
  input: CreateApplicationInput,
  applicantId: string,
  applicantName: string,
  applicantPhone?: string
): Promise<Application> {
  // 레거시 입력을 v2 형식으로 변환
  const v2Input: CreateApplicationInputV2 = {
    jobPostingId: input.jobPostingId,
    assignments: [
      {
        role: input.appliedRole,
        timeSlot: '',
        dates: [],
        isGrouped: false,
      },
    ],
    message: input.message,
  };

  // 기존 applyToJob 함수 호출 (레거시 형식 유지)
  return applyToJob(input, applicantId, applicantName, applicantPhone);
}
