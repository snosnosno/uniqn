/**
 * UNIQN Mobile - 이벤트 QR 서비스
 *
 * @description 현장 출퇴근용 QR 코드 생성/검증 서비스
 * @version 2.0.0
 *
 * 흐름:
 * 1. 구인자가 현장에서 QR 코드 생성 (출근/퇴근 모드 선택)
 * 2. 스태프가 QR 스캔
 * 3. 서버에서 검증 후 출퇴근 처리
 *
 * QR 코드 데이터 구조:
 * {
 *   type: 'event',
 *   jobPostingId: string,   // 공고 ID (정규화된 필드명)
 *   date: string,           // 근무 날짜 (YYYY-MM-DD)
 *   action: 'checkIn' | 'checkOut',
 *   securityCode: string,   // 보안 코드 (UUID)
 *   createdAt: number,      // 생성 시간 (ms)
 *   expiresAt: number,      // 만료 시간 (ms)
 * }
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { generateUUID } from '@/utils/generateId';
import {
  InvalidQRCodeError,
  AlreadyCheckedInError,
  NotCheckedInError,
} from '@/errors/BusinessErrors';
import { parseWorkLogDocument } from '@/schemas';
import { trackCheckIn, trackCheckOut } from './analyticsService';
import { parseTimeSlotToDate, toISODateString } from '@/utils/dateUtils';
import { eventQRRepository } from '@/repositories';
import type {
  QRCodeAction,
  EventQRCode,
  EventQRDisplayData,
  GenerateEventQRInput,
  EventQRScanResult,
  EventQRValidationResult,
} from '@/types';
import { COLLECTIONS, FIELDS } from '@/constants';

/** QR 코드 유효 시간 (3분) */
const QR_VALIDITY_DURATION_MS = 3 * 60 * 1000;

/** QR 코드 자동 갱신 주기 (2분) */
export const QR_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 보안 코드 생성 (UUID v4)
 */
function generateSecurityCode(): string {
  return generateUUID();
}

/**
 * QR 데이터 파싱
 */
function parseQRData(qrString: string): EventQRDisplayData | null {
  try {
    const data = JSON.parse(qrString);
    if (data.type !== 'event') return null;

    const jobPostingId = data.jobPostingId;
    if (!jobPostingId || !data.date || !data.action || !data.securityCode) return null;

    return {
      ...data,
      jobPostingId,
    } as EventQRDisplayData;
  } catch (error) {
    logger.debug('QR 데이터 JSON 파싱 실패', { qrString: qrString.slice(0, 50), error });
    return null;
  }
}

// ============================================================================
// Event QR Service
// ============================================================================

/**
 * 이벤트 QR 코드 생성
 *
 * @description 구인자가 현장에서 출퇴근용 QR 생성
 * @returns QR 코드 문서 ID 및 표시용 데이터
 */
export async function generateEventQR(
  input: GenerateEventQRInput
): Promise<{ qrId: string; displayData: EventQRDisplayData }> {
  try {
    logger.info('이벤트 QR 생성', { ...input });

    const now = Date.now();
    const expiresAt = now + QR_VALIDITY_DURATION_MS;
    const securityCode = generateSecurityCode();

    // 기존 활성 QR 비활성화 (같은 공고/날짜/액션) - Repository 사용
    await eventQRRepository.deactivateByJobAndDate(input.jobPostingId, input.date, input.action);

    // 새 QR 코드 생성 - Repository 사용
    const qrData: Omit<EventQRCode, 'id'> = {
      jobPostingId: input.jobPostingId,
      date: input.date,
      action: input.action,
      securityCode,
      createdBy: input.createdBy,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      isActive: true,
    };

    const qrId = await eventQRRepository.create(qrData);

    // 표시용 데이터
    const displayData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: input.jobPostingId,
      date: input.date,
      action: input.action,
      securityCode,
      createdAt: now,
      expiresAt,
    };

    logger.info('이벤트 QR 생성 완료', { qrId });

    return { qrId, displayData };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '이벤트 QR 생성',
      component: 'eventQRService',
      context: { ...input },
    });
  }
}

/**
 * QR 코드 검증
 *
 * @description 스태프가 스캔한 QR 코드 검증
 */
export async function validateEventQR(qrString: string): Promise<EventQRValidationResult> {
  try {
    // 1. QR 데이터 파싱
    const qrData = parseQRData(qrString);
    if (!qrData) {
      return {
        isValid: false,
        errorMessage: '유효하지 않은 QR 코드 형식입니다.',
      };
    }

    // 2. 만료 시간 확인 (클라이언트 측 1차 검증)
    const now = Date.now();
    if (now > qrData.expiresAt) {
      return {
        isValid: false,
        errorMessage: 'QR 코드가 만료되었습니다. 새 QR 코드를 요청하세요.',
      };
    }

    // 3. 서버 측 검증 (보안 코드 확인) - Repository 사용
    const qrDoc = await eventQRRepository.validateSecurityCode(
      qrData.jobPostingId,
      qrData.date,
      qrData.action,
      qrData.securityCode
    );

    if (!qrDoc) {
      return {
        isValid: false,
        errorMessage: '유효하지 않거나 만료된 QR 코드입니다.',
      };
    }

    return {
      isValid: true,
      jobPostingId: qrData.jobPostingId,
      date: qrData.date,
      action: qrData.action,
    };
  } catch (error) {
    logger.error('QR 검증 실패', toError(error));
    return {
      isValid: false,
      errorMessage: 'QR 코드 검증 중 오류가 발생했습니다.',
    };
  }
}

/**
 * QR 스캔으로 출퇴근 처리
 *
 * @description 스태프가 QR 스캔 시 출퇴근 처리 (트랜잭션 적용)
 */
export async function processEventQRCheckIn(
  qrString: string,
  staffId: string
): Promise<EventQRScanResult> {
  try {
    logger.info('QR 스캔 출퇴근 처리', { staffId });

    // 1. QR 검증
    const validation = await validateEventQR(qrString);
    if (!validation.isValid) {
      throw new InvalidQRCodeError({
        message: validation.errorMessage || 'QR 검증 실패',
        userMessage: validation.errorMessage || 'QR 코드가 유효하지 않습니다',
      });
    }

    const { jobPostingId, date, action } = validation;

    // 2. 해당 스태프의 WorkLog 찾기 (쿼리는 트랜잭션 외부에서)
    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
    const q = query(
      workLogsRef,
      where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
      where(FIELDS.WORK_LOG.staffId, '==', staffId),
      where(FIELDS.WORK_LOG.date, '==', date),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new InvalidQRCodeError({
        message: '해당 근무 기록을 찾을 수 없습니다',
        userMessage: '이 공고에 확정된 스태프가 아닙니다',
      });
    }

    const workLogId = snapshot.docs[0].id;
    const checkTime = new Date();

    // 3. 트랜잭션으로 상태 확인 및 업데이트 (원자적 처리)
    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 3-1. WorkLog 읽기 (트랜잭션 내)
      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
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

      // 방어적 검증: staffId 일치 확인 (동시성 안전성 강화)
      if (workLog.staffId !== staffId) {
        logger.error('WorkLog staffId 불일치', {
          expected: staffId,
          actual: workLog.staffId,
          workLogId,
        });
        throw new InvalidQRCodeError({
          message: 'WorkLog staffId 불일치',
          userMessage: '권한이 없는 근무 기록입니다',
        });
      }

      // 방어적 검증: jobPostingId 일치 확인
      if (workLog.jobPostingId !== jobPostingId) {
        logger.error('WorkLog jobPostingId 불일치', {
          expected: jobPostingId,
          actual: workLog.jobPostingId,
          workLogId,
        });
        throw new InvalidQRCodeError({
          message: 'WorkLog jobPostingId 불일치',
          userMessage: 'QR 코드와 근무 기록이 일치하지 않습니다',
        });
      }

      // 3-2. 상태 확인 및 출퇴근 처리
      if (action === 'checkIn') {
        // 출근 처리
        if (workLog.status === 'checked_in' || workLog.status === 'checked_out') {
          throw new AlreadyCheckedInError({
            message: '이미 출근 처리되었습니다',
            userMessage: '이미 출근 처리가 완료되었습니다',
            workLogId,
          });
        }

        // 업데이트할 데이터 구성
        const updateData: Record<string, unknown> = {
          status: 'checked_in',
          updatedAt: serverTimestamp(),
        };

        // checkInTime이 없으면 timeSlot에서 파싱해서 저장
        // workLog는 이미 parseWorkLogDocument로 검증됨 (timeSlot은 스키마에 optional로 정의됨)
        if (!workLog.checkInTime && workLog.timeSlot && date) {
          const { startTime } = parseTimeSlotToDate(workLog.timeSlot, date);
          if (startTime) {
            updateData.checkInTime = Timestamp.fromDate(startTime);
          }
        }

        // 3-3. 업데이트 (트랜잭션 내)
        transaction.update(workLogRef, updateData);

        return {
          action: 'checkIn' as const,
          hasExistingCheckInTime: !!workLog.checkInTime,
          workDuration: 0,
        };
      } else {
        // 퇴근 처리
        if (workLog.status !== 'checked_in') {
          throw new NotCheckedInError({
            message: '먼저 출근 처리가 필요합니다',
            userMessage: '출근 처리 후 퇴근할 수 있습니다',
          });
        }

        // 3-3. 업데이트 (트랜잭션 내)
        transaction.update(workLogRef, {
          status: 'checked_out',
          checkOutTime: Timestamp.fromDate(checkTime),
          updatedAt: serverTimestamp(),
        });

        // 근무 시간 계산
        // workLog는 이미 parseWorkLogDocument로 검증됨
        let workDuration = 0;
        const checkInSource = workLog.checkInTime;
        if (checkInSource) {
          const startTime =
            checkInSource instanceof Timestamp
              ? checkInSource.toDate()
              : new Date(checkInSource as string);
          workDuration = Math.round((checkTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
        }

        return {
          action: 'checkOut' as const,
          hasExistingCheckInTime: false,
          workDuration,
        };
      }
    });

    // 4. Analytics (트랜잭션 외부 - 실패해도 출퇴근은 성공)
    if (result.action === 'checkIn') {
      trackCheckIn(toISODateString(checkTime) || '');
      logger.info('QR 출근 처리 완료', {
        workLogId,
        staffId,
        hasExistingCheckInTime: result.hasExistingCheckInTime,
      });
    } else {
      trackCheckOut(toISODateString(checkTime) || '', result.workDuration);
      logger.info('QR 퇴근 처리 완료', { workLogId, staffId, workDuration: result.workDuration });
    }

    return {
      success: true,
      workLogId,
      action: result.action,
      checkTime,
      message: result.action === 'checkIn' ? '출근이 완료되었습니다.' : '퇴근이 완료되었습니다.',
    };
  } catch (error) {
    logger.error('QR 스캔 출퇴근 처리 실패', toError(error), { staffId });

    if (isAppError(error)) {
      throw error;
    }

    throw handleServiceError(error, {
      operation: 'QR 스캔 출퇴근 처리',
      component: 'eventQRService',
      context: { staffId },
    });
  }
}

/**
 * 현재 활성 QR 코드 조회
 */
export async function getActiveEventQR(
  jobPostingId: string,
  date: string,
  action: QRCodeAction
): Promise<EventQRCode | null> {
  // Repository로 위임 (만료 시 자동 비활성화 포함)
  return eventQRRepository.getActiveByJobAndDate(jobPostingId, date, action);
}

/**
 * QR 코드 삭제 (비활성화)
 */
export async function deactivateEventQR(qrId: string): Promise<void> {
  // Repository로 위임
  return eventQRRepository.deactivate(qrId);
}

/**
 * 만료된 QR 코드 정리 (백그라운드 작업용)
 */
export async function cleanupExpiredQRCodes(): Promise<number> {
  // Repository로 위임
  return eventQRRepository.deactivateExpired();
}

/**
 * QR 코드 남은 시간 계산 (초)
 */
export function getQRRemainingSeconds(expiresAt: number): number {
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return remaining;
}

/**
 * QR 표시용 데이터를 JSON 문자열로 변환
 */
export function stringifyQRData(displayData: EventQRDisplayData): string {
  return JSON.stringify(displayData);
}
