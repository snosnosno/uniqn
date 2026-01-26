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
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import {
  mapFirebaseError,
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
  ValidationError,
  BusinessError,
  PermissionError,
  ERROR_CODES,
} from '@/errors';
import { trackJobApply, trackEvent } from './analyticsService';
import { startApiTrace } from './performanceService';
import type {
  Application,
  ApplicationStatus,
  CancellationRequest,
  CreateApplicationInput,
  JobPosting,
  RecruitmentType,
  RequestCancellationInput,
  ReviewCancellationInput,
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
// Helpers
// ============================================================================

/**
 * 특정 역할의 정원 확인
 *
 * @description dateSpecificRequirements 또는 roles 배열에서 역할별 마감 상태 확인
 * 기존 getClosingStatus는 전체 정원만 확인하므로, 역할별 세부 확인 필요 시 사용
 *
 * @param jobData - 공고 데이터
 * @param appliedRole - 지원 역할
 * @returns 해당 역할의 모집 가능 여부 및 사유
 */
function checkRoleCapacity(
  jobData: JobPosting,
  appliedRole: string
): { available: boolean; reason?: string } {
  /**
   * 역할 매칭 헬퍼
   * - 표준 역할: r.role === appliedRole
   * - 커스텀 역할: r.role === 'other' && r.customRole === appliedRole
   */
  const matchesRole = (r: { role?: string; name?: string; customRole?: string }) => {
    if (r.role === appliedRole || r.name === appliedRole) return true;
    // 커스텀 역할 체크: role이 'other'이고 customRole이 appliedRole과 일치
    if (r.role === 'other' && r.customRole === appliedRole) return true;
    return false;
  };

  // dateSpecificRequirements가 있으면 역할별 마감 확인
  if (jobData.dateSpecificRequirements?.length) {
    for (const req of jobData.dateSpecificRequirements) {
      for (const slot of req.timeSlots || []) {
        const roleReq = slot.roles?.find(matchesRole);
        if (roleReq) {
          const total = roleReq.headcount ?? roleReq.count ?? 0;
          const filled = roleReq.filled ?? 0;
          if (total > 0 && filled < total) {
            return { available: true };
          }
        }
      }
    }
    return { available: false, reason: '해당 역할의 모집이 마감되었습니다' };
  }

  // 레거시: roles 배열 확인
  if (jobData.roles?.length) {
    const roleReq = jobData.roles.find(matchesRole);
    if (roleReq) {
      const filled = roleReq.filled ?? 0;
      if (filled < roleReq.count) {
        return { available: true };
      }
    }
    return { available: false, reason: '해당 역할의 모집이 마감되었습니다' };
  }

  // 역할 정보 없으면 통과 (레거시 호환)
  return { available: true };
}

// ============================================================================
// Application Service
// ============================================================================

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
        } catch (error) {
          logger.warn('공고 정보 조회 실패', { jobId, error });
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
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '지원 내역을 찾을 수 없습니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 본인 확인
      if (applicationData.applicantId !== applicantId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 지원만 취소할 수 있습니다',
        });
      }

      // 이미 취소된 경우
      if (applicationData.status === 'cancelled') {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_CANCELLED, {
          userMessage: '이미 취소된 지원입니다',
        });
      }

      // 확정된 경우 취소 불가
      if (applicationData.status === 'confirmed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED, {
          userMessage: '확정된 지원은 취소할 수 없습니다. 취소 요청을 이용해주세요.',
        });
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

    // Analytics 이벤트
    trackEvent('application_cancel', { application_id: applicationId });
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
      completed: 0,
      cancellation_pending: 0,
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
  input: CreateApplicationInput,
  applicantId: string,
  applicantName: string,
  applicantPhone?: string,
  applicantEmail?: string,
  applicantNickname?: string,
  applicantPhotoURL?: string
): Promise<Application> {
  const trace = startApiTrace('applyToJobV2');
  trace.putAttribute('jobPostingId', input.jobPostingId);
  trace.putAttribute('assignmentCount', String(input.assignments.length));

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

      // 5. 정원 확인 (dateSpecificRequirements 기반 계산, 레거시 폴백)
      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);

      if (totalPositions > 0 && currentFilled >= totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다',
          jobPostingId: input.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentFilled,
        });
      }

      // 5-1. 역할별 정원 확인 (Assignment의 첫 번째 역할 기준)
      const firstAssignmentRole = input.assignments[0]?.roleIds[0];
      if (firstAssignmentRole) {
        const roleCapacity = checkRoleCapacity(jobData, firstAssignmentRole);
        if (!roleCapacity.available) {
          throw new MaxCapacityReachedError({
            userMessage: roleCapacity.reason ?? '해당 역할의 모집이 마감되었습니다',
            jobPostingId: input.jobPostingId,
          });
        }
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
      // v3.0: roleIds 사용
      const primaryRole = (
        firstAssignment?.roleIds[0] ?? 'dealer'
      ) as StaffRole;

      // 9. 지원서 데이터 생성 (v2.0)
      const now = serverTimestamp();
      const applicationData: Omit<Application, 'id'> = {
        // 지원자 정보
        applicantId,
        applicantName,
        // undefined는 Firebase에 저장 불가 - 조건부 추가
        ...(applicantPhone && { applicantPhone }),
        ...(applicantEmail && { applicantEmail }),
        ...(applicantNickname && { applicantNickname }),
        ...(applicantPhotoURL && { applicantPhotoURL }),
        applicantRole: primaryRole,

        // 공고 정보 (레거시 호환)
        jobPostingId: input.jobPostingId,
        jobPostingTitle: jobData.title || '',
        // 레거시 필드: workDate가 있는 경우에만 포함
        ...(jobData.workDate && { jobPostingDate: jobData.workDate }),

        // NOTE: eventId, postId, postTitle 레거시 필드는 더 이상 저장하지 않음
        // 기존 데이터는 Application 타입에서 읽기 전용으로 지원

        // 지원 정보
        status: 'applied',
        // undefined는 Firebase에 저장 불가 - 조건부 추가
        ...(input.message && { message: input.message }),
        recruitmentType,

        // v2.0 핵심 필드
        assignments: input.assignments,
        // undefined는 Firebase에 저장 불가 - 조건부 추가
        ...(input.preQuestionAnswers && { preQuestionAnswers: input.preQuestionAnswers }),

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

    // 성능 추적: 지원 성공
    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트 (assignments에서 대표 역할 추출)
    const appliedPrimaryRole = result.assignments[0]?.roleIds?.[0] || 'other';
    trackJobApply(input.jobPostingId, result.jobPostingTitle, appliedPrimaryRole);

    return result;
  } catch (error) {
    // 성능 추적: 지원 실패
    trace.putAttribute('status', 'error');
    trace.stop();

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

// ============================================================================
// 취소 요청 시스템 (v2.1)
// ============================================================================

/**
 * 취소 요청 제출 (스태프용)
 *
 * @description 확정된 지원에 대해 취소 요청을 제출합니다.
 *              구인자가 승인하면 지원이 취소됩니다.
 *
 * 비즈니스 로직:
 * 1. 본인 확인
 * 2. 확정된 상태인지 확인
 * 3. 이미 취소 요청이 있는지 확인
 * 4. 취소 요청 생성 + 상태 변경 (원자적)
 */
export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string
): Promise<void> {
  const trace = startApiTrace('requestCancellation');
  trace.putAttribute('applicationId', input.applicationId);

  try {
    logger.info('취소 요청 제출 시작', {
      applicationId: input.applicationId,
      applicantId,
    });

    // 사유 검증
    if (!input.reason || input.reason.trim().length < 5) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '취소 사유를 5자 이상 입력해주세요',
      });
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '지원 내역을 찾을 수 없습니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 1. 본인 확인
      if (applicationData.applicantId !== applicantId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 지원만 취소 요청할 수 있습니다',
        });
      }

      // 2. 확정된 상태인지 확인
      if (applicationData.status !== 'confirmed') {
        if (applicationData.status === 'applied' || applicationData.status === 'pending') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '아직 확정되지 않은 지원은 직접 취소할 수 있습니다',
          });
        }
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '취소 요청이 불가능한 상태입니다',
        });
      }

      // 3. 이미 취소 요청이 있는지 확인
      if (applicationData.cancellationRequest) {
        if (applicationData.cancellationRequest.status === 'pending') {
          throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
            userMessage: '이미 취소 요청이 진행 중입니다',
          });
        }
        if (applicationData.cancellationRequest.status === 'rejected') {
          throw new BusinessError(ERROR_CODES.BUSINESS_PREVIOUSLY_REJECTED, {
            userMessage: '이전 취소 요청이 거절되었습니다. 구인자에게 직접 문의해주세요.',
          });
        }
      }

      // 4. 취소 요청 생성
      const cancellationRequest: CancellationRequest = {
        requestedAt: new Date().toISOString(),
        reason: input.reason.trim(),
        status: 'pending',
      };

      // 5. 트랜잭션 쓰기 - 상태를 cancellation_pending으로 변경
      transaction.update(applicationRef, {
        status: 'cancellation_pending' as ApplicationStatus,
        cancellationRequest,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('취소 요청 제출 성공', { applicationId: input.applicationId });

    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트
    trackEvent('cancellation_request', { application_id: input.applicationId });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    logger.error('취소 요청 제출 실패', error as Error, {
      applicationId: input.applicationId,
      applicantId,
    });

    if (error instanceof ValidationError) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 취소 요청 검토 (구인자용)
 *
 * @description 스태프의 취소 요청을 승인하거나 거절합니다.
 *
 * 비즈니스 로직:
 * 1. 공고 소유자 확인
 * 2. 취소 요청 상태 확인
 * 3. 승인 시: 지원 상태를 cancelled로 변경 + 지원자 수 감소
 * 4. 거절 시: 지원 상태를 confirmed로 복원
 */
export async function reviewCancellationRequest(
  input: ReviewCancellationInput,
  reviewerId: string
): Promise<void> {
  const trace = startApiTrace('reviewCancellationRequest');
  trace.putAttribute('applicationId', input.applicationId);
  trace.putAttribute('approved', String(input.approved));

  try {
    logger.info('취소 요청 검토 시작', {
      applicationId: input.applicationId,
      approved: input.approved,
      reviewerId,
    });

    // 거절 시 사유 필수
    if (!input.approved && (!input.rejectionReason || input.rejectionReason.trim().length < 3)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '거절 사유를 3자 이상 입력해주세요',
      });
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '지원 내역을 찾을 수 없습니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 1. 공고 정보 조회 및 소유자 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      if (jobData.ownerId !== reviewerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 요청만 검토할 수 있습니다',
        });
      }

      // 2. 취소 요청 상태 확인
      if (applicationData.status !== 'cancellation_pending') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '검토 대기 중인 취소 요청이 없습니다',
        });
      }

      if (!applicationData.cancellationRequest || applicationData.cancellationRequest.status !== 'pending') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '유효한 취소 요청이 없습니다',
        });
      }

      // 3. 취소 요청 업데이트 (undefined 값은 Firestore에서 허용되지 않음)
      const updatedCancellationRequest: CancellationRequest = {
        ...applicationData.cancellationRequest,
        status: input.approved ? 'approved' : 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
        // rejectionReason은 거절 시에만 포함 (undefined는 Firestore 에러 발생)
        ...(input.rejectionReason?.trim() ? { rejectionReason: input.rejectionReason.trim() } : {}),
      };

      if (input.approved) {
        // 승인: 지원 상태를 cancelled로 변경 + 지원자 수 감소
        transaction.update(applicationRef, {
          status: 'cancelled' as ApplicationStatus,
          cancellationRequest: updatedCancellationRequest,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(jobRef, {
          applicationCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } else {
        // 거절: 지원 상태를 confirmed로 복원
        transaction.update(applicationRef, {
          status: 'confirmed' as ApplicationStatus,
          cancellationRequest: updatedCancellationRequest,
          updatedAt: serverTimestamp(),
        });
      }
    });

    logger.info('취소 요청 검토 성공', {
      applicationId: input.applicationId,
      approved: input.approved,
    });

    trace.putAttribute('status', 'success');
    trace.stop();

    // Analytics 이벤트
    trackEvent('cancellation_reviewed', {
      application_id: input.applicationId,
      approved: input.approved,
    });
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();

    logger.error('취소 요청 검토 실패', error as Error, {
      applicationId: input.applicationId,
      reviewerId,
    });

    if (
      error instanceof ValidationError ||
      error instanceof BusinessError ||
      error instanceof PermissionError
    ) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 취소 요청 목록 조회 (구인자용)
 *
 * @description 특정 공고의 대기 중인 취소 요청 목록을 조회합니다.
 */
export async function getCancellationRequests(
  jobPostingId: string,
  ownerId: string
): Promise<ApplicationWithJob[]> {
  try {
    logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

    // 먼저 공고 소유자 확인
    const jobDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId));
    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jobData = jobDoc.data() as JobPosting;
    if (jobData.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    // 취소 요청 대기 중인 지원서 조회
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const q = query(
      applicationsRef,
      where('jobPostingId', '==', jobPostingId),
      where('status', '==', 'cancellation_pending'),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    const applications: ApplicationWithJob[] = snapshot.docs.map((docSnapshot) => ({
      ...docSnapshot.data(),
      id: docSnapshot.id,
      jobPosting: { ...jobData, id: jobDoc.id },
    })) as ApplicationWithJob[];

    logger.info('취소 요청 목록 조회 완료', {
      jobPostingId,
      count: applications.length,
    });

    return applications;
  } catch (error) {
    logger.error('취소 요청 목록 조회 실패', error as Error, { jobPostingId });

    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}
