/**
 * UNIQN Mobile - 확정 스태프 관리 서비스
 *
 * @description 구인자용 확정 스태프 조회/관리 서비스
 * @version 1.0.0
 *
 * 기능:
 * - 확정 스태프 목록 조회 (workLogs 기반)
 * - 역할 변경
 * - 근무 시간 수정 (시간 수정 이력 저장)
 * - 스태프 삭제/취소
 * - 노쇼 처리
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  runTransaction,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument, parseWorkLogDocuments } from '@/schemas';
import {
  workLogToConfirmedStaff,
  groupStaffByDate,
  calculateStaffStats,
  type ConfirmedStaff,
  type ConfirmedStaffGroup,
  type ConfirmedStaffStats,
  type UpdateStaffRoleInput,
  type UpdateWorkTimeInput,
  type DeleteConfirmedStaffInput,
  type ConfirmedStaffStatus,
} from '@/types/confirmedStaff';
import type { WorkTimeModification, RoleChangeHistory } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { StatusMapper } from '@/shared/status';
import { userRepository } from '@/repositories';
import { TimeNormalizer } from '@/shared/time';

// 표준 역할 키 목록 (other 제외)
const STANDARD_ROLE_KEYS: string[] = STAFF_ROLES.filter((r) => r.key !== 'other').map((r) => r.key);

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const APPLICATIONS_COLLECTION = 'applications';

// ============================================================================
// Types
// ============================================================================

export interface GetConfirmedStaffResult {
  staff: ConfirmedStaff[];
  grouped: ConfirmedStaffGroup[];
  stats: ConfirmedStaffStats;
}

export interface RoleChangeHistoryEntry {
  previousRole: string;
  newRole: string;
  reason: string;
  changedBy: string;
  changedAt: Timestamp;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 사용자 이름 조회
 *
 * @description Repository 패턴 적용 - userRepository.getById 사용
 */
async function getStaffName(staffId: string): Promise<string> {
  try {
    const user = await userRepository.getById(staffId);
    if (user) {
      return user.nickname || user.name || `스태프 ${staffId.slice(-4)}`;
    }
    return `스태프 ${staffId.slice(-4)}`;
  } catch (error) {
    logger.warn('스태프 이름 조회 실패', { staffId, error });
    return `스태프 ${staffId.slice(-4)}`;
  }
}

/**
 * WorkLog 상태를 ConfirmedStaffStatus로 변환
 *
 * @description Phase 1 - StatusMapper로 위임
 * @note no_show는 WorkLogStatus에 없으므로 별도 처리
 */
function mapWorkLogStatus(status: string): ConfirmedStaffStatus {
  // no_show는 WorkLogStatus에 없으므로 직접 처리
  if (status === 'no_show') {
    return 'no_show';
  }
  // confirmed는 레거시 상태, scheduled로 정규화
  if (status === 'confirmed') {
    return 'scheduled';
  }
  // 나머지는 StatusMapper로 위임
  return StatusMapper.toConfirmedStaff(status as import('@/shared/status').WorkLogStatus);
}

// ============================================================================
// Confirmed Staff Service
// ============================================================================

/**
 * 공고별 확정 스태프 목록 조회
 *
 * @description workLogs 컬렉션에서 jobPostingId로 필터링하여 조회
 * @param jobPostingId 공고 ID
 * @returns 확정 스태프 목록, 날짜별 그룹, 통계
 */
export async function getConfirmedStaff(
  jobPostingId: string
): Promise<GetConfirmedStaffResult> {
  try {
    logger.info('확정 스태프 목록 조회', { jobPostingId });

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('jobPostingId', '==', jobPostingId),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    const workLogs = parseWorkLogDocuments(
      snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    );

    // 스태프 이름 조회 (병렬)
    const staffIds = [...new Set(workLogs.map((wl) => wl.staffId))];
    const nameMap = new Map<string, string>();

    await Promise.all(
      staffIds.map(async (staffId) => {
        const name = await getStaffName(staffId);
        nameMap.set(staffId, name);
      })
    );

    // WorkLog를 ConfirmedStaff로 변환
    const staff: ConfirmedStaff[] = workLogs.map((workLog) => {
      const confirmedStaff = workLogToConfirmedStaff(
        workLog,
        nameMap.get(workLog.staffId)
      );
      // 상태 정규화
      confirmedStaff.status = mapWorkLogStatus(workLog.status);
      return confirmedStaff;
    });

    // 날짜별 그룹화
    const grouped = groupStaffByDate(staff);

    // 통계 계산
    const stats = calculateStaffStats(staff);

    logger.info('확정 스태프 목록 조회 완료', {
      jobPostingId,
      staffCount: staff.length,
      dateCount: grouped.length,
    });

    return { staff, grouped, stats };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '확정 스태프 목록 조회',
      component: 'confirmedStaffService',
      context: { jobPostingId },
    });
  }
}

/**
 * 날짜별 확정 스태프 조회
 */
export async function getConfirmedStaffByDate(
  jobPostingId: string,
  date: string
): Promise<ConfirmedStaff[]> {
  try {
    logger.info('날짜별 확정 스태프 조회', { jobPostingId, date });

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('jobPostingId', '==', jobPostingId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    const workLogs = parseWorkLogDocuments(
      snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    );

    // 스태프 이름 조회
    const staffIds = [...new Set(workLogs.map((wl) => wl.staffId))];
    const nameMap = new Map<string, string>();

    await Promise.all(
      staffIds.map(async (staffId) => {
        const name = await getStaffName(staffId);
        nameMap.set(staffId, name);
      })
    );

    // 변환
    const staff: ConfirmedStaff[] = workLogs.map((workLog) => {
      const confirmedStaff = workLogToConfirmedStaff(
        workLog,
        nameMap.get(workLog.staffId)
      );
      confirmedStaff.status = mapWorkLogStatus(workLog.status);
      return confirmedStaff;
    });

    return staff;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '날짜별 확정 스태프 조회',
      component: 'confirmedStaffService',
      context: { jobPostingId, date },
    });
  }
}

/**
 * 역할 변경
 *
 * @description 스태프의 역할 변경 및 이력 저장
 */
export async function updateStaffRole(input: UpdateStaffRoleInput): Promise<void> {
  try {
    logger.info('스태프 역할 변경', { ...input });

    const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록 데이터가 올바르지 않습니다',
        });
      }
      const previousRole = workLog.role;

      // 역할 변경 이력 저장
      const roleChangeHistory: RoleChangeHistory[] = workLog.roleChangeHistory || [];
      roleChangeHistory.push({
        previousRole,
        newRole: input.newRole,
        reason: input.reason,
        changedBy: input.changedBy ?? 'system',
        changedAt: Timestamp.now(),
      });

      // 커스텀 역할 처리: 표준 역할이 아니면 role: 'other', customRole: newRole
      const isStandardRole = STANDARD_ROLE_KEYS.includes(input.newRole);
      const roleUpdate = isStandardRole
        ? { role: input.newRole, customRole: null }
        : { role: 'other', customRole: input.newRole };

      transaction.update(workLogRef, {
        ...roleUpdate,
        roleChangeHistory,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('스태프 역할 변경 완료', { workLogId: input.workLogId });
  } catch (error) {
    if (error instanceof BusinessError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '스태프 역할 변경',
      component: 'confirmedStaffService',
      context: { workLogId: input.workLogId },
    });
  }
}

/**
 * 근무 시간 수정
 *
 * @description 출퇴근 시간 수정 및 이력 저장 (checkInTime/checkOutTime 사용)
 * @note null은 '미정' 상태를 의미
 */
export async function updateWorkTime(input: UpdateWorkTimeInput): Promise<void> {
  try {
    // TimeInput을 Date로 변환
    const checkInDate = TimeNormalizer.parseTime(input.checkInTime);
    const checkOutDate = TimeNormalizer.parseTime(input.checkOutTime);

    logger.info('근무 시간 수정', {
      workLogId: input.workLogId,
      checkInTime: checkInDate?.toISOString() ?? '미정',
      checkOutTime: checkOutDate?.toISOString() ?? '미정',
    });

    const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록 데이터가 올바르지 않습니다',
        });
      }

      // 시간 수정 이력 저장
      const modificationHistory: WorkTimeModification[] =
        workLog.modificationHistory || [];

      // 이전 시간
      const prevCheckIn = workLog.checkInTime ?? null;
      const prevCheckOut = workLog.checkOutTime ?? null;

      modificationHistory.push({
        previousStartTime: prevCheckIn,
        previousEndTime: prevCheckOut,
        newStartTime: checkInDate ? Timestamp.fromDate(checkInDate) : null,
        newEndTime: checkOutDate ? Timestamp.fromDate(checkOutDate) : null,
        reason: input.reason,
        modifiedBy: input.modifiedBy ?? 'system',
        modifiedAt: Timestamp.now(),
      });

      // 업데이트 데이터 구성 (null은 삭제 대신 null로 저장)
      // 예정 시간도 동기화하여 모든 화면에서 일관된 시간 표시
      const updateData: Record<string, unknown> = {
        checkInTime: checkInDate ? Timestamp.fromDate(checkInDate) : null,
        checkOutTime: checkOutDate ? Timestamp.fromDate(checkOutDate) : null,
        scheduledStartTime: checkInDate ? Timestamp.fromDate(checkInDate) : null,
        scheduledEndTime: checkOutDate ? Timestamp.fromDate(checkOutDate) : null,
        modificationHistory,
        updatedAt: serverTimestamp(),
      };

      // 시간에 따른 상태 변경
      // - 퇴근 시간 있음 → checked_out
      // - 출근 시간만 있음 → 기존 상태 유지
      // - 둘 다 미정 → scheduled (예정 상태로 복원)
      if (checkOutDate) {
        updateData.status = 'checked_out';
      } else if (!checkInDate) {
        // 출퇴근 모두 미정인 경우 예정 상태로 복원
        updateData.status = 'scheduled';
      }
      // 출근 시간만 있는 경우: 기존 상태 유지 (status 필드 업데이트 안함)

      transaction.update(workLogRef, updateData);
    });

    logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
  } catch (error) {
    if (error instanceof BusinessError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '근무 시간 수정',
      component: 'confirmedStaffService',
      context: { workLogId: input.workLogId },
    });
  }
}

/**
 * 확정 스태프 삭제 (취소)
 *
 * @description 스태프 확정 취소 및 관련 데이터 정리
 * - WorkLog 삭제 또는 cancelled 상태로 변경
 * - Application 상태 복원
 * - JobPosting filledPositions 감소
 */
export async function deleteConfirmedStaff(
  input: DeleteConfirmedStaffInput
): Promise<void> {
  try {
    logger.info('확정 스태프 삭제', { ...input });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
      const jobPostingRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, input.jobPostingId);

      // WorkLog 조회
      const workLogDoc = await transaction.get(workLogRef);
      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록 데이터가 올바르지 않습니다',
        });
      }

      // 이미 출퇴근한 경우 삭제 불가
      if (workLog.status === 'checked_in' || workLog.status === 'checked_out') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 출퇴근한 스태프는 삭제할 수 없습니다',
        });
      }

      // JobPosting 조회
      const jobPostingDoc = await transaction.get(jobPostingRef);
      if (!jobPostingDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      }

      // 1. WorkLog 상태를 cancelled로 변경 (완전 삭제 대신)
      transaction.update(workLogRef, {
        status: 'cancelled',
        cancelledReason: input.reason,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Application이 있으면 상태 복원
      // Application ID 형식: `${jobPostingId}_${applicantId}`
      const applicationId = `${input.jobPostingId}_${input.staffId}`;
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (applicationDoc.exists()) {
        transaction.update(applicationRef, {
          status: 'applied',
          updatedAt: serverTimestamp(),
        });
      }

      // 3. JobPosting의 filledPositions 감소
      transaction.update(jobPostingRef, {
        filledPositions: increment(-1),
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('확정 스태프 삭제 완료', { ...input });
  } catch (error) {
    if (error instanceof BusinessError) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '확정 스태프 삭제',
      component: 'confirmedStaffService',
      context: { workLogId: input.workLogId, jobPostingId: input.jobPostingId },
    });
  }
}

/**
 * 노쇼 처리
 *
 * @description 스태프 노쇼 상태로 변경
 */
export async function markAsNoShow(
  workLogId: string,
  reason?: string
): Promise<void> {
  try {
    logger.info('노쇼 처리', { workLogId, reason });

    const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);

    await updateDoc(workLogRef, {
      status: 'no_show',
      noShowReason: reason,
      noShowAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('노쇼 처리 완료', { workLogId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '노쇼 처리',
      component: 'confirmedStaffService',
      context: { workLogId },
    });
  }
}

/**
 * 스태프 상태 변경
 *
 * @description 일반적인 상태 변경 (예: 근무 완료 처리)
 */
export async function updateStaffStatus(
  workLogId: string,
  status: ConfirmedStaffStatus
): Promise<void> {
  try {
    logger.info('스태프 상태 변경', { workLogId, status });

    const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);

    await updateDoc(workLogRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    logger.info('스태프 상태 변경 완료', { workLogId, status });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '스태프 상태 변경',
      component: 'confirmedStaffService',
      context: { workLogId, status },
    });
  }
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * 확정 스태프 목록 실시간 구독
 *
 * @description 새 데이터는 jobPostingId로 조회, 기존 데이터는 마이그레이션 필요
 */
export function subscribeToConfirmedStaff(
  jobPostingId: string,
  callbacks: {
    onUpdate: (result: GetConfirmedStaffResult) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  logger.info('확정 스태프 실시간 구독 시작', { jobPostingId });

  const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
  // NOTE: 새 데이터는 jobPostingId와 eventId 둘 다 저장됨
  // 기존 eventId만 있는 데이터는 마이그레이션 필요
  const q = query(
    workLogsRef,
    where('jobPostingId', '==', jobPostingId),
    orderBy('date', 'asc')
  );

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      try {
        const workLogs = parseWorkLogDocuments(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );

        // 스태프 이름 조회
        const staffIds = [...new Set(workLogs.map((wl) => wl.staffId))];
        const nameMap = new Map<string, string>();

        await Promise.all(
          staffIds.map(async (staffId) => {
            const name = await getStaffName(staffId);
            nameMap.set(staffId, name);
          })
        );

        // 변환
        const staff: ConfirmedStaff[] = workLogs.map((workLog) => {
          const confirmedStaff = workLogToConfirmedStaff(
            workLog,
            nameMap.get(workLog.staffId)
          );
          confirmedStaff.status = mapWorkLogStatus(workLog.status);
          return confirmedStaff;
        });

        const grouped = groupStaffByDate(staff);
        const stats = calculateStaffStats(staff);

        callbacks.onUpdate({ staff, grouped, stats });
      } catch (error) {
        logger.error('확정 스태프 구독 처리 에러', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    },
    (error) => {
      const appError = handleServiceError(error, {
        operation: '확정 스태프 구독',
        component: 'confirmedStaffService',
        context: { jobPostingId },
      });
      callbacks.onError?.(appError as Error);
    }
  );

  return unsubscribe;
}
