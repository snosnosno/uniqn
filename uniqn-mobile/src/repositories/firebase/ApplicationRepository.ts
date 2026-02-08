/**
 * UNIQN Mobile - Firebase Application Repository
 *
 * @description Firebase Firestore 기반 Application Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 트랜잭션 캡슐화 (데이터 정합성 보장)
 * 3. 문서 파싱 및 타입 변환
 *
 * 비즈니스 로직:
 * - 지원 검증 → ApplicationValidator (domains/)
 * - 역할 정원 확인 → checkRoleCapacity helper
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
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
  ValidationError,
  BusinessError,
  PermissionError,
  ERROR_CODES,
  toError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type {
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
  ApplicantListWithStats,
  SubscribeCallbacks,
} from '../interfaces';
import type {
  Application,
  ApplicationStatus,
  ApplicationStats,
  CancellationRequest,
  ConfirmApplicationInputV2,
  CreateApplicationInput,
  JobPosting,
  RecruitmentType,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  StaffRole,
  WorkLog,
  WorkLogStatus,
} from '@/types';
import { isAppError, isPermissionError, isAuthError, AuthError } from '@/errors';
import { isValidAssignment, validateRequiredAnswers } from '@/types';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const WORK_LOGS_COLLECTION = 'workLogs';

// Lazy import to avoid circular dependency
let _jobPostingRepository: import('./JobPostingRepository').FirebaseJobPostingRepository | null =
  null;
function getJobPostingRepository(): import('./JobPostingRepository').FirebaseJobPostingRepository {
  if (!_jobPostingRepository) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseJobPostingRepository } = require('./JobPostingRepository');
    _jobPostingRepository = new FirebaseJobPostingRepository();
  }
  // Non-null assertion: 위에서 초기화 보장
  return _jobPostingRepository!;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 특정 역할의 정원 확인
 */
function checkRoleCapacity(
  jobData: JobPosting,
  appliedRole: string
): { available: boolean; reason?: string } {
  const matchesRole = (r: { role?: string; name?: string; customRole?: string }) => {
    if (r.role === appliedRole || r.name === appliedRole) return true;
    if (r.role === 'other' && r.customRole === appliedRole) return true;
    return false;
  };

  if (jobData.dateSpecificRequirements?.length) {
    for (const req of jobData.dateSpecificRequirements) {
      for (const slot of req.timeSlots || []) {
        const roleReq = slot.roles?.find(matchesRole);
        if (roleReq) {
          const total = roleReq.headcount ?? 0;
          const filled = roleReq.filled ?? 0;
          if (total > 0 && filled < total) {
            return { available: true };
          }
        }
      }
    }
    return { available: false, reason: '해당 역할의 모집이 마감되었습니다' };
  }

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

  return { available: true };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Application Repository
 */
export class FirebaseApplicationRepository implements IApplicationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(applicationId: string): Promise<ApplicationWithJob | null> {
    try {
      logger.info('지원 상세 조회', { applicationId });

      const docRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
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
        doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, application.jobPostingId)
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

  async getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]> {
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
          const jobPostings = await getJobPostingRepository().getByIdBatch(
            Array.from(jobPostingIds)
          );

          for (const job of jobPostings) {
            jobPostingMap.set(job.id, job);
          }
        } catch (error) {
          logger.warn('공고 배치 조회 실패, 개별 조회로 폴백', { error });
          // Fallback: 배치 조회 실패 시 개별 조회
          for (const jobId of jobPostingIds) {
            try {
              const jobDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobId));
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

  async getByJobPostingId(jobPostingId: string): Promise<Application[]> {
    try {
      logger.info('공고별 지원서 조회', { jobPostingId });

      const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
      const q = query(
        applicationsRef,
        where('jobPostingId', '==', jobPostingId),
        orderBy('createdAt', 'desc')
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

  async hasApplied(jobPostingId: string, applicantId: string): Promise<boolean> {
    try {
      const applicationId = `${jobPostingId}_${applicantId}`;
      const docRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return false;
      }

      const data = parseApplicationDocument({ id: docSnap.id, ...docSnap.data() });
      if (!data) {
        return false;
      }
      return data.status !== 'cancelled';
    } catch (error) {
      logger.error('지원 여부 확인 실패', toError(error), { jobPostingId, applicantId });
      return false;
    }
  }

  async getStatsByApplicantId(applicantId: string): Promise<Record<ApplicationStatus, number>> {
    try {
      const applications = await this.getByApplicantId(applicantId);

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
      logger.error('지원 통계 조회 실패', toError(error), { applicantId });
      throw handleServiceError(error, {
        operation: '지원 통계 조회',
        component: 'ApplicationRepository',
        context: { applicantId },
      });
    }
  }

  async getCancellationRequests(
    jobPostingId: string,
    ownerId: string
  ): Promise<ApplicationWithJob[]> {
    try {
      logger.info('취소 요청 목록 조회', { jobPostingId, ownerId });

      // 공고 소유자 확인
      const jobDoc = await getDoc(doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId));
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

      const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
      const q = query(
        applicationsRef,
        where('jobPostingId', '==', jobPostingId),
        where('status', '==', 'cancellation_pending'),
        orderBy('updatedAt', 'desc')
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

  // ==========================================================================
  // 트랜잭션 (Write)
  // ==========================================================================

  async applyWithTransaction(
    input: CreateApplicationInput,
    context: ApplyContext
  ): Promise<Application> {
    try {
      logger.info('지원하기 트랜잭션 시작', {
        jobPostingId: input.jobPostingId,
        applicantId: context.applicantId,
        assignmentCount: input.assignments.length,
      });

      // Assignment 유효성 검증
      for (const assignment of input.assignments) {
        if (!isValidAssignment(assignment)) {
          throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
            userMessage: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해주세요.',
          });
        }
      }

      const result = await runTransaction(getFirebaseDb(), async (transaction) => {
        // 공고 정보 읽기
        const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, input.jobPostingId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new ApplicationClosedError({
            userMessage: '존재하지 않는 공고입니다',
            jobPostingId: input.jobPostingId,
          });
        }

        const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
        if (!jobData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '공고 데이터가 올바르지 않습니다',
          });
        }

        // 공고 상태 확인
        if (jobData.status !== 'active') {
          throw new ApplicationClosedError({
            userMessage: '지원이 마감된 공고입니다',
            jobPostingId: input.jobPostingId,
          });
        }

        // 사전질문 필수 답변 검증
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

        // 정원 확인
        const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);

        if (totalPositions > 0 && currentFilled >= totalPositions) {
          throw new MaxCapacityReachedError({
            userMessage: '모집 인원이 마감되었습니다',
            jobPostingId: input.jobPostingId,
            maxCapacity: totalPositions,
            currentCount: currentFilled,
          });
        }

        // 역할별 정원 확인
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

        // 중복 지원 검사
        const applicationId = `${input.jobPostingId}_${context.applicantId}`;
        const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);

        const existingApp = await transaction.get(applicationRef);
        if (existingApp.exists()) {
          const existingData = parseApplicationDocument({
            id: existingApp.id,
            ...existingApp.data(),
          });
          if (existingData && existingData.status !== 'cancelled') {
            throw new AlreadyAppliedError({
              userMessage: '이미 지원한 공고입니다',
              jobPostingId: input.jobPostingId,
              applicationId: existingApp.id,
            });
          }
        }

        // 모집 유형 결정
        const recruitmentType: RecruitmentType =
          jobData.postingType === 'fixed' ? 'fixed' : 'event';

        // 대표 역할 결정
        const firstAssignment = input.assignments[0];
        const primaryRole = (firstAssignment?.roleIds[0] ?? 'dealer') as StaffRole;

        // 지원서 데이터 생성
        const now = serverTimestamp();
        const applicationData: Omit<Application, 'id'> = {
          applicantId: context.applicantId,
          applicantName: context.applicantName,
          ...(context.applicantPhone && { applicantPhone: context.applicantPhone }),
          ...(context.applicantEmail && { applicantEmail: context.applicantEmail }),
          ...(context.applicantNickname && { applicantNickname: context.applicantNickname }),
          ...(context.applicantPhotoURL && { applicantPhotoURL: context.applicantPhotoURL }),
          applicantRole: primaryRole,

          jobPostingId: input.jobPostingId,
          jobPostingTitle: jobData.title || '',
          ...(jobData.workDate && { jobPostingDate: jobData.workDate }),

          status: 'applied',
          ...(input.message && { message: input.message }),
          recruitmentType,

          assignments: input.assignments,
          ...(input.preQuestionAnswers && { preQuestionAnswers: input.preQuestionAnswers }),

          isRead: false,
          createdAt: now as Timestamp,
          updatedAt: now as Timestamp,
        };

        // 트랜잭션 쓰기
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

      logger.info('지원하기 트랜잭션 성공', {
        applicationId: result.id,
        jobPostingId: input.jobPostingId,
        assignmentCount: input.assignments.length,
      });

      return result;
    } catch (error) {
      logger.error('지원하기 트랜잭션 실패', toError(error), {
        jobPostingId: input.jobPostingId,
        applicantId: context.applicantId,
      });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '지원하기 트랜잭션',
        component: 'ApplicationRepository',
        context: { jobPostingId: input.jobPostingId, applicantId: context.applicantId },
      });
    }
  }

  async cancelWithTransaction(applicationId: string, applicantId: string): Promise<void> {
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

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '지원 데이터가 올바르지 않습니다',
          });
        }

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
    } catch (error) {
      logger.error('지원 취소 실패', toError(error), { applicationId });
      throw handleServiceError(error, {
        operation: '지원 취소 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId, applicantId },
      });
    }
  }

  async requestCancellationWithTransaction(
    input: RequestCancellationInput,
    applicantId: string
  ): Promise<void> {
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

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '지원 데이터가 올바르지 않습니다',
          });
        }

        // 본인 확인
        if (applicationData.applicantId !== applicantId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 지원만 취소 요청할 수 있습니다',
          });
        }

        // 확정된 상태인지 확인 (명시적 상태 검증)
        if (applicationData.status !== 'confirmed') {
          // 지원 대기 상태: 직접 취소 가능
          if (applicationData.status === 'applied' || applicationData.status === 'pending') {
            throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '아직 확정되지 않은 지원은 직접 취소할 수 있습니다',
            });
          }
          // 이미 취소된 상태
          if (applicationData.status === 'cancelled') {
            throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '이미 취소된 지원입니다',
            });
          }
          // 거절된 상태
          if (applicationData.status === 'rejected') {
            throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '거절된 지원은 취소 요청이 불가능합니다',
            });
          }
          // 완료된 상태
          if (applicationData.status === 'completed') {
            throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '이미 완료된 근무는 취소 요청이 불가능합니다',
            });
          }
          // 취소 요청 대기 중
          if (applicationData.status === 'cancellation_pending') {
            throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
              userMessage: '이미 취소 요청이 진행 중입니다',
            });
          }
          // 기타 알 수 없는 상태
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '취소 요청이 불가능한 상태입니다',
          });
        }

        // 이미 취소 요청이 있는지 확인
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

        // 취소 요청 생성
        const cancellationRequest: CancellationRequest = {
          requestedAt: new Date().toISOString(),
          reason: input.reason.trim(),
          status: 'pending',
        };

        // 트랜잭션 쓰기
        transaction.update(applicationRef, {
          status: 'cancellation_pending' as ApplicationStatus,
          cancellationRequest,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('취소 요청 제출 성공', { applicationId: input.applicationId });
    } catch (error) {
      logger.error('취소 요청 제출 실패', toError(error), {
        applicationId: input.applicationId,
        applicantId,
      });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '취소 요청 제출 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId: input.applicationId, applicantId },
      });
    }
  }

  async reviewCancellationWithTransaction(
    input: ReviewCancellationInput,
    reviewerId: string
  ): Promise<void> {
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

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '지원 데이터가 올바르지 않습니다',
          });
        }

        // 공고 정보 조회 및 소유자 확인
        const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
        const jobDoc = await transaction.get(jobRef);

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

        if (jobData.ownerId !== reviewerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고에 대한 요청만 검토할 수 있습니다',
          });
        }

        // 취소 요청 상태 확인
        if (applicationData.status !== 'cancellation_pending') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '검토 대기 중인 취소 요청이 없습니다',
          });
        }

        if (
          !applicationData.cancellationRequest ||
          applicationData.cancellationRequest.status !== 'pending'
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '유효한 취소 요청이 없습니다',
          });
        }

        // 취소 요청 업데이트 (Discriminated Union 패턴)
        const baseFields = {
          requestedAt: applicationData.cancellationRequest.requestedAt,
          reason: applicationData.cancellationRequest.reason,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerId,
        };

        const updatedCancellationRequest: CancellationRequest = input.approved
          ? { ...baseFields, status: 'approved' as const }
          : {
              ...baseFields,
              status: 'rejected' as const,
              rejectionReason: input.rejectionReason?.trim() || '거절됨',
            };

        if (input.approved) {
          // 승인: 지원 상태를 cancelled로 변경 + 지원자 수/확정 인원 감소
          transaction.update(applicationRef, {
            status: 'cancelled' as ApplicationStatus,
            cancellationRequest: updatedCancellationRequest,
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          transaction.update(jobRef, {
            applicationCount: increment(-1),
            filledPositions: increment(-1),
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
    } catch (error) {
      logger.error('취소 요청 검토 실패', toError(error), {
        applicationId: input.applicationId,
        reviewerId,
      });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '취소 요청 검토 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId: input.applicationId, reviewerId },
      });
    }
  }

  async confirmWithTransaction(
    input: ConfirmApplicationInputV2,
    reviewerId: string
  ): Promise<void> {
    try {
      logger.info('지원 확정 시작', {
        applicationId: input.applicationId,
        reviewerId,
      });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 지원서 조회
        const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
        const applicationDoc = await transaction.get(applicationRef);

        if (!applicationDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '지원 내역을 찾을 수 없습니다',
          });
        }

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '지원 데이터가 올바르지 않습니다',
          });
        }

        // 공고 조회 및 소유자 확인
        const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
        const jobDoc = await transaction.get(jobRef);

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

        // 소유자 확인
        if (jobData.ownerId !== reviewerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고에 대한 지원만 확정할 수 있습니다',
          });
        }

        // 지원 상태 확인 (applied 또는 pending만 확정 가능)
        if (applicationData.status !== 'applied' && applicationData.status !== 'pending') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: `지원 상태가 '${applicationData.status}'입니다. 대기 중인 지원만 확정할 수 있습니다.`,
          });
        }

        // 정원 확인
        const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
        if (totalPositions > 0 && currentFilled >= totalPositions) {
          throw new MaxCapacityReachedError({
            userMessage: '모집 인원이 마감되었습니다',
            jobPostingId: applicationData.jobPostingId,
            maxCapacity: totalPositions,
            currentCount: currentFilled,
          });
        }

        // 확정할 assignments 결정
        const assignmentsToConfirm = input.selectedAssignments || applicationData.assignments;

        // 지원 상태 업데이트
        transaction.update(applicationRef, {
          status: 'confirmed' as ApplicationStatus,
          confirmedAt: serverTimestamp(),
          processedBy: reviewerId,
          processedAt: serverTimestamp(),
          ...(input.notes && { notes: input.notes }),
          updatedAt: serverTimestamp(),
        });

        // filledPositions 증가
        transaction.update(jobRef, {
          filledPositions: increment(1),
          updatedAt: serverTimestamp(),
        });

        // WorkLog 생성 (각 assignment의 날짜별로)
        for (const assignment of assignmentsToConfirm) {
          for (const date of assignment.dates) {
            const workLogId = `${applicationData.jobPostingId}_${applicationData.applicantId}_${date}`;
            const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);

            const primaryRole = (assignment.roleIds[0] || 'other') as StaffRole;

            const workLogData: Omit<WorkLog, 'id' | 'createdAt' | 'updatedAt'> = {
              staffId: applicationData.applicantId,
              staffName: applicationData.applicantName,
              staffNickname: applicationData.applicantNickname,
              staffPhotoURL: applicationData.applicantPhotoURL,
              jobPostingId: applicationData.jobPostingId,
              ownerId: jobData.ownerId,
              date,
              role: primaryRole,
              status: 'scheduled' as WorkLogStatus,
              payrollStatus: 'pending',
              ...(assignment.timeSlot && { timeSlot: assignment.timeSlot }),
            };

            transaction.set(workLogRef, {
              ...workLogData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      });

      logger.info('지원 확정 성공', { applicationId: input.applicationId });
    } catch (error) {
      logger.error('지원 확정 실패', toError(error), {
        applicationId: input.applicationId,
        reviewerId,
      });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '지원 확정 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId: input.applicationId, reviewerId },
      });
    }
  }

  async rejectWithTransaction(input: RejectApplicationInput, reviewerId: string): Promise<void> {
    try {
      logger.info('지원 거절 시작', {
        applicationId: input.applicationId,
        reviewerId,
      });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 지원서 조회
        const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, input.applicationId);
        const applicationDoc = await transaction.get(applicationRef);

        if (!applicationDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '지원 내역을 찾을 수 없습니다',
          });
        }

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '지원 데이터가 올바르지 않습니다',
          });
        }

        // 공고 조회 및 소유자 확인
        const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
        const jobDoc = await transaction.get(jobRef);

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

        // 소유자 확인
        if (jobData.ownerId !== reviewerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고에 대한 지원만 거절할 수 있습니다',
          });
        }

        // 지원 상태 확인 (applied 또는 pending만 거절 가능)
        if (applicationData.status !== 'applied' && applicationData.status !== 'pending') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: `지원 상태가 '${applicationData.status}'입니다. 대기 중인 지원만 거절할 수 있습니다.`,
          });
        }

        // 지원 상태 업데이트
        transaction.update(applicationRef, {
          status: 'rejected' as ApplicationStatus,
          rejectionReason: input.reason || '',
          processedBy: reviewerId,
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('지원 거절 성공', { applicationId: input.applicationId });
    } catch (error) {
      logger.error('지원 거절 실패', toError(error), {
        applicationId: input.applicationId,
        reviewerId,
      });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '지원 거절 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId: input.applicationId, reviewerId },
      });
    }
  }

  async markAsRead(applicationId: string, ownerId: string): Promise<void> {
    try {
      logger.info('지원 읽음 처리 시작', { applicationId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 지원서 읽기
        const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
        const applicationDoc = await transaction.get(applicationRef);

        if (!applicationDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 지원입니다',
          });
        }

        const applicationData = parseApplicationDocument({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        });
        if (!applicationData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '데이터가 올바르지 않습니다',
          });
        }

        // 공고 소유자 확인
        const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
        const jobDoc = await transaction.get(jobRef);

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

        // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
        const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
        if (postingOwnerId !== ownerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 조회할 수 있습니다',
          });
        }

        // 읽음 처리
        transaction.update(applicationRef, {
          isRead: true,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('지원 읽음 처리 성공', { applicationId });
    } catch (error) {
      logger.error('지원 읽음 처리 실패', toError(error), { applicationId, ownerId });

      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '지원 읽음 처리 트랜잭션',
        component: 'ApplicationRepository',
        context: { applicationId, ownerId },
      });
    }
  }

  // ==========================================================================
  // 구인자 전용 (Employer)
  // ==========================================================================

  async findByJobPostingWithStats(
    jobPostingId: string,
    ownerId: string,
    statusFilter?: ApplicationStatus | ApplicationStatus[]
  ): Promise<ApplicantListWithStats> {
    try {
      logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

      // 공고 소유자 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
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

      // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
      const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
      if (postingOwnerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 조회할 수 있습니다',
        });
      }

      // 지원자 목록 조회
      const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
      let q = query(
        applicationsRef,
        where('jobPostingId', '==', jobPostingId),
        orderBy('createdAt', 'desc')
      );

      // 상태 필터 적용 (단일 상태)
      if (statusFilter) {
        const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        if (statuses.length === 1) {
          q = query(
            applicationsRef,
            where('jobPostingId', '==', jobPostingId),
            where('status', '==', statuses[0]),
            orderBy('createdAt', 'desc')
          );
        }
      }

      const snapshot = await getDocs(q);
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
        const application = {
          ...docSnapshot.data(),
          id: docSnapshot.id,
          jobPosting: { ...jobData, id: jobDoc.id },
        } as ApplicationWithJob;

        // 복수 상태 필터 적용 (클라이언트 사이드)
        if (statusFilter && Array.isArray(statusFilter) && statusFilter.length > 1) {
          if (!statusFilter.includes(application.status)) {
            return;
          }
        }

        applications.push(application);

        // 통계 집계
        stats.total++;
        const statsKey = STATUS_TO_STATS_KEY[application.status];
        if (statsKey && statsKey !== 'total') {
          stats[statsKey]++;
        }
      });

      logger.info('지원자 목록 조회 완료', {
        jobPostingId,
        count: applications.length,
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

  subscribeByJobPosting(
    jobPostingId: string,
    ownerId: string,
    callbacks: SubscribeCallbacks
  ): Unsubscribe {
    logger.info('지원자 목록 실시간 구독 시작', { jobPostingId, ownerId });

    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const q = query(
      applicationsRef,
      where('jobPostingId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    // 공고 정보 캐싱 (소유권 확인 및 지원자 데이터에 포함)
    let cachedJobPosting: JobPosting | null = null;
    let isOwnerVerified = false;
    let unsubscribeFn: Unsubscribe | null = null;

    /**
     * 치명적 에러 시 구독 자동 해제
     */
    const handleFatalError = (error: Error) => {
      if (isPermissionError(error) || isAuthError(error)) {
        logger.warn('치명적 에러로 구독 자동 해제', {
          errorCode: (error as PermissionError | AuthError).code,
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
            const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
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

            const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
            if (postingOwnerId !== ownerId) {
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
            const application = {
              ...docSnapshot.data(),
              id: docSnapshot.id,
              jobPosting: cachedJobPosting,
            } as ApplicationWithJob;

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
        const appError = handleServiceError(firebaseError, {
          operation: '지원자 목록 실시간 구독',
          component: 'ApplicationRepository',
          context: { jobPostingId },
        });

        handleFatalError(appError as Error);
      }
    );

    return () => unsubscribeFn?.();
  }
}
