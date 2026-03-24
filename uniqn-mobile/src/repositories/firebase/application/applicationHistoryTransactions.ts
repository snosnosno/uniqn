/**
 * UNIQN Mobile - Application confirmation history transactions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  MaxCapacityReachedError,
  ValidationError,
  PermissionError,
  BusinessError,
  ERROR_CODES,
  isAppError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import { normalizeAssignmentRole } from '@/types/assignment';
import {
  createHistoryEntry,
  findActiveConfirmation,
  validateAssignmentSlotCapacity,
} from '@/domains/application';
import { type Assignment, type JobPosting } from '@/types';
import { WorkLogCreator } from '@/domains/schedule';
import type { ConfirmWithHistoryResult, CancelConfirmationResult } from '../../interfaces';
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

async function loadJobPostingForTransaction(transaction: Transaction, jobPostingId: string) {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
  const jobDoc = await transaction.get(jobRef);

  if (!jobDoc.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
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

function assertJobPostingOwner(jobData: JobPosting, ownerId: string, userMessage: string) {
  if (jobData.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage,
    });
  }
}

function countAssignmentDates(assignments: Assignment[]): number {
  return assignments.reduce((sum, assignment) => sum + assignment.dates.length, 0);
}

export async function confirmWithHistoryTransaction(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('지원 확정 트랜잭션 시작', { applicationId, ownerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );

      const confirmableStatuses: string[] = [STATUS.APPLICATION.APPLIED];
      if (!confirmableStatuses.includes(applicationData.status)) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '대기 중인 지원만 확정할 수 있습니다.',
        });
      }

      if (applicationData.confirmationHistory?.length) {
        const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
        if (activeConfirmation) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 확정된 지원입니다.',
          });
        }
      }

      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, ownerId, '본인의 공고만 관리할 수 있습니다');

      if (jobData.schedule.kind !== 'dated') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '고정공고 확정은 현재 지원하지 않습니다.',
        });
      }

      const assignmentsToConfirm = selectedAssignments ?? applicationData.assignments ?? [];
      if (assignmentsToConfirm.length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '확정할 일정을 선택해주세요',
        });
      }

      const slotCapacity = validateAssignmentSlotCapacity(jobData, assignmentsToConfirm);
      if (!slotCapacity.available) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다.',
          jobPostingId: applicationData.jobPostingId,
        });
      }

      let originalApplication = applicationData.originalApplication;
      if (!originalApplication && applicationData.assignments) {
        originalApplication = {
          assignments: applicationData.assignments,
          appliedAt: (applicationData.createdAt as Timestamp) ?? Timestamp.now(),
        };
      }

      const historyEntry = createHistoryEntry(assignmentsToConfirm, ownerId);
      const confirmationHistory = [...(applicationData.confirmationHistory ?? []), historyEntry];

      const workLogIds: string[] = [];
      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const now = serverTimestamp();

      for (const assignment of assignmentsToConfirm) {
        const normalizedRole = normalizeAssignmentRole(assignment.roleIds[0]);

        for (const date of assignment.dates) {
          const workLogRef = doc(workLogsRef);
          const workLogData = {
            staffId: applicationData.applicantId,
            staffName: applicationData.applicantName,
            jobPostingId: applicationData.jobPostingId,
            jobPostingName: jobData.title,
            ownerId: jobData.ownerId,
            role: normalizedRole.role,
            customRole: normalizedRole.customRole ?? null,
            date,
            timeSlot: assignment.timeSlot,
            isTimeToBeAnnounced: assignment.isTimeToBeAnnounced ?? false,
            tentativeDescription: assignment.tentativeDescription ?? null,
            status: STATUS.WORK_LOG.SCHEDULED,
            checkInTime: null,
            checkOutTime: null,
            workDuration: null,
            payrollAmount: null,
            isSettled: false,
            assignmentGroupId: assignment.groupId ?? null,
            checkMethod: assignment.checkMethod ?? 'individual',
            createdAt: now,
            updatedAt: now,
          };

          transaction.set(workLogRef, workLogData);
          workLogIds.push(workLogRef.id);
        }
      }

      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CONFIRMED,
        assignments: assignmentsToConfirm,
        originalApplication,
        confirmationHistory,
        confirmedAt: serverTimestamp(),
        processedBy: ownerId,
        processedAt: serverTimestamp(),
        ...(notes ? { notes } : {}),
        updatedAt: serverTimestamp(),
      });

      const assignmentCount = countAssignmentDates(assignmentsToConfirm);
      const updatedSchedule =
        jobData.schedule.kind === 'dated'
          ? {
              ...jobData.schedule,
              requirements: jobData.schedule.requirements.map((requirement) => ({
                ...requirement,
                timeSlots: requirement.timeSlots.map((slot) => ({
                  ...slot,
                  roles: slot.roles.map((role) => ({ ...role })),
                })),
              })),
            }
          : jobData.schedule;
      assignmentsToConfirm.forEach((assignment) => {
        const assignmentStartTime = WorkLogCreator.extractStartTime(assignment.timeSlot);
        assignment.dates.forEach((date) => {
          const requirement = updatedSchedule.requirements.find((item) => item.date === date);
          const slot = requirement?.timeSlots.find(
            (item) => WorkLogCreator.extractStartTime(item.startTime ?? '') === assignmentStartTime
          );
          const role = slot?.roles.find((item) => {
            const roleId =
              item.role === 'other' && item.customRole ? item.customRole : (item.role ?? '');
            return roleId === assignment.roleIds[0];
          });
          if (role) {
            role.filled = (role.filled ?? 0) + 1;
          }
        });
      });

      const nextFilledPositions = Math.max(0, jobData.filledPositions + assignmentCount);
      const shouldClose =
        jobData.totalPositions > 0 && nextFilledPositions >= jobData.totalPositions;

      const jobUpdateData: Record<string, unknown> = {
        filledPositions: nextFilledPositions,
        schedule: updatedSchedule,
        updatedAt: serverTimestamp(),
      };

      if (shouldClose && jobData.status !== STATUS.JOB_POSTING.CLOSED) {
        jobUpdateData.status = STATUS.JOB_POSTING.CLOSED;
      }

      transaction.update(jobRef, jobUpdateData);

      return {
        applicationId,
        workLogIds,
        message: `${applicationData.applicantName}님의 지원이 확정되었습니다.`,
        historyEntry,
      };
    });

    logger.info('지원 확정 트랜잭션 완료', {
      applicationId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 확정 트랜잭션',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

export async function cancelConfirmationTransaction(
  applicationId: string,
  ownerId: string,
  cancelReason?: string
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 트랜잭션 시작', { applicationId, ownerId });

    let relatedWorkLogIds: string[] = [];
    try {
      const applicationPreCheck = await getDoc(
        doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId)
      );
      if (applicationPreCheck.exists()) {
        const preData = applicationPreCheck.data();
        if (preData?.applicantId && preData?.jobPostingId) {
          const workLogsSnapshot = await getDocs(
            query(
              collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
              where('staffId', '==', preData.applicantId),
              where('jobPostingId', '==', preData.jobPostingId)
            )
          );
          relatedWorkLogIds = workLogsSnapshot.docs.map((docSnapshot) => docSnapshot.id);
        }
      }
    } catch {
      logger.warn('WorkLog 사전 조회 실패, WorkLog 취소 처리를 생략합니다.', { applicationId });
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원만 취소할 수 있습니다.',
        });
      }

      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, ownerId, '본인의 공고만 관리할 수 있습니다');

      return releaseConfirmedAssignmentsInTransaction({
        transaction,
        applicationRef,
        applicationData,
        jobRef,
        jobData,
        relatedWorkLogIds,
        ownerId,
        nextApplicationStatus: STATUS.APPLICATION.APPLIED,
        cancelReason,
      });
    });

    logger.info('확정 취소 트랜잭션 완료', { applicationId });

    return {
      applicationId,
      cancelledAt: result.cancelledAt,
      restoredStatus: 'applied',
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '확정 취소 트랜잭션',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}
