/**
 * UNIQN Mobile - 지원서 이력 관리 서비스
 *
 * @description confirmationHistory 기반 확정/취소 이력 관리
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError, MaxCapacityReachedError, ValidationError, ERROR_CODES } from '@/errors';
import type {
  Application,
  Assignment,
  
  ConfirmationHistoryEntry,
  JobPosting,
} from '@/types';
import { createHistoryEntry, addCancellationToEntry, findActiveConfirmation } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const WORK_LOGS_COLLECTION = 'workLogs';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmWithHistoryResult {
  applicationId: string;
  workLogIds: string[];
  message: string;
  historyEntry: ConfirmationHistoryEntry;
}

export interface CancelConfirmationResult {
  applicationId: string;
  cancelledAt: Timestamp;
  restoredStatus: 'applied' | 'pending';
}

// ============================================================================
// Application History Service
// ============================================================================

/**
 * 지원 확정 (v2.0 - confirmationHistory 지원)
 *
 * 비즈니스 로직:
 * 1. 공고 소유자 확인
 * 2. 정원 확인 (날짜별/역할별)
 * 3. originalApplication 보존 (최초 확정 시)
 * 4. confirmationHistory에 이력 추가
 * 5. Assignment별 WorkLog 생성
 * 6. 공고 filledPositions 업데이트
 */
export async function confirmApplicationWithHistory(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('지원 확정 (v2.0) 시작', { applicationId, ownerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 이미 확정된 경우 (활성 확정 확인)
      if (applicationData.confirmationHistory?.length) {
        const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
        if (activeConfirmation) {
          throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
            userMessage: '이미 확정된 지원입니다',
          });
        }
      }

      // 2. 공고 읽기
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      // 공고 소유자 확인
      if (jobData.ownerId !== ownerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. 확정할 assignments 결정
      const assignmentsToConfirm = selectedAssignments ?? applicationData.assignments ?? [];

      if (assignmentsToConfirm.length === 0) {
        // 레거시 호환: assignments가 없으면 단일 역할/날짜로 처리
        const legacyAssignment: Assignment = {
          role: applicationData.appliedRole,
          timeSlot: jobData.timeSlot,
          dates: [jobData.workDate],
          isGrouped: false,
        };
        assignmentsToConfirm.push(legacyAssignment);
      }

      // 4. 정원 확인
      const currentFilled = jobData.filledPositions ?? 0;
      const totalPositions = jobData.totalPositions ?? 0;
      const assignmentCount = assignmentsToConfirm.reduce(
        (sum, a) => sum + a.dates.length,
        0
      );

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
      const confirmationHistory = [
        ...(applicationData.confirmationHistory ?? []),
        historyEntry,
      ];

      // 7. Assignment별 WorkLog 생성
      const workLogIds: string[] = [];
      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
      const now = serverTimestamp();

      for (const assignment of assignmentsToConfirm) {
        const role = assignment.role ?? assignment.roles?.[0] ?? applicationData.appliedRole;

        for (const date of assignment.dates) {
          const workLogRef = doc(workLogsRef);
          const workLogData = {
            staffId: applicationData.applicantId,
            staffName: applicationData.applicantName,
            eventId: applicationData.jobPostingId,
            eventName: jobData.title,
            role,
            date,
            timeSlot: assignment.timeSlot,
            status: 'scheduled',
            attendanceStatus: 'not_started',
            checkInTime: null,
            checkOutTime: null,
            workDuration: null,
            payrollAmount: null,
            isSettled: false,
            // v2.0 추가 필드 (undefined 방지)
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
        status: 'confirmed',
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
        const roleAssignments = assignmentsToConfirm.filter(
          (a) => a.role === r.role || a.roles?.includes(r.role)
        );
        const addedCount = roleAssignments.reduce((sum, a) => sum + a.dates.length, 0);
        return { ...r, filled: r.filled + addedCount };
      });

      transaction.update(jobRef, {
        filledPositions: increment(assignmentCount),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      });

      return {
        applicationId,
        workLogIds,
        message: `${applicationData.applicantName}님의 지원이 확정되었습니다`,
        historyEntry,
      };
    });

    logger.info('지원 확정 (v2.0) 완료', {
      applicationId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    logger.error('지원 확정 (v2.0) 실패', error as Error, { applicationId });
    throw error instanceof ValidationError || error instanceof MaxCapacityReachedError
      ? error
      : mapFirebaseError(error);
  }
}

/**
 * 확정 취소 (v2.0 - confirmationHistory 지원)
 *
 * 비즈니스 로직:
 * 1. 활성 확정 존재 확인
 * 2. confirmationHistory에 취소 정보 추가
 * 3. 연관 WorkLog 삭제 또는 취소 처리
 * 4. 공고 filledPositions 감소
 * 5. 상태를 원본(applied)으로 복원
 */
export async function cancelConfirmation(
  applicationId: string,
  ownerId: string,
  cancelReason?: string
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 시작', { applicationId, ownerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 확정 상태 확인
      if (applicationData.status !== 'confirmed') {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '확정된 지원만 취소할 수 있습니다',
        });
      }

      // 활성 확정 찾기
      const confirmationHistory = applicationData.confirmationHistory ?? [];
      const activeConfirmation = findActiveConfirmation(confirmationHistory);

      if (!activeConfirmation) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '취소할 확정 이력이 없습니다',
        });
      }

      // 2. 공고 읽기
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      // 공고 소유자 확인
      if (jobData.ownerId !== ownerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. confirmationHistory 업데이트 (취소 정보 추가)
      const updatedHistory = confirmationHistory.map((entry) => {
        if (entry === activeConfirmation) {
          return addCancellationToEntry(entry, cancelReason, ownerId);
        }
        return entry;
      });

      // 4. 감소할 수량 계산
      const cancelledAssignments = activeConfirmation.assignments;
      const decrementCount = cancelledAssignments.reduce(
        (sum, a) => sum + a.dates.length,
        0
      );

      // 5. 공고 filledPositions 감소
      const updatedRoles = jobData.roles.map((r) => {
        const roleAssignments = cancelledAssignments.filter(
          (a) => a.role === r.role || a.roles?.includes(r.role)
        );
        const removedCount = roleAssignments.reduce((sum, a) => sum + a.dates.length, 0);
        return { ...r, filled: Math.max(0, r.filled - removedCount) };
      });

      transaction.update(jobRef, {
        filledPositions: increment(-decrementCount),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      });

      // 6. 지원서 상태 복원 (originalApplication 기반)
      const restoredAssignments = applicationData.originalApplication?.assignments;
      const restoredStatus = 'applied' as const;

      transaction.update(applicationRef, {
        status: restoredStatus,
        assignments: restoredAssignments ?? applicationData.assignments,
        confirmationHistory: updatedHistory,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        applicationId,
        cancelledAt: Timestamp.now(),
        restoredStatus,
      };
    });

    logger.info('확정 취소 완료', { applicationId });

    return result;
  } catch (error) {
    logger.error('확정 취소 실패', error as Error, { applicationId });
    throw error instanceof ValidationError ? error : mapFirebaseError(error);
  }
}

/**
 * 최초 지원 데이터 조회
 *
 * @description originalApplication이 있으면 반환, 없으면 현재 assignments 반환
 */
export function getOriginalApplicationData(application: Application): Assignment[] {
  if (application.originalApplication?.assignments) {
    return application.originalApplication.assignments;
  }

  if (application.assignments) {
    return application.assignments;
  }

  // 레거시 호환
  return [
    {
      role: application.appliedRole,
      timeSlot: '',
      dates: [],
      isGrouped: false,
    },
  ];
}

/**
 * 현재 확정된 선택 조회
 *
 * @description 활성 confirmationHistory에서 assignments 반환
 */
export function getConfirmedSelections(application: Application): Assignment[] {
  if (!application.confirmationHistory?.length) {
    return [];
  }

  const activeConfirmation = findActiveConfirmation(application.confirmationHistory);
  return activeConfirmation?.assignments ?? [];
}

/**
 * 지원서가 v2.0 형식인지 확인
 */
export function isV2Application(application: Application): boolean {
  return (
    Array.isArray(application.assignments) && application.assignments.length > 0
  );
}

/**
 * 확정 이력 요약 조회
 */
export async function getApplicationHistorySummary(
  applicationId: string
): Promise<{
  totalConfirmations: number;
  cancellations: number;
  isCurrentlyConfirmed: boolean;
  lastConfirmedAt?: Timestamp;
  lastCancelledAt?: Timestamp;
} | null> {
  try {
    const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      return null;
    }

    const applicationData = applicationDoc.data() as Application;
    const history = applicationData.confirmationHistory ?? [];

    const activeConfirmation = findActiveConfirmation(history);
    const cancellations = history.filter((e) => e.cancelledAt).length;
    const lastEntry = history[history.length - 1];

    return {
      totalConfirmations: history.length,
      cancellations,
      isCurrentlyConfirmed: activeConfirmation !== null,
      lastConfirmedAt: lastEntry?.confirmedAt,
      lastCancelledAt: history.filter((e) => e.cancelledAt).pop()?.cancelledAt,
    };
  } catch (error) {
    logger.error('확정 이력 요약 조회 실패', error as Error, { applicationId });
    throw mapFirebaseError(error);
  }
}
