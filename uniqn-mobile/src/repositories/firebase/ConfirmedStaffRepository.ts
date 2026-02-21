/**
 * UNIQN Mobile - Firebase Confirmed Staff Repository
 *
 * @description Firebase Firestore 기반 Confirmed Staff Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리/트랜잭션 실행
 * 2. 멀티 컬렉션 트랜잭션 (WorkLog + Application + JobPosting)
 * 3. 실시간 구독 관리
 *
 * 개선사항:
 * - 중복 쿼리 패턴 통합
 * - 트랜잭션 로직 캡슐화
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
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument, parseWorkLogDocuments } from '@/schemas';
import type { WorkLog, WorkTimeModification, RoleChangeHistory } from '@/types';
import type { ConfirmedStaffStatus } from '@/types/confirmedStaff';
import type {
  IConfirmedStaffRepository,
  UpdateRoleContext,
  UpdateConfirmedStaffWorkTimeContext,
  DeleteConfirmedStaffContext,
  MarkNoShowContext,
  ConfirmedStaffSubscriptionCallbacks,
} from '../interfaces';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Confirmed Staff Repository
 */
export class FirebaseConfirmedStaffRepository implements IConfirmedStaffRepository {
  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
    try {
      logger.info('공고별 확정 스태프 WorkLog 조회', { jobPostingId });

      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const q = query(
        workLogsRef,
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
        orderBy(FIELDS.WORK_LOG.date, 'asc')
      );
      const snapshot = await getDocs(q);

      const workLogs = parseWorkLogDocuments(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }))
      );

      logger.info('공고별 확정 스태프 조회 완료', {
        jobPostingId,
        count: workLogs.length,
      });

      return workLogs;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '공고별 확정 스태프 조회',
        component: 'ConfirmedStaffRepository',
        context: { jobPostingId },
      });
    }
  }

  async getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜별 확정 스태프 WorkLog 조회', { jobPostingId, date });

      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const q = query(
        workLogsRef,
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
        where(FIELDS.WORK_LOG.date, '==', date)
      );
      const snapshot = await getDocs(q);

      const workLogs = parseWorkLogDocuments(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }))
      );

      return workLogs;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '날짜별 확정 스태프 조회',
        component: 'ConfirmedStaffRepository',
        context: { jobPostingId, date },
      });
    }
  }

  // ==========================================================================
  // Write Operations (Transactions)
  // ==========================================================================

  async updateRoleWithTransaction(context: UpdateRoleContext): Promise<void> {
    try {
      logger.info('스태프 역할 변경 트랜잭션 시작', { workLogId: context.workLogId });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogDoc = await transaction.get(workLogRef);

        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '근무 기록을 찾을 수 없습니다',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
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
          newRole: context.newRole,
          reason: context.reason,
          changedBy: context.changedBy,
          changedAt: Timestamp.now(),
        });

        // 표준 역할 vs 커스텀 역할 처리
        const roleUpdate = context.isStandardRole
          ? { role: context.newRole, customRole: null }
          : { role: 'other', customRole: context.newRole };

        transaction.update(workLogRef, {
          ...roleUpdate,
          roleChangeHistory,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('스태프 역할 변경 완료', { workLogId: context.workLogId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '스태프 역할 변경',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void> {
    try {
      logger.info('근무 시간 수정 트랜잭션 시작', {
        workLogId: context.workLogId,
        checkInTime: context.checkInTime?.toISOString() ?? '미정',
        checkOutTime: context.checkOutTime?.toISOString() ?? '미정',
      });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogDoc = await transaction.get(workLogRef);

        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '근무 기록을 찾을 수 없습니다',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
        if (!workLog) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '근무 기록 데이터가 올바르지 않습니다',
          });
        }

        // 시간 수정 이력 저장
        const modificationHistory: WorkTimeModification[] = workLog.modificationHistory || [];
        const prevCheckIn = workLog.checkInTime ?? null;
        const prevCheckOut = workLog.checkOutTime ?? null;

        modificationHistory.push({
          previousStartTime: prevCheckIn,
          previousEndTime: prevCheckOut,
          newStartTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
          newEndTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
          reason: context.reason,
          modifiedBy: context.modifiedBy,
          modifiedAt: Timestamp.now(),
        });

        // 업데이트 데이터 구성
        const updateData: Record<string, unknown> = {
          checkInTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
          checkOutTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
          scheduledStartTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
          scheduledEndTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
          modificationHistory,
          updatedAt: serverTimestamp(),
        };

        // 시간에 따른 상태 변경
        if (context.checkOutTime) {
          updateData.status = STATUS.WORK_LOG.CHECKED_OUT;
        } else if (!context.checkInTime) {
          updateData.status = STATUS.WORK_LOG.SCHEDULED;
        }

        transaction.update(workLogRef, updateData);
      });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '근무 시간 수정',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async deleteWithTransaction(context: DeleteConfirmedStaffContext): Promise<void> {
    try {
      logger.info('확정 스태프 삭제 트랜잭션 시작', {
        workLogId: context.workLogId,
        jobPostingId: context.jobPostingId,
      });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);
        const jobPostingRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, context.jobPostingId);

        // WorkLog 조회
        const workLogDoc = await transaction.get(workLogRef);
        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '근무 기록을 찾을 수 없습니다',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
        if (!workLog) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '근무 기록 데이터가 올바르지 않습니다',
          });
        }

        // 이미 출퇴근한 경우 삭제 불가
        if (
          workLog.status === STATUS.WORK_LOG.CHECKED_IN ||
          workLog.status === STATUS.WORK_LOG.CHECKED_OUT
        ) {
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

        // Application 조회 (모든 읽기를 쓰기 전에 수행)
        const applicationId = `${context.jobPostingId}_${context.staffId}`;
        const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
        const applicationDoc = await transaction.get(applicationRef);

        // 1. WorkLog 상태를 cancelled로 변경
        transaction.update(workLogRef, {
          status: STATUS.WORK_LOG.CANCELLED,
          cancelledReason: context.reason,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Application이 있으면 상태 복원
        if (applicationDoc.exists()) {
          transaction.update(applicationRef, {
            status: STATUS.APPLICATION.APPLIED,
            updatedAt: serverTimestamp(),
          });
        }

        // 3. JobPosting의 filledPositions 감소
        transaction.update(jobPostingRef, {
          filledPositions: increment(-1),
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('확정 스태프 삭제 완료', {
        workLogId: context.workLogId,
        jobPostingId: context.jobPostingId,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '확정 스태프 삭제',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId, jobPostingId: context.jobPostingId },
      });
    }
  }

  async markAsNoShow(context: MarkNoShowContext): Promise<void> {
    try {
      logger.info('노쇼 처리', { workLogId: context.workLogId });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);

      await updateDoc(workLogRef, {
        status: STATUS.CONFIRMED_STAFF.NO_SHOW,
        noShowReason: context.reason,
        noShowAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      logger.info('노쇼 처리 완료', { workLogId: context.workLogId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '노쇼 처리',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async updateStatus(workLogId: string, status: ConfirmedStaffStatus): Promise<void> {
    try {
      logger.info('스태프 상태 변경', { workLogId, status });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);

      await updateDoc(workLogRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      logger.info('스태프 상태 변경 완료', { workLogId, status });
    } catch (error) {
      throw handleServiceError(error, {
        operation: '스태프 상태 변경',
        component: 'ConfirmedStaffRepository',
        context: { workLogId, status },
      });
    }
  }

  // ==========================================================================
  // Real-time Subscription
  // ==========================================================================

  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): Unsubscribe {
    logger.info('확정 스태프 실시간 구독 시작', { jobPostingId });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
    const q = query(
      workLogsRef,
      where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
      orderBy(FIELDS.WORK_LOG.date, 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const workLogs = parseWorkLogDocuments(
            snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Record<string, unknown>),
            }))
          );

          callbacks.onUpdate(workLogs);
        } catch (error) {
          logger.error('확정 스태프 구독 처리 에러', toError(error), { jobPostingId });
          callbacks.onError?.(toError(error));
        }
      },
      (error) => {
        const appError = handleServiceError(error, {
          operation: '확정 스태프 구독',
          component: 'ConfirmedStaffRepository',
          context: { jobPostingId },
        });
        callbacks.onError?.(appError as Error);
      }
    );

    return unsubscribe;
  }
}
