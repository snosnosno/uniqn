/**
 * UNIQN Mobile - 이벤트 QR 서비스
 *
 * @description 현장 출퇴근용 QR 코드 생성/검증 서비스
 * @version 1.0.0
 *
 * 흐름:
 * 1. 구인자가 현장에서 QR 코드 생성 (출근/퇴근 모드 선택)
 * 2. 스태프가 QR 스캔
 * 3. 서버에서 검증 후 출퇴근 처리
 *
 * QR 코드 데이터 구조:
 * {
 *   type: 'event',
 *   eventId: string,        // 공고 ID
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
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import {
  InvalidQRCodeError,
  ExpiredQRCodeError,
  AlreadyCheckedInError,
  NotCheckedInError,
} from '@/errors/BusinessErrors';
import { trackCheckIn, trackCheckOut } from './analyticsService';
import { parseTimeSlotToDate } from '@/utils/dateUtils';
import type { WorkLog } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const EVENT_QR_COLLECTION = 'eventQRCodes';
const WORK_LOGS_COLLECTION = 'workLogs';

/** QR 코드 유효 시간 (3분) */
const QR_VALIDITY_DURATION_MS = 3 * 60 * 1000;

/** QR 코드 자동 갱신 주기 (2분) */
export const QR_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export type QRAction = 'checkIn' | 'checkOut';

/**
 * 이벤트 QR 코드 데이터 (Firestore 문서)
 */
export interface EventQRCode {
  id: string;
  /** 공고 ID */
  eventId: string;
  /** 근무 날짜 (YYYY-MM-DD) */
  date: string;
  /** 출근/퇴근 */
  action: QRAction;
  /** 보안 코드 (UUID) */
  securityCode: string;
  /** 생성자 ID (구인자) */
  createdBy: string;
  /** 생성 시간 */
  createdAt: Timestamp;
  /** 만료 시간 */
  expiresAt: Timestamp;
  /** 사용 여부 (일회용 아님, 만료 시간으로 관리) */
  isActive: boolean;
}

/**
 * QR 코드 표시용 데이터 (JSON stringify)
 */
export interface EventQRDisplayData {
  type: 'event';
  eventId: string;
  date: string;
  action: QRAction;
  securityCode: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * QR 생성 입력
 */
export interface GenerateEventQRInput {
  eventId: string;
  date: string;
  action: QRAction;
  createdBy: string;
}

/**
 * QR 스캔 결과
 */
export interface EventQRScanResult {
  success: boolean;
  workLogId: string;
  action: QRAction;
  checkTime: Date;
  message: string;
}

/**
 * QR 검증 결과
 */
export interface EventQRValidationResult {
  isValid: boolean;
  eventId?: string;
  date?: string;
  action?: QRAction;
  errorMessage?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * UUID 생성 (보안 코드용)
 */
function generateSecurityCode(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 날짜 문자열 반환 (YYYY-MM-DD)
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * QR 데이터 파싱
 */
function parseQRData(qrString: string): EventQRDisplayData | null {
  try {
    const data = JSON.parse(qrString);
    if (data.type !== 'event') return null;
    if (!data.eventId || !data.date || !data.action || !data.securityCode) return null;
    return data as EventQRDisplayData;
  } catch {
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

    // 기존 활성 QR 비활성화 (같은 이벤트/날짜/액션)
    await deactivateExistingQRCodes(input.eventId, input.date, input.action);

    // 새 QR 코드 생성
    const qrData: Omit<EventQRCode, 'id'> = {
      eventId: input.eventId,
      date: input.date,
      action: input.action,
      securityCode,
      createdBy: input.createdBy,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      isActive: true,
    };

    const docRef = await addDoc(
      collection(getFirebaseDb(), EVENT_QR_COLLECTION),
      qrData
    );

    // 표시용 데이터
    const displayData: EventQRDisplayData = {
      type: 'event',
      eventId: input.eventId,
      date: input.date,
      action: input.action,
      securityCode,
      createdAt: now,
      expiresAt,
    };

    logger.info('이벤트 QR 생성 완료', { qrId: docRef.id });

    return { qrId: docRef.id, displayData };
  } catch (error) {
    logger.error('이벤트 QR 생성 실패', error as Error, { ...input });
    throw mapFirebaseError(error);
  }
}

/**
 * 기존 활성 QR 코드 비활성화
 */
async function deactivateExistingQRCodes(
  eventId: string,
  date: string,
  action: QRAction
): Promise<void> {
  try {
    const qrRef = collection(getFirebaseDb(), EVENT_QR_COLLECTION);
    const q = query(
      qrRef,
      where('eventId', '==', eventId),
      where('date', '==', date),
      where('action', '==', action),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    await Promise.all(
      snapshot.docs.map((docSnap) =>
        updateDoc(doc(getFirebaseDb(), EVENT_QR_COLLECTION, docSnap.id), {
          isActive: false,
        })
      )
    );
  } catch (error) {
    logger.warn('기존 QR 비활성화 실패', { eventId, date, action, error });
  }
}

/**
 * QR 코드 검증
 *
 * @description 스태프가 스캔한 QR 코드 검증
 */
export async function validateEventQR(
  qrString: string
): Promise<EventQRValidationResult> {
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

    // 3. 서버 측 검증 (보안 코드 확인)
    const qrRef = collection(getFirebaseDb(), EVENT_QR_COLLECTION);
    const q = query(
      qrRef,
      where('eventId', '==', qrData.eventId),
      where('date', '==', qrData.date),
      where('action', '==', qrData.action),
      where('securityCode', '==', qrData.securityCode),
      where('isActive', '==', true),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return {
        isValid: false,
        errorMessage: '유효하지 않거나 만료된 QR 코드입니다.',
      };
    }

    const qrDoc = snapshot.docs[0].data() as EventQRCode;

    // 4. 서버 시간 기준 만료 확인
    if (qrDoc.expiresAt.toMillis() < now) {
      return {
        isValid: false,
        errorMessage: 'QR 코드가 만료되었습니다. 새 QR 코드를 요청하세요.',
      };
    }

    return {
      isValid: true,
      eventId: qrData.eventId,
      date: qrData.date,
      action: qrData.action,
    };
  } catch (error) {
    logger.error('QR 검증 실패', error as Error);
    return {
      isValid: false,
      errorMessage: 'QR 코드 검증 중 오류가 발생했습니다.',
    };
  }
}

/**
 * QR 스캔으로 출퇴근 처리
 *
 * @description 스태프가 QR 스캔 시 출퇴근 처리
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
        userMessage: validation.errorMessage || 'QR 코드가 유효하지 않습니다.',
      });
    }

    const { eventId, date, action } = validation;

    // 2. 해당 스태프의 WorkLog 찾기
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('eventId', '==', eventId),
      where('staffId', '==', staffId),
      where('date', '==', date),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new InvalidQRCodeError({
        message: '해당 근무 기록을 찾을 수 없습니다.',
        userMessage: '이 공고에 확정된 스태프가 아닙니다.',
      });
    }

    const workLogDoc = snapshot.docs[0];
    const workLog = workLogDoc.data() as WorkLog;
    const workLogId = workLogDoc.id;

    // 3. 상태 확인 및 출퇴근 처리
    const checkTime = new Date();

    if (action === 'checkIn') {
      // 출근 처리
      if (workLog.status === 'checked_in' || workLog.status === 'checked_out') {
        throw new AlreadyCheckedInError({
          message: '이미 출근 처리되었습니다.',
          userMessage: '이미 출근 처리가 완료되었습니다.',
          workLogId,
        });
      }

      // 업데이트할 데이터 구성
      const updateData: Record<string, unknown> = {
        status: 'checked_in',
        updatedAt: serverTimestamp(),
      };

      // checkInTime이 없으면 (관리자 수정 안 함) timeSlot에서 파싱해서 저장
      const workLogWithTimeSlot = workLog as WorkLog & { timeSlot?: string; checkInTime?: unknown };
      if (!workLogWithTimeSlot.checkInTime && workLogWithTimeSlot.timeSlot && date) {
        const { startTime } = parseTimeSlotToDate(workLogWithTimeSlot.timeSlot, date);
        if (startTime) {
          updateData.checkInTime = Timestamp.fromDate(startTime);
        }
      }
      // checkInTime이 이미 있으면 (관리자 수정됨) 건드리지 않음 → 출석 체크만

      await updateDoc(doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId), updateData);

      // Analytics
      trackCheckIn(formatDateString(checkTime));

      logger.info('QR 출근 처리 완료', { workLogId, staffId, hasExistingCheckInTime: !!workLogWithTimeSlot.checkInTime });

      return {
        success: true,
        workLogId,
        action: 'checkIn',
        checkTime,
        message: '출근이 완료되었습니다.',
      };
    } else {
      // 퇴근 처리
      if (workLog.status !== 'checked_in') {
        throw new NotCheckedInError({
          message: '먼저 출근 처리가 필요합니다.',
          userMessage: '출근 처리 후 퇴근할 수 있습니다.',
        });
      }

      await updateDoc(doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId), {
        status: 'checked_out',
        checkOutTime: Timestamp.fromDate(checkTime),
        updatedAt: serverTimestamp(),
      });

      // 근무 시간 계산
      const workLogWithCheckIn = workLog as WorkLog & { checkInTime?: unknown };
      let workDuration = 0;
      const checkInSource = workLogWithCheckIn.checkInTime || workLog.actualStartTime;
      if (checkInSource) {
        const startTime =
          checkInSource instanceof Timestamp
            ? checkInSource.toDate()
            : new Date(checkInSource as string);
        workDuration = Math.round((checkTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
      }

      // Analytics
      trackCheckOut(formatDateString(checkTime), workDuration);

      logger.info('QR 퇴근 처리 완료', { workLogId, staffId, workDuration });

      return {
        success: true,
        workLogId,
        action: 'checkOut',
        checkTime,
        message: '퇴근이 완료되었습니다.',
      };
    }
  } catch (error) {
    logger.error('QR 스캔 출퇴근 처리 실패', error as Error, { staffId });

    if (
      error instanceof InvalidQRCodeError ||
      error instanceof ExpiredQRCodeError ||
      error instanceof AlreadyCheckedInError ||
      error instanceof NotCheckedInError
    ) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 현재 활성 QR 코드 조회
 */
export async function getActiveEventQR(
  eventId: string,
  date: string,
  action: QRAction
): Promise<EventQRCode | null> {
  try {
    const qrRef = collection(getFirebaseDb(), EVENT_QR_COLLECTION);
    const q = query(
      qrRef,
      where('eventId', '==', eventId),
      where('date', '==', date),
      where('action', '==', action),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data() as Omit<EventQRCode, 'id'>;

    // 만료 확인
    if (data.expiresAt.toMillis() < Date.now()) {
      // 만료된 QR 비활성화
      await updateDoc(doc(getFirebaseDb(), EVENT_QR_COLLECTION, docSnap.id), {
        isActive: false,
      });
      return null;
    }

    return { id: docSnap.id, ...data };
  } catch (error) {
    logger.error('활성 QR 조회 실패', error as Error, { eventId, date, action });
    return null;
  }
}

/**
 * QR 코드 삭제 (비활성화)
 */
export async function deactivateEventQR(qrId: string): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), EVENT_QR_COLLECTION, qrId), {
      isActive: false,
    });
    logger.info('QR 코드 비활성화 완료', { qrId });
  } catch (error) {
    logger.error('QR 코드 비활성화 실패', error as Error, { qrId });
    throw mapFirebaseError(error);
  }
}

/**
 * 만료된 QR 코드 정리 (백그라운드 작업용)
 */
export async function cleanupExpiredQRCodes(): Promise<number> {
  try {
    const qrRef = collection(getFirebaseDb(), EVENT_QR_COLLECTION);
    const now = Timestamp.now();

    const q = query(
      qrRef,
      where('isActive', '==', true),
      where('expiresAt', '<', now)
    );

    const snapshot = await getDocs(q);
    let count = 0;

    await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        await updateDoc(doc(getFirebaseDb(), EVENT_QR_COLLECTION, docSnap.id), {
          isActive: false,
        });
        count++;
      })
    );

    logger.info('만료 QR 정리 완료', { count });
    return count;
  } catch (error) {
    logger.error('만료 QR 정리 실패', error as Error);
    return 0;
  }
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
