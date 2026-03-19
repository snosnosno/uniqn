/**
 * UNIQN Mobile - Application Repository History Transactions
 *
 * @description confirmationHistory 기반 확정/확정 취소 트랜잭션
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
  increment,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
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
import { createHistoryEntry, addCancellationToEntry, findActiveConfirmation } from '@/types';
import { updateDateSpecificRequirementsFilled } from '@/domains/application';
import { WorkLogCreator } from '@/domains/schedule';
import type { ConfirmWithHistoryResult, CancelConfirmationResult } from '../../interfaces';
import type { Assignment, StaffRole, JobPosting } from '@/types';
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

async function loadJobPostingForTransaction(transaction: Transaction, jobPostingId: string) {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
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

  return { jobRef, jobData };
}

function assertJobPostingOwner(jobData: JobPosting, ownerId: string, userMessage: string) {
  if (jobData.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage,
    });
  }
}

export async function confirmWithHistoryTransaction(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('지원 확정 (v2.0) 트랜잭션 시작', { applicationId, ownerId });

    const extractStartTime = WorkLogCreator.extractStartTime.bind(WorkLogCreator);
    const createTimestampFromDateTime =
      WorkLogCreator.createTimestampFromDateTime.bind(WorkLogCreator);

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );

      const confirmableStatuses: string[] = [
        STATUS.APPLICATION.APPLIED,
        STATUS.APPLICATION.PENDING,
      ];
      if (!confirmableStatuses.includes(applicationData.status)) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '대기 중인 지원만 확정할 수 있습니다',
        });
      }

      if (applicationData.confirmationHistory?.length) {
        const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
        if (activeConfirmation) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 확정된 지원입니다',
          });
        }
      }

      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, ownerId, '본인의 공고만 관리할 수 있습니다');

      const assignmentsToConfirm = selectedAssignments ?? applicationData.assignments ?? [];
      if (assignmentsToConfirm.length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '확정할 일정을 선택해주세요',
        });
      }

      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
      const assignmentCount = assignmentsToConfirm.reduce((sum, assignment) => {
        return sum + assignment.dates.length;
      }, 0);

      if (totalPositions > 0 && currentFilled + assignmentCount > totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다.',
          jobPostingId: applicationData.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentFilled,
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
        const role = assignment.roleIds[0] || 'other';
        const startTime = extractStartTime(assignment.timeSlot);

        for (const date of assignment.dates) {
          const checkInTime = createTimestampFromDateTime(date, startTime);

          const workLogRef = doc(workLogsRef);
          const workLogData = {
            staffId: applicationData.applicantId,
            staffName: applicationData.applicantName,
            jobPostingId: applicationData.jobPostingId,
            jobPostingName: jobData.title,
            ownerId: jobData.ownerId,
            role,
            date,
            timeSlot: assignment.timeSlot,
            isTimeToBeAnnounced: assignment.isTimeToBeAnnounced ?? false,
            tentativeDescription: assignment.tentativeDescription ?? null,
            status: STATUS.WORK_LOG.SCHEDULED,
            attendanceStatus: STATUS.ATTENDANCE.NOT_STARTED,
            checkInTime,
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
        notes: notes ?? null,
        updatedAt: serverTimestamp(),
      });

      const updatedRoles = jobData.roles.map((role) => {
        const roleAssignments = assignmentsToConfirm.filter((assignment) =>
          assignment.roleIds.includes(role.role as StaffRole)
        );
        const addedCount = roleAssignments.reduce(
          (sum, assignment) => sum + assignment.dates.length,
          0
        );
        return { ...role, filled: role.filled + addedCount };
      });

      const updatedDateReqs = updateDateSpecificRequirementsFilled(
        jobData.dateSpecificRequirements,
        assignmentsToConfirm,
        'increment'
      );

      const newFilledPositions = currentFilled + assignmentCount;
      const shouldClose = totalPositions > 0 && newFilledPositions >= totalPositions;
      const newStatus = shouldClose ? STATUS.JOB_POSTING.CLOSED : jobData.status;

      const jobUpdateData: Record<string, unknown> = {
        filledPositions: increment(assignmentCount),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      };

      if (updatedDateReqs) {
        jobUpdateData.dateSpecificRequirements = updatedDateReqs;
      }

      if (shouldClose && jobData.status !== STATUS.JOB_POSTING.CLOSED) {
        jobUpdateData.status = newStatus;
      }

      transaction.update(jobRef, jobUpdateData);

      return {
        applicationId,
        workLogIds,
        message: `${applicationData.applicantName}님의 지원이 확정되었습니다.`,
        historyEntry,
      };
    });

    logger.info('지원 확정 (v2.0) 트랜잭션 완료', {
      applicationId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 확정 (v2.0) 트랜잭션',
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
      logger.warn('WorkLog 사전 조회 실패, WorkLog 취소 처리는 생략합니다', { applicationId });
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { applicationRef, applicationData } = await loadApplicationForTransaction(
        transaction,
        applicationId
      );

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원만 취소할 수 있습니다',
        });
      }

      const confirmationHistory = applicationData.confirmationHistory ?? [];
      const activeConfirmation = findActiveConfirmation(confirmationHistory);

      if (!activeConfirmation) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '취소할 확정 이력이 없습니다',
        });
      }

      const { jobRef, jobData } = await loadJobPostingForTransaction(
        transaction,
        applicationData.jobPostingId
      );

      assertJobPostingOwner(jobData, ownerId, '본인의 공고만 관리할 수 있습니다');

      const activeIndex = confirmationHistory.findIndex((entry) => !entry.cancelledAt);
      const updatedHistory = confirmationHistory.map((entry, index) => {
        if (index === activeIndex) {
          return addCancellationToEntry(entry, cancelReason, ownerId);
        }
        return entry;
      });

      const cancelledAssignments = activeConfirmation.assignments;
      const decrementCount = cancelledAssignments.reduce((sum, assignment) => {
        return sum + assignment.dates.length;
      }, 0);

      const updatedRoles = jobData.roles.map((role) => {
        const roleAssignments = cancelledAssignments.filter((assignment) =>
          assignment.roleIds.includes(role.role as StaffRole)
        );
        const removedCount = roleAssignments.reduce(
          (sum, assignment) => sum + assignment.dates.length,
          0
        );
        return { ...role, filled: Math.max(0, role.filled - removedCount) };
      });

      const updatedDateReqs = updateDateSpecificRequirementsFilled(
        jobData.dateSpecificRequirements,
        cancelledAssignments,
        'decrement'
      );

      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
      const newFilledPositions = Math.max(0, currentFilled - decrementCount);
      const shouldReopen =
        jobData.status === STATUS.JOB_POSTING.CLOSED && newFilledPositions < totalPositions;

      const jobUpdateData: Record<string, unknown> = {
        filledPositions: newFilledPositions,
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      };

      if (updatedDateReqs) {
        jobUpdateData.dateSpecificRequirements = updatedDateReqs;
      }

      if (shouldReopen) {
        jobUpdateData.status = STATUS.JOB_POSTING.ACTIVE;
      }

      const workLogSnapshots: {
        ref: ReturnType<typeof doc>;
        data: Record<string, unknown> | undefined;
        exists: boolean;
      }[] = [];

      for (const workLogId of relatedWorkLogIds) {
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
        const workLogSnap = await transaction.get(workLogRef);
        workLogSnapshots.push({
          ref: workLogRef,
          data: workLogSnap.exists() ? (workLogSnap.data() as Record<string, unknown>) : undefined,
          exists: workLogSnap.exists(),
        });
      }

      transaction.update(jobRef, jobUpdateData);

      const restoredAssignments = applicationData.originalApplication?.assignments;
      const restoredStatus = STATUS.APPLICATION.APPLIED;

      transaction.update(applicationRef, {
        status: restoredStatus,
        assignments: restoredAssignments ?? applicationData.assignments,
        confirmationHistory: updatedHistory,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const snapshot of workLogSnapshots) {
        if (snapshot.exists && snapshot.data?.status === STATUS.WORK_LOG.SCHEDULED) {
          transaction.update(snapshot.ref, {
            status: STATUS.WORK_LOG.CANCELLED,
            updatedAt: serverTimestamp(),
          });
        }
      }

      return {
        applicationId,
        cancelledAt: Timestamp.now(),
        restoredStatus,
      };
    });

    logger.info('확정 취소 트랜잭션 완료', { applicationId });

    return result;
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
