/**
 * UNIQN Mobile - Application repository transactions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
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
import {
  normalizePostingAggregateStats,
  selectPostingWorkflow,
  transitionPostingAggregateStats,
} from '@/domains/job-posting';
import { normalizeAssignmentRole } from '@/types/assignment';
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
  JobPosting,
} from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';
import { releaseConfirmedAssignmentsInTransaction } from './applicationLifecycleHelpers';

async function loadApplicationForTransaction(transaction: Transaction, applicationId: string) {
  const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
  const applicationDoc = await transaction.get(applicationRef);

  if (!applicationDoc.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: '지원 내역을 찾을 수 없습니다.',
    });
  }

  const applicationData = parseApplicationDocument({
    id: applicationDoc.id,
    ...applicationDoc.data(),
  });

  if (!applicationData) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '지원 데이터가 올바르지 않습니다.',
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
      userMessage: options?.notFoundMessage ?? '공고를 찾을 수 없습니다.',
    });
  }

  const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
  if (!jobData) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: options?.invalidStateMessage ?? '공고 데이터가 올바르지 않습니다.',
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
      userMessage: '공고 데이터가 올바르지 않습니다.',
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

async function prefetchRelatedWorkLogIds(applicationId: string): Promise<string[]> {
  try {
    const applicationPreCheck = await getDoc(
      doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId)
    );
    if (!applicationPreCheck.exists()) {
      return [];
    }

    const preData = applicationPreCheck.data();
    if (!preData?.applicantId || !preData?.jobPostingId) {
      return [];
    }

    const workLogsSnapshot = await getDocs(
      query(
        collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
        where('staffId', '==', preData.applicantId),
        where('jobPostingId', '==', preData.jobPostingId)
      )
    );

    return workLogsSnapshot.docs.map((docSnapshot) => docSnapshot.id);
  } catch (error) {
    logger.warn('WorkLog 사전 조회 실패', {
      applicationId,
      error: toError(error),
    });
    return [];
  }
}

function updateJobPostingStatsInTransaction(params: {
  transaction: Transaction;
  jobRef: ReturnType<typeof doc>;
  jobData: JobPosting;
  fromStatus?: ApplicationStatus | null;
  toStatus?: ApplicationStatus | null;
  totalApplicantsDelta?: number;
}) {
  const currentStats = normalizePostingAggregateStats(
    params.jobData.stats,
    params.jobData.schedule
  );
  const nextStats = transitionPostingAggregateStats(currentStats, {
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    totalApplicantsDelta: params.totalApplicantsDelta,
  });

  params.transaction.update(params.jobRef, {
    stats: nextStats,
    updatedAt: serverTimestamp(),
  });
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
          userMessage: '잘못된 지원 정보입니다. 역할, 시간, 날짜를 확인해 주세요.',
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

      if (jobData.schedule.kind !== 'dated') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '고정공고 지원은 현재 지원하지 않습니다.',
        });
      }

      const validation = applicationValidator.validateApplication(
        jobData,
        input.assignments,
        input.preQuestionAnswers
      );
      if (!validation.isValid) {
        const firstError = validation.errors[0];
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: firstError?.message ?? '지원 정보를 확인해 주세요.',
        });
      }

      const questions = jobData.questions.items ?? [];
      if (questions.length > 0) {
        if (!input.preQuestionAnswers?.length) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '사전질문에 답변해 주세요',
          });
        }

        const isValid = validateRequiredAnswers(input.preQuestionAnswers);
        if (!isValid) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '필수 질문에 모두 답변해 주세요',
          });
        }
      }

      const applicationId = `${input.jobPostingId}_${context.applicantId}`;
      const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
      const existingApp = await transaction.get(applicationRef);
      const existingData = existingApp.exists()
        ? parseApplicationDocument({
            id: existingApp.id,
            ...existingApp.data(),
          })
        : null;

      if (existingData && existingData.status !== STATUS.APPLICATION.CANCELLED) {
        throw new AlreadyAppliedError({
          userMessage: '이미 지원한 공고입니다.',
          jobPostingId: input.jobPostingId,
          applicationId: existingApp.id,
        });
      }

      const recruitmentType: RecruitmentType = selectPostingWorkflow(jobData).recruitmentType;
      const firstAssignment = input.assignments[0];
      const normalizedPrimaryRole = normalizeAssignmentRole(
        firstAssignment?.roleIds[0] ?? 'dealer'
      );

      const now = serverTimestamp();
      const applicationData: Omit<Application, 'id'> = {
        applicantId: context.applicantId,
        applicantName: context.applicantName,
        ...(context.applicantPhone && { applicantPhone: context.applicantPhone }),
        ...(context.applicantEmail && { applicantEmail: context.applicantEmail }),
        ...(context.applicantNickname && { applicantNickname: context.applicantNickname }),
        ...(context.applicantPhotoURL && { applicantPhotoURL: context.applicantPhotoURL }),
        applicantRole: normalizedPrimaryRole.role,
        ...(normalizedPrimaryRole.customRole && { customRole: normalizedPrimaryRole.customRole }),
        jobPostingId: input.jobPostingId,
        jobPostingTitle: jobData.title || '',
        ...(jobData.workDate && { jobPostingDate: jobData.workDate }),
        status: STATUS.APPLICATION.APPLIED,
        ...(input.message && { message: input.message }),
        recruitmentType,
        assignments: input.assignments,
        ...(input.preQuestionAnswers && { preQuestionAnswers: input.preQuestionAnswers }),
        isRead: false,
        createdAt: existingData?.createdAt ?? (now as Timestamp),
        updatedAt: now as Timestamp,
      };

      transaction.set(applicationRef, applicationData);
      updateJobPostingStatsInTransaction({
        transaction,
        jobRef,
        jobData,
        fromStatus: existingData?.status ?? null,
        toStatus: STATUS.APPLICATION.APPLIED,
        totalApplicantsDelta: existingData ? 0 : 1,
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
      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertApplicationApplicant(applicationData, applicantId, '본인 지원만 취소할 수 있습니다.');

      if (applicationData.status === STATUS.APPLICATION.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_CANCELLED, {
          userMessage: '이미 취소된 지원입니다.',
        });
      }

      if (applicationData.status === STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED, {
          userMessage: '확정된 지원은 직접 취소할 수 없습니다. 취소 요청을 이용해 주세요.',
        });
      }

      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CANCELLED,
        updatedAt: serverTimestamp(),
      });
      updateJobPostingStatsInTransaction({
        transaction,
        jobRef,
        jobData,
        fromStatus: applicationData.status,
        toStatus: STATUS.APPLICATION.CANCELLED,
      });
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
        userMessage: '취소 사유를 5자 이상 입력해 주세요.',
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

      assertApplicationApplicant(
        applicationData,
        applicantId,
        '본인 지원만 취소 요청할 수 있습니다.'
      );

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원만 취소 요청할 수 있습니다.',
        });
      }

      if (applicationData.cancellationRequest?.status === STATUS.CANCELLATION_REQUEST.PENDING) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
          userMessage: '이미 취소 요청이 진행 중입니다.',
        });
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
      updateJobPostingStatsInTransaction({
        transaction,
        jobRef,
        jobData,
        fromStatus: applicationData.status,
        toStatus: STATUS.APPLICATION.CANCELLATION_PENDING,
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
        userMessage: '거절 사유를 3자 이상 입력해 주세요.',
      });
    }

    if (input.approved) {
      const relatedWorkLogIds = await prefetchRelatedWorkLogIds(input.applicationId);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const { applicationRef, applicationData } = await loadApplicationForTransaction(
          transaction,
          input.applicationId
        );
        const { jobRef, jobData } = await loadJobPostingForTransaction(
          transaction,
          applicationData.jobPostingId
        );

        assertJobPostingOwner(jobData, reviewerId, '본인 공고의 취소 요청만 검토할 수 있습니다.');

        if (applicationData.status !== STATUS.APPLICATION.CANCELLATION_PENDING) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '검토 대기 중인 취소 요청이 없습니다.',
          });
        }

        if (
          !applicationData.cancellationRequest ||
          applicationData.cancellationRequest.status !== STATUS.CANCELLATION_REQUEST.PENDING
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '유효한 취소 요청이 없습니다.',
          });
        }

        const approvedCancellationRequest = {
          requestedAt: applicationData.cancellationRequest.requestedAt,
          reason: applicationData.cancellationRequest.reason,
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerId,
          status: STATUS.CANCELLATION_REQUEST.APPROVED,
        };

        await releaseConfirmedAssignmentsInTransaction({
          transaction,
          applicationRef,
          applicationData,
          jobRef,
          jobData,
          relatedWorkLogIds,
          ownerId: reviewerId,
          nextApplicationStatus: STATUS.APPLICATION.CANCELLED,
          cancelReason: applicationData.cancellationRequest.reason,
          cancellationRequest: approvedCancellationRequest,
        });
      });
    } else {
      await runTransaction(getFirebaseDb(), async (transaction) => {
        const { applicationRef, applicationData } = await loadApplicationForTransaction(
          transaction,
          input.applicationId
        );
        const { jobRef, jobData } = await loadJobPostingForTransaction(
          transaction,
          applicationData.jobPostingId
        );

        assertJobPostingOwner(jobData, reviewerId, '본인 공고의 취소 요청만 검토할 수 있습니다.');

        if (applicationData.status !== STATUS.APPLICATION.CANCELLATION_PENDING) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '검토 대기 중인 취소 요청이 없습니다.',
          });
        }

        if (
          !applicationData.cancellationRequest ||
          applicationData.cancellationRequest.status !== STATUS.CANCELLATION_REQUEST.PENDING
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '유효한 취소 요청이 없습니다.',
          });
        }

        const updatedCancellationRequest = {
          requestedAt: applicationData.cancellationRequest.requestedAt,
          reason: applicationData.cancellationRequest.reason,
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerId,
          status: STATUS.CANCELLATION_REQUEST.REJECTED,
          rejectionReason: input.rejectionReason?.trim() || '거절됨',
        };

        transaction.update(applicationRef, {
          status: STATUS.APPLICATION.CONFIRMED as ApplicationStatus,
          cancellationRequest: updatedCancellationRequest,
          updatedAt: serverTimestamp(),
        });
        updateJobPostingStatsInTransaction({
          transaction,
          jobRef,
          jobData,
          fromStatus: applicationData.status,
          toStatus: STATUS.APPLICATION.CONFIRMED,
        });
      });
    }

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
      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, reviewerId, '본인 공고의 지원자만 거절할 수 있습니다.');

      if (applicationData.status !== STATUS.APPLICATION.APPLIED) {
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
      updateJobPostingStatsInTransaction({
        transaction,
        jobRef,
        jobData,
        fromStatus: applicationData.status,
        toStatus: STATUS.APPLICATION.REJECTED,
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
          invalidStateMessage: '데이터가 올바르지 않습니다.',
        }
      );

      assertJobPostingOwner(jobData, ownerId, '본인 공고만 조회할 수 있습니다.');

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
