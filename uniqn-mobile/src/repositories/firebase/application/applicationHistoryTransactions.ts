/**
 * UNIQN Mobile - Application Repository History Transactions
 *
 * @description v2.0 confirmationHistory 트랜잭션 (2개 메서드)
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
import type { Assignment, StaffRole } from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';

// ============================================================================
// v2.0 History Transactions
// ============================================================================

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
      // 1. 지원서 읽기
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

      // 지원 상태 검증 (applied/pending만 확정 가능)
      const confirmableStatuses: string[] = [
        STATUS.APPLICATION.APPLIED,
        STATUS.APPLICATION.PENDING,
      ];
      if (!confirmableStatuses.includes(applicationData.status)) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '대기 중인 지원만 확정할 수 있습니다',
        });
      }

      // 이미 확정된 경우 (활성 확정 확인)
      if (applicationData.confirmationHistory?.length) {
        const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
        if (activeConfirmation) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 확정된 지원입니다',
          });
        }
      }

      // 2. 공고 읽기
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

      // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
      const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
      if (postingOwnerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. 확정할 assignments 결정
      const assignmentsToConfirm = selectedAssignments ?? applicationData.assignments ?? [];

      if (assignmentsToConfirm.length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '확정할 일정을 선택해주세요',
        });
      }

      // 4. 정원 확인 (dateSpecificRequirements 기반 계산, 레거시 폴백)
      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
      const assignmentCount = assignmentsToConfirm.reduce((sum, a) => sum + a.dates.length, 0);

      if (totalPositions > 0 && currentFilled + assignmentCount > totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다',
          jobPostingId: applicationData.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentFilled,
        });
      }

      // 5. originalApplication 보존 (최초 확정 시)
      let originalApplication = applicationData.originalApplication;
      if (!originalApplication && applicationData.assignments) {
        originalApplication = {
          assignments: applicationData.assignments,
          appliedAt: (applicationData.createdAt as Timestamp) ?? Timestamp.now(),
        };
      }

      // 6. confirmationHistory 엔트리 생성
      const historyEntry = createHistoryEntry(assignmentsToConfirm, ownerId);
      const confirmationHistory = [...(applicationData.confirmationHistory ?? []), historyEntry];

      // 7. Assignment별 WorkLog 생성
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
            ownerId: postingOwnerId,
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

      // 8. 지원서 업데이트
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

      // 9. 공고 filledPositions 업데이트
      const updatedRoles = jobData.roles.map((r) => {
        const roleAssignments = assignmentsToConfirm.filter((a) =>
          a.roleIds.includes(r.role as StaffRole)
        );
        const addedCount = roleAssignments.reduce((sum, a) => sum + a.dates.length, 0);
        return { ...r, filled: r.filled + addedCount };
      });

      // 10. dateSpecificRequirements filled 업데이트
      const updatedDateReqs = updateDateSpecificRequirementsFilled(
        jobData.dateSpecificRequirements,
        assignmentsToConfirm,
        'increment'
      );

      // 11. 전체 마감 여부 확인 및 상태 변경
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
        message: `${applicationData.applicantName}님의 지원이 확정되었습니다`,
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

    // 트랜잭션 전에 연관 WorkLog ID 수집 (Firestore 트랜잭션 내 쿼리 불가 제약)
    // TOCTOU 잔여 위험: 사전 조회~트랜잭션 사이에 새 WorkLog 생성 시 누락 가능.
    // 현실적으로 "확정 취소 중 동일 지원자의 새 WorkLog 생성"은 극히 드문 경우이며,
    // 트랜잭션 내 transaction.get()으로 각 WorkLog 상태를 재확인하므로 일관성은 보장됨.
    // 근본 해결: Cloud Functions에서 트리거 기반 처리 검토.
    // best-effort: 실패해도 확정 취소 자체는 진행
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
          relatedWorkLogIds = workLogsSnapshot.docs.map((d) => d.id);
        }
      }
    } catch {
      logger.warn('WorkLog 사전 조회 실패, WorkLog 취소 처리 생략', { applicationId });
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 지원서 읽기
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

      // 확정 상태 확인
      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원만 취소할 수 있습니다',
        });
      }

      // 활성 확정 찾기
      const confirmationHistory = applicationData.confirmationHistory ?? [];
      const activeConfirmation = findActiveConfirmation(confirmationHistory);

      if (!activeConfirmation) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '취소할 확정 이력이 없습니다',
        });
      }

      // 2. 공고 읽기
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

      // 공고 소유자 확인: ownerId 또는 createdBy 필드 사용 (하위 호환성)
      const postingOwnerId = jobData.ownerId ?? jobData.createdBy;
      if (postingOwnerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. confirmationHistory 업데이트 (취소 정보 추가)
      const activeIndex = confirmationHistory.findIndex((entry) => !entry.cancelledAt);
      const updatedHistory = confirmationHistory.map((entry, idx) => {
        if (idx === activeIndex) {
          return addCancellationToEntry(entry, cancelReason, ownerId);
        }
        return entry;
      });

      // 4. 감소할 수량 계산
      const cancelledAssignments = activeConfirmation.assignments;
      const decrementCount = cancelledAssignments.reduce((sum, a) => sum + a.dates.length, 0);

      // 5. 공고 filledPositions 감소
      const updatedRoles = jobData.roles.map((r) => {
        const roleAssignments = cancelledAssignments.filter((a) =>
          a.roleIds.includes(r.role as StaffRole)
        );
        const removedCount = roleAssignments.reduce((sum, a) => sum + a.dates.length, 0);
        return { ...r, filled: Math.max(0, r.filled - removedCount) };
      });

      // 6. dateSpecificRequirements filled 감소
      const updatedDateReqs = updateDateSpecificRequirementsFilled(
        jobData.dateSpecificRequirements,
        cancelledAssignments,
        'decrement'
      );

      // 7. 마감 해제 여부 확인 (closed → active 복원)
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

      transaction.update(jobRef, jobUpdateData);

      // 8. 지원서 상태 복원 (originalApplication 기반)
      const restoredAssignments = applicationData.originalApplication?.assignments;
      const restoredStatus = STATUS.APPLICATION.APPLIED;

      transaction.update(applicationRef, {
        status: restoredStatus,
        assignments: restoredAssignments ?? applicationData.assignments,
        confirmationHistory: updatedHistory,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 9. 연관 WorkLog cancelled 처리 (상태 확인 후 scheduled만 취소)
      for (const workLogId of relatedWorkLogIds) {
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
        const workLogSnap = await transaction.get(workLogRef);
        if (workLogSnap.exists()) {
          const wlData = workLogSnap.data();
          if (wlData?.status === STATUS.WORK_LOG.SCHEDULED) {
            transaction.update(workLogRef, {
              status: STATUS.WORK_LOG.CANCELLED,
              updatedAt: serverTimestamp(),
            });
          }
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
