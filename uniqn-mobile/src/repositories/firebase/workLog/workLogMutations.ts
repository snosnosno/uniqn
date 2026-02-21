/**
 * UNIQN Mobile - WorkLog Repository Mutations
 *
 * @description 근무기록 쓰기/트랜잭션 (4개 메서드)
 */

import { doc, updateDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
import {
  InvalidQRCodeError,
  AlreadyCheckedInError,
  NotCheckedInError,
} from '@/errors/BusinessErrors';
import { parseTimeSlotToDate } from '@/utils/date';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument } from '@/schemas';
import type { PayrollStatus, QRCodeAction } from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';

// ============================================================================
// Write Operations
// ============================================================================

export async function updatePayrollStatus(workLogId: string, status: PayrollStatus): Promise<void> {
  try {
    logger.info('정산 상태 변경', { workLogId, status });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);

    await updateDoc(docRef, {
      payrollStatus: status,
      ...(status === STATUS.PAYROLL.COMPLETED && { payrollDate: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    });

    logger.info('정산 상태 변경 완료', { workLogId, status });
  } catch (error) {
    logger.error('정산 상태 변경 실패', toError(error), {
      workLogId,
      status,
    });
    throw handleServiceError(error, {
      operation: '정산 상태 변경',
      component: 'WorkLogRepository',
      context: { workLogId, status },
    });
  }
}

export async function flagNegativeSettlement(workLogId: string, amount: number): Promise<void> {
  try {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);

    await updateDoc(docRef, {
      _negativeSettlementDetected: true,
      _negativeSettlementAmount: amount,
      _negativeSettlementDetectedAt: serverTimestamp(),
    });

    logger.info('음수 정산 플래그 기록', { workLogId, amount });
  } catch (error) {
    logger.error('음수 정산 플래그 기록 실패', toError(error), {
      workLogId,
      amount,
    });
    throw handleServiceError(error, {
      operation: '음수 정산 플래그 기록',
      component: 'WorkLogRepository',
      context: { workLogId },
    });
  }
}

export async function updateWorkTimeTransaction(
  workLogId: string,
  updates: {
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }
): Promise<void> {
  try {
    const db = getFirebaseDb();

    await runTransaction(db, async (transaction) => {
      const workLogRef = doc(db, COLLECTIONS.WORK_LOGS, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록 데이터가 올바르지 않습니다',
        });
      }

      // 이미 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산 완료된 근무 기록은 수정할 수 없습니다',
        });
      }

      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (updates.checkInTime) {
        updateData.checkInTime = Timestamp.fromDate(updates.checkInTime);
      }

      if (updates.checkOutTime) {
        updateData.checkOutTime = Timestamp.fromDate(updates.checkOutTime);
      }

      if (updates.notes !== undefined) {
        updateData.notes = updates.notes;
      }

      // workDuration 재계산: checkIn/checkOut이 모두 확정된 경우
      const finalCheckIn =
        updates.checkInTime ??
        (workLog.checkInTime instanceof Timestamp
          ? workLog.checkInTime.toDate()
          : workLog.checkInTime
            ? new Date(workLog.checkInTime as string)
            : null);
      const finalCheckOut =
        updates.checkOutTime ??
        (workLog.checkOutTime instanceof Timestamp
          ? workLog.checkOutTime.toDate()
          : workLog.checkOutTime
            ? new Date(workLog.checkOutTime as string)
            : null);

      if (finalCheckIn && finalCheckOut) {
        const inTime =
          finalCheckIn instanceof Date ? finalCheckIn : new Date(finalCheckIn as string);
        const outTime =
          finalCheckOut instanceof Date ? finalCheckOut : new Date(finalCheckOut as string);
        const durationMinutes = Math.round((outTime.getTime() - inTime.getTime()) / (1000 * 60));
        updateData.workDuration = Math.round((durationMinutes / 60) * 100) / 100;
      }

      transaction.update(workLogRef, updateData);
    });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '근무 시간 수정 (Transaction)',
      component: 'WorkLogRepository',
      context: { workLogId },
    });
  }
}

export async function updatePayrollStatusTransaction(
  workLogId: string,
  status: PayrollStatus,
  amount?: number
): Promise<void> {
  try {
    const db = getFirebaseDb();

    await runTransaction(db, async (transaction) => {
      const workLogRef = doc(db, COLLECTIONS.WORK_LOGS, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록 데이터가 올바르지 않습니다',
        });
      }

      // 중복 정산 방지
      if (
        status === STATUS.PAYROLL.COMPLETED &&
        workLog.payrollStatus === STATUS.PAYROLL.COMPLETED
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산 완료된 근무 기록입니다',
        });
      }

      const updateData: Record<string, unknown> = {
        payrollStatus: status,
        updatedAt: serverTimestamp(),
      };

      if (amount !== undefined) {
        updateData.payrollAmount = amount;
      }

      if (status === STATUS.PAYROLL.COMPLETED) {
        updateData.payrollDate = serverTimestamp();
      }

      transaction.update(workLogRef, updateData);
    });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '정산 상태 업데이트 (Transaction)',
      component: 'WorkLogRepository',
      context: { workLogId, status },
    });
  }
}

export async function processQRCheckInOutTransaction(
  workLogId: string,
  staffId: string,
  jobPostingId: string,
  action: QRCodeAction,
  checkTime: Date,
  date: string
): Promise<{
  action: QRCodeAction;
  hasExistingCheckInTime: boolean;
  workDuration: number;
}> {
  try {
    const db = getFirebaseDb();

    return await runTransaction(db, async (transaction) => {
      const workLogRef = doc(db, COLLECTIONS.WORK_LOGS, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new InvalidQRCodeError({
          message: '근무 기록이 존재하지 않습니다',
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new InvalidQRCodeError({
          message: '근무 기록 데이터가 유효하지 않습니다',
          userMessage: '근무 기록을 처리할 수 없습니다',
        });
      }

      // 방어적 검증: staffId 일치 확인
      if (workLog.staffId !== staffId) {
        throw new InvalidQRCodeError({
          message: 'WorkLog staffId 불일치',
          userMessage: '권한이 없는 근무 기록입니다',
        });
      }

      // 방어적 검증: jobPostingId 일치 확인
      if (workLog.jobPostingId !== jobPostingId) {
        throw new InvalidQRCodeError({
          message: 'WorkLog jobPostingId 불일치',
          userMessage: 'QR 코드와 근무 기록이 일치하지 않습니다',
        });
      }

      if (action === 'checkIn') {
        // 출근 처리
        if (
          workLog.status === STATUS.WORK_LOG.CHECKED_IN ||
          workLog.status === STATUS.WORK_LOG.CHECKED_OUT
        ) {
          throw new AlreadyCheckedInError({
            message: '이미 출근 처리되었습니다',
            userMessage: '이미 출근 처리가 완료되었습니다',
            workLogId,
          });
        }

        const updateData: Record<string, unknown> = {
          status: STATUS.WORK_LOG.CHECKED_IN,
          updatedAt: serverTimestamp(),
        };

        // checkInTime이 없으면 timeSlot에서 파싱해서 저장
        if (!workLog.checkInTime && workLog.timeSlot && date) {
          const { startTime } = parseTimeSlotToDate(workLog.timeSlot, date);
          if (startTime) {
            updateData.checkInTime = Timestamp.fromDate(startTime);
          }
        }

        transaction.update(workLogRef, updateData);

        return {
          action: 'checkIn' as const,
          hasExistingCheckInTime: !!workLog.checkInTime,
          workDuration: 0,
        };
      } else {
        // 퇴근 처리
        if (workLog.status !== STATUS.WORK_LOG.CHECKED_IN) {
          throw new NotCheckedInError({
            message: '먼저 출근 처리가 필요합니다',
            userMessage: '출근 처리 후 퇴근할 수 있습니다',
          });
        }

        // 근무 시간 계산 (분 단위 반올림 후 시간 변환, 소수점 2자리)
        let workDuration = 0;
        const checkInSource = workLog.checkInTime;
        if (checkInSource) {
          const startTime =
            checkInSource instanceof Timestamp
              ? checkInSource.toDate()
              : new Date(checkInSource as string);
          const durationMinutes = Math.round(
            (checkTime.getTime() - startTime.getTime()) / (1000 * 60)
          );
          workDuration = Math.round((durationMinutes / 60) * 100) / 100;
        }

        transaction.update(workLogRef, {
          status: STATUS.WORK_LOG.CHECKED_OUT,
          checkOutTime: Timestamp.fromDate(checkTime),
          workDuration,
          updatedAt: serverTimestamp(),
        });

        return {
          action: 'checkOut' as const,
          hasExistingCheckInTime: false,
          workDuration,
        };
      }
    });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: 'QR 체크인/아웃 (Transaction)',
      component: 'WorkLogRepository',
      context: { workLogId, staffId, action },
    });
  }
}
