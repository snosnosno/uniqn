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
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import type {
  Application,
  Assignment,
  ConfirmationHistoryEntry,
  JobPosting,
  DateSpecificRequirement,
} from '@/types';
import { createHistoryEntry, addCancellationToEntry, findActiveConfirmation } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const WORK_LOGS_COLLECTION = 'workLogs';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Assignment의 timeSlot에서 시작 시간 추출
 * @example "09:00" → "09:00"
 * @example "09:00~18:00" → "09:00"
 * @example "09:00 - 18:00" → "09:00"
 */
function extractStartTime(timeSlot: string): string {
  if (!timeSlot) return '';
  // "~" 또는 " - " 로 분리하여 첫 번째 시간 추출
  const separators = /[-~]/;
  const parts = timeSlot.split(separators);
  return parts[0]?.trim() ?? '';
}

/**
 * dateSpecificRequirements의 filled 값 업데이트
 *
 * @param requirements 현재 dateSpecificRequirements
 * @param assignments 확정/취소할 assignments
 * @param operation 'increment' | 'decrement'
 * @returns 업데이트된 dateSpecificRequirements
 */
export function updateDateSpecificRequirementsFilled(
  requirements: DateSpecificRequirement[] | undefined,
  assignments: Assignment[],
  operation: 'increment' | 'decrement'
): DateSpecificRequirement[] | undefined {
  if (!requirements || requirements.length === 0) {
    return requirements;
  }

  // Deep copy to avoid mutation
  const updatedRequirements = requirements.map((req) => ({
    ...req,
    timeSlots: req.timeSlots.map((ts) => ({
      ...ts,
      roles: ts.roles.map((r) => ({ ...r })),
    })),
  }));

  // 매칭 통계
  let expectedUpdates = 0;
  let successfulUpdates = 0;

  // 각 assignment에 대해 해당하는 slot 찾아서 업데이트
  for (const assignment of assignments) {
    const assignmentStartTime = extractStartTime(assignment.timeSlot);
    // v3.0: roleIds 사용
    const assignmentRole = assignment.roleIds[0];

    if (!assignmentRole) {
      logger.warn('Assignment에 역할 정보 없음', { assignment });
      continue;
    }

    for (const date of assignment.dates) {
      expectedUpdates++;

      // 해당 날짜의 requirement 찾기
      const dateReq = updatedRequirements.find((req) => {
        // date가 string, Timestamp, {seconds: number} 형태일 수 있음
        let reqDateStr: string;
        if (typeof req.date === 'string') {
          reqDateStr = req.date;
        } else if (req.date && 'toDate' in req.date) {
          reqDateStr = (req.date as { toDate: () => Date }).toDate().toISOString().split('T')[0] ?? '';
        } else if (req.date && 'seconds' in req.date) {
          reqDateStr = new Date((req.date as { seconds: number }).seconds * 1000).toISOString().split('T')[0] ?? '';
        } else {
          reqDateStr = '';
        }
        return reqDateStr === date;
      });

      if (!dateReq) {
        logger.warn('dateSpecificRequirements에서 날짜 매칭 실패', {
          targetDate: date,
          availableDates: updatedRequirements.map((r) => r.date),
        });
        continue;
      }

      // 해당 시간대의 timeSlot 찾기
      const timeSlot = dateReq.timeSlots.find((ts) => {
        const slotStartTime = ts.startTime ?? (ts as { time?: string }).time ?? '';
        return slotStartTime === assignmentStartTime;
      });

      if (!timeSlot) {
        logger.warn('dateSpecificRequirements에서 시간대 매칭 실패', {
          targetTime: assignmentStartTime,
          availableTimes: dateReq.timeSlots.map((ts) => ts.startTime ?? (ts as { time?: string }).time),
        });
        continue;
      }

      // 해당 역할 찾기
      const roleReq = timeSlot.roles.find((r) => {
        const roleName = r.role ?? (r as { name?: string }).name;
        return roleName === assignmentRole;
      });

      if (!roleReq) {
        logger.warn('dateSpecificRequirements에서 역할 매칭 실패', {
          targetRole: assignmentRole,
          availableRoles: timeSlot.roles.map((r) => r.role ?? (r as { name?: string }).name),
        });
        continue;
      }

      // filled 값 업데이트
      const currentFilled = roleReq.filled ?? (roleReq as { filled?: number }).filled ?? 0;
      if (operation === 'increment') {
        roleReq.filled = currentFilled + 1;
      } else {
        roleReq.filled = Math.max(0, currentFilled - 1);
      }
      successfulUpdates++;
    }
  }

  // 매칭 결과 로깅
  if (expectedUpdates > 0 && successfulUpdates < expectedUpdates) {
    logger.warn('dateSpecificRequirements filled 업데이트 일부 실패', {
      operation,
      expectedUpdates,
      successfulUpdates,
      failedUpdates: expectedUpdates - successfulUpdates,
    });
  }

  return updatedRequirements;
}

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
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '확정할 일정을 선택해주세요',
        });
      }

      // 4. 정원 확인 (dateSpecificRequirements 기반 계산, 레거시 폴백)
      const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
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
        // v3.0: roleIds 사용
        const role = assignment.roleIds[0] ?? applicationData.appliedRole;

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
            // 미정 시간 정보
            isTimeToBeAnnounced: assignment.isTimeToBeAnnounced ?? false,
            tentativeDescription: assignment.tentativeDescription ?? null,
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
        // v3.0: roleIds 사용
        const roleAssignments = assignmentsToConfirm.filter(
          (a) => a.roleIds.includes(r.role)
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
      const newStatus = shouldClose ? 'closed' : jobData.status;

      const jobUpdateData: Record<string, unknown> = {
        filledPositions: increment(assignmentCount),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      };

      // dateSpecificRequirements가 있을 때만 업데이트
      if (updatedDateReqs) {
        jobUpdateData.dateSpecificRequirements = updatedDateReqs;
      }

      // 상태가 변경될 때만 status 업데이트
      if (shouldClose && jobData.status !== 'closed') {
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
        // v3.0: roleIds 사용
        const roleAssignments = cancelledAssignments.filter(
          (a) => a.roleIds.includes(r.role)
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
      const shouldReopen = jobData.status === 'closed' && newFilledPositions < totalPositions;

      const jobUpdateData: Record<string, unknown> = {
        filledPositions: increment(-decrementCount),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      };

      // dateSpecificRequirements가 있을 때만 업데이트
      if (updatedDateReqs) {
        jobUpdateData.dateSpecificRequirements = updatedDateReqs;
      }

      // 마감 상태에서 인원이 줄어들면 active로 복원
      if (shouldReopen) {
        jobUpdateData.status = 'active';
      }

      transaction.update(jobRef, jobUpdateData);

      // 8. 지원서 상태 복원 (originalApplication 기반)
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

  // assignments가 없으면 빈 배열 반환
  return [];
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
