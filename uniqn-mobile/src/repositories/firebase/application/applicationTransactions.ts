/**
 * UNIQN Mobile - Application Repository Transactions
 *
 * @description 지원 관련 쓰기/트랜잭션 연산
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
  type Transaction,
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
  CreateApplicationInput,
  RecruitmentType,
  RejectApplicationInput,
  RequestCancellationInput,
  ReviewCancellationInput,
  StaffRole,
  JobPosting,
} from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';

async function loadApplicationForTransaction(transaction: Transaction, applicationId: string) {
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

  return { applicationRef, applicationData };
}

async function loadJobPostingForTransaction(
  transaction: Transaction,
  jobPostingId: string,
  options?: {
    notFoundMessage?: string;
    invalidStateMessage?: string;
  }
) {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
  const jobDoc = await transaction.get(jobRef);

  if (!jobDoc.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: options?.notFoundMessage ?? '공고를 찾을 수 없습니다',
    });
  }

  const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
  if (!jobData) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: options?.invalidStateMessage ?? '공고 데이터가 올바르지 않습니다',
    });
  }

  return { jobRef, jobData };
}

async function loadJobPostingForApply(transaction: Transaction, jobPostingId: string) {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
  const jobDoc = await transaction.get(jobRef);

  if (!jobDoc.exists()) {
    throw new ApplicationClosedError({
      userMessage: '존재하지 않는 공고입니다.',
      jobPostingId,
    });
  }

  const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
  if (!jobData) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공고 데이터가 올바르지 않습니다',
    });
  }

  return { jobRef, jobData };
}

function assertApplicationApplicant(
  applicationData: Application,
  applicantId: string,
  userMessage: string
) {
  if (applicationData.applicantId !== applicantId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage,
    });
  }
}

function assertJobPostingOwner(jobData: JobPosting, ownerId: string, userMessage: string) {
  if (jobData.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage,
    });
  }
}

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

    for (const assignment of input.assignments) {
      if (!isValidAssignment(assignment)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해주세요.',
        });
      }
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobData } = await loadJobPostingForApply(transaction, input.jobPostingId);

      if (jobData.status !== STATUS.JOB_POSTING.ACTIVE) {
        throw new ApplicationClosedError({
          userMessage: '지원이 마감된 공고입니다.',
          jobPostingId: input.jobPostingId,
        });
      }

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

      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
      if (totalPositions > 0 && currentFilled >= totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다.',
          jobPostingId: input.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentFilled,
        });
      }

      const firstAssignmentRole = input.assignments[0]?.roleIds[0];
      if (firstAssignmentRole) {
        const roleCapacity = applicationValidator.checkRoleCapacity(jobData, firstAssignmentRole);
        if (!roleCapacity.available) {
          throw new MaxCapacityReachedError({
            userMessage: roleCapacity.reason ?? '해당 역할은 모집이 마감되었습니다.',
            jobPostingId: input.jobPostingId,
          });
        }
      }

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
            userMessage: '이미 지원한 공고입니다.',
            jobPostingId: input.jobPostingId,
            applicationId: existingApp.id,
          });
        }
      }

      const recruitmentType: RecruitmentType = jobData.postingType === 'fixed' ? 'fixed' : 'event';
      const firstAssignment = input.assignments[0];
      const primaryRole = (firstAssignment?.roleIds[0] ?? 'dealer') as StaffRole;

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
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );

      assertApplicationApplicant(applicationData, applicantId, '본인 지원만 취소할 수 있습니다');

      if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_CANCELLED, {
          userMessage: '이미 취소된 지원입니다',
        });
      }

      if (applicationData.status === STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED, {
          userMessage: '확정된 지원은 취소할 수 없습니다. 취소 요청을 이용해주세요.',
        });
      }

      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CANCELLED,
        updatedAt: serverTimestamp(),
      });

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

    if (!input.reason || input.reason.trim().length < 5) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '취소 사유를 5자 이상 입력해주세요',
      });
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        input.applicationId
      );

      assertApplicationApplicant(
        applicationData,
        applicantId,
        '본인 지원만 취소 요청할 수 있습니다'
      );

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        if (
          applicationData.status === STATUS.APPLICATION.APPLIED ||
          applicationData.status === STATUS.APPLICATION.PENDING
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '아직 확정되지 않은 지원은 직접 취소할 수 있습니다',
          });
        }
        if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 취소된 지원입니다',
          });
        }
        if (applicationData.status === STATUS.APPLICATION.REJECTED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '거절된 지원은 취소 요청이 불가능합니다',
          });
        }
        if (applicationData.status === STATUS.APPLICATION.COMPLETED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 완료된 근무는 취소 요청이 불가능합니다',
          });
        }
        if (applicationData.status === STATUS.APPLICATION.CANCELLATION_PENDING) {
          throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
            userMessage: '이미 취소 요청이 진행 중입니다',
          });
        }
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '취소 요청이 불가능한 상태입니다.',
        });
      }

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

      const cancellationRequest = {
        requestedAt: serverTimestamp(),
        reason: input.reason.trim(),
        status: STATUS.CANCELLATION_REQUEST.PENDING,
      };

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

    if (!input.approved && (!input.rejectionReason || input.rejectionReason.trim().length < 3)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '거절 사유를 3자 이상 입력해주세요',
      });
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        input.applicationId
      );
      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, reviewerId, '본인 공고의 취소 요청만 검토할 수 있습니다');

      if (applicationData.status !== STATUS.APPLICATION.CANCELLATION_PENDING) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '검토 대기 중인 취소 요청이 없습니다',
        });
      }

      if (
        !applicationData.cancellationRequest ||
        applicationData.cancellationRequest.status !== STATUS.CANCELLATION_REQUEST.PENDING
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '유효한 취소 요청이 없습니다',
        });
      }

      const baseFields = {
        requestedAt: applicationData.cancellationRequest.requestedAt,
        reason: applicationData.cancellationRequest.reason,
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerId,
      };

      const updatedCancellationRequest = input.approved
        ? { ...baseFields, status: STATUS.CANCELLATION_REQUEST.APPROVED }
        : {
            ...baseFields,
            status: STATUS.CANCELLATION_REQUEST.REJECTED,
            rejectionReason: input.rejectionReason?.trim() || '거절됨',
          };

      if (input.approved) {
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
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        input.applicationId
      );
      const { jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, reviewerId, '본인 공고의 지원자만 거절할 수 있습니다');

      if (
        applicationData.status !== STATUS.APPLICATION.APPLIED &&
        applicationData.status !== STATUS.APPLICATION.PENDING
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: `지원 상태가 '${applicationData.status}'입니다. 대기 중인 지원만 거절할 수 있습니다.`,
        });
      }

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
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );
      const { jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId,
        {
          notFoundMessage: '존재하지 않는 공고입니다.',
          invalidStateMessage: '데이터가 올바르지 않습니다',
        }
      );

      assertJobPostingOwner(jobData, ownerId, '본인 공고만 조회할 수 있습니다');

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
