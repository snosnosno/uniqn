/**
 * UNIQN Mobile - Application Repository Transactions
 *
 * @description 지원서 쓰기/트랜잭션 (7개 메서드)
 */

import { doc, runTransaction, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
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
  isAppError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import { applicationValidator } from '@/domains/application';
import { isValidAssignment, validateRequiredAnswers } from '@/types';
import type { ApplyContext } from '../../interfaces';
import type {
  Application,
  ApplicationStatus,
  CancellationRequest,
  ConfirmApplicationInputV2,
  CreateApplicationInput,
  RecruitmentType,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  StaffRole,
  WorkLog,
  WorkLogStatus,
} from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';

// ============================================================================
// Write Operations (Transactions)
// ============================================================================

export async function applyWithTransaction(
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
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, input.jobPostingId);
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
      if (jobData.status !== STATUS.JOB_POSTING.ACTIVE) {
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

      // 역할별 정원 확인 (도메인 로직 활용)
      const firstAssignmentRole = input.assignments[0]?.roleIds[0];
      if (firstAssignmentRole) {
        const roleCapacity = applicationValidator.checkRoleCapacity(jobData, firstAssignmentRole);
        if (!roleCapacity.available) {
          throw new MaxCapacityReachedError({
            userMessage: roleCapacity.reason ?? '해당 역할의 모집이 마감되었습니다',
            jobPostingId: input.jobPostingId,
          });
        }
      }

      // 중복 지원 검사
      const applicationId = `${input.jobPostingId}_${context.applicantId}`;
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);

      const existingApp = await transaction.get(applicationRef);
      if (existingApp.exists()) {
        const existingData = parseApplicationDocument({
          id: existingApp.id,
          ...existingApp.data(),
        });
        if (existingData && existingData.status !== STATUS.APPLICATION.CANCELLED) {
          throw new AlreadyAppliedError({
            userMessage: '이미 지원한 공고입니다',
            jobPostingId: input.jobPostingId,
            applicationId: existingApp.id,
          });
        }
      }

      // 모집 유형 결정
      const recruitmentType: RecruitmentType = jobData.postingType === 'fixed' ? 'fixed' : 'event';

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

        status: STATUS.APPLICATION.APPLIED,
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

export async function cancelWithTransaction(
  applicationId: string,
  applicantId: string
): Promise<void> {
  try {
    logger.info('지원 취소 시작', { applicationId, applicantId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
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
      if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_CANCELLED, {
          userMessage: '이미 취소된 지원입니다',
        });
      }

      // 확정된 경우 취소 불가
      if (applicationData.status === STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED, {
          userMessage: '확정된 지원은 취소할 수 없습니다. 취소 요청을 이용해주세요.',
        });
      }

      // 지원 취소 처리
      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CANCELLED,
        updatedAt: serverTimestamp(),
      });

      // 공고의 지원자 수 감소 (존재 확인 + 음수 방지)
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);
      if (jobDoc.exists()) {
        const currentCount = (jobDoc.data()?.applicationCount as number) ?? 0;
        transaction.update(jobRef, {
          applicationCount: Math.max(0, currentCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    logger.info('지원 취소 성공', { applicationId });
  } catch (error) {
    logger.error('지원 취소 실패', toError(error), { applicationId });
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 취소 트랜잭션',
      component: 'ApplicationRepository',
      context: { applicationId, applicantId },
    });
  }
}

export async function requestCancellationWithTransaction(
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
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, input.applicationId);
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
      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        // 지원 대기 상태: 직접 취소 가능
        if (
          applicationData.status === STATUS.APPLICATION.APPLIED ||
          applicationData.status === STATUS.APPLICATION.PENDING
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '아직 확정되지 않은 지원은 직접 취소할 수 있습니다',
          });
        }
        // 이미 취소된 상태
        if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 취소된 지원입니다',
          });
        }
        // 거절된 상태
        if (applicationData.status === STATUS.APPLICATION.REJECTED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '거절된 지원은 취소 요청이 불가능합니다',
          });
        }
        // 완료된 상태
        if (applicationData.status === STATUS.APPLICATION.COMPLETED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 완료된 근무는 취소 요청이 불가능합니다',
          });
        }
        // 취소 요청 대기 중
        if (applicationData.status === STATUS.APPLICATION.CANCELLATION_PENDING) {
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
        if (applicationData.cancellationRequest.status === STATUS.CANCELLATION_REQUEST.PENDING) {
          throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
            userMessage: '이미 취소 요청이 진행 중입니다',
          });
        }
        if (applicationData.cancellationRequest.status === STATUS.CANCELLATION_REQUEST.REJECTED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_PREVIOUSLY_REJECTED, {
            userMessage: '이전 취소 요청이 거절되었습니다. 구인자에게 직접 문의해주세요.',
          });
        }
      }

      // 취소 요청 생성
      const cancellationRequest: CancellationRequest = {
        requestedAt: new Date().toISOString(),
        reason: input.reason.trim(),
        status: STATUS.CANCELLATION_REQUEST.PENDING,
      };

      // 트랜잭션 쓰기
      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CANCELLATION_PENDING as ApplicationStatus,
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

export async function reviewCancellationWithTransaction(
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
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, input.applicationId);
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
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
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

      // 공고 소유자 확인
      if (jobData.ownerId !== reviewerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 요청만 검토할 수 있습니다',
        });
      }

      // 취소 요청 상태 확인
      if (applicationData.status !== STATUS.APPLICATION.CANCELLATION_PENDING) {
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
        ? { ...baseFields, status: STATUS.CANCELLATION_REQUEST.APPROVED }
        : {
            ...baseFields,
            status: STATUS.CANCELLATION_REQUEST.REJECTED,
            rejectionReason: input.rejectionReason?.trim() || '거절됨',
          };

      if (input.approved) {
        // 승인: 지원 상태를 cancelled로 변경 + 지원자 수/확정 인원 감소
        transaction.update(applicationRef, {
          status: STATUS.APPLICATION.CANCELLED as ApplicationStatus,
          cancellationRequest: updatedCancellationRequest,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const currentAppCount = (jobData.applicationCount as number | undefined) ?? 0;
        const currentFilled = (jobData.filledPositions as number | undefined) ?? 0;
        transaction.update(jobRef, {
          applicationCount: Math.max(0, currentAppCount - 1),
          filledPositions: Math.max(0, currentFilled - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        // 거절: 지원 상태를 confirmed로 복원
        transaction.update(applicationRef, {
          status: STATUS.APPLICATION.CONFIRMED as ApplicationStatus,
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

/**
 * @deprecated v2.0 confirmWithHistoryTransaction 사용 권장.
 * v1은 결정론적 WorkLog ID(`jobPostingId_applicantId_date`)를 사용하여
 * 확정 취소 후 재확정 시 이전 cancelled WorkLog를 덮어쓰는 문제가 있음.
 */
export async function confirmWithTransaction(
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
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, input.applicationId);
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
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
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

      // 공고 소유자 확인
      if (jobData.ownerId !== reviewerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 지원만 확정할 수 있습니다',
        });
      }

      // 지원 상태 확인 (applied 또는 pending만 확정 가능)
      if (
        applicationData.status !== STATUS.APPLICATION.APPLIED &&
        applicationData.status !== STATUS.APPLICATION.PENDING
      ) {
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
        status: STATUS.APPLICATION.CONFIRMED as ApplicationStatus,
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
          const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);

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
            status: STATUS.WORK_LOG.SCHEDULED as WorkLogStatus,
            payrollStatus: STATUS.PAYROLL.PENDING,
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

export async function rejectWithTransaction(
  input: RejectApplicationInput,
  reviewerId: string
): Promise<void> {
  try {
    logger.info('지원 거절 시작', {
      applicationId: input.applicationId,
      reviewerId,
    });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 지원서 조회
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, input.applicationId);
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
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
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

      // 공고 소유자 확인
      if (jobData.ownerId !== reviewerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 지원만 거절할 수 있습니다',
        });
      }

      // 지원 상태 확인 (applied 또는 pending만 거절 가능)
      if (
        applicationData.status !== STATUS.APPLICATION.APPLIED &&
        applicationData.status !== STATUS.APPLICATION.PENDING
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: `지원 상태가 '${applicationData.status}'입니다. 대기 중인 지원만 거절할 수 있습니다.`,
        });
      }

      // 지원 상태 업데이트
      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.REJECTED as ApplicationStatus,
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

export async function markAsRead(applicationId: string, ownerId: string): Promise<void> {
  try {
    logger.info('지원 읽음 처리 시작', { applicationId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
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
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
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

      // 공고 소유자 확인
      if (jobData.ownerId !== ownerId) {
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
