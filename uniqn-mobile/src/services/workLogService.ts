/**
 * UNIQN Mobile - 근무 기록 서비스
 *
 * @description Firebase Firestore 기반 출퇴근/근무 기록 서비스
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  runTransaction,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import {
  AlreadyCheckedInError,
  NotCheckedInError,
  InvalidQRCodeError,
  ExpiredQRCodeError,
} from '@/errors/BusinessErrors';
import type { WorkLog, PayrollStatus } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
const QR_CODES_COLLECTION = 'qrCodes';
const DEFAULT_PAGE_SIZE = 50;

/** QR 코드 유효 시간 (5분) */
const _QR_VALIDITY_DURATION_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface CheckInResult {
  success: boolean;
  workLogId: string;
  checkInTime: Date;
  message: string;
}

export interface CheckOutResult {
  success: boolean;
  workLogId: string;
  checkOutTime: Date;
  workDuration: number; // 분 단위
  message: string;
}

export interface QRCodeData {
  id: string;
  eventId: string;
  staffId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  action: 'checkIn' | 'checkOut';
  isUsed: boolean;
}

export interface WorkLogStats {
  totalWorkLogs: number;
  completedCount: number;
  totalHoursWorked: number;
  averageHoursPerDay: number;
  pendingPayroll: number;
  completedPayroll: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 변환
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 근무 시간 계산 (분 단위)
 */
function calculateWorkDuration(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

/**
 * QR 코드 유효성 검증
 */
function validateQRCode(qrData: QRCodeData): void {
  const now = Date.now();
  const expiresAt = qrData.expiresAt.toMillis();

  if (now > expiresAt) {
    throw new ExpiredQRCodeError({
      message: 'QR 코드가 만료되었습니다.',
      userMessage: '새로운 QR 코드를 요청해주세요.',
      expiredAt: qrData.expiresAt.toDate(),
    });
  }

  if (qrData.isUsed) {
    throw new InvalidQRCodeError({
      message: '이미 사용된 QR 코드입니다.',
      userMessage: '이미 사용된 QR 코드입니다.',
    });
  }
}

// ============================================================================
// Work Log Service
// ============================================================================

/**
 * 내 근무 기록 목록 조회
 */
export async function getMyWorkLogs(
  staffId: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<WorkLog[]> {
  try {
    logger.info('근무 기록 목록 조회', { staffId });

    const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      orderBy('date', 'desc'),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);
    const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    logger.info('근무 기록 목록 조회 완료', { count: workLogs.length });

    return workLogs;
  } catch (error) {
    logger.error('근무 기록 목록 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
  }
}

/**
 * 특정 날짜의 근무 기록 조회
 *
 * @description orderBy 대신 JS 정렬 사용 (복합 인덱스 불필요)
 */
export async function getWorkLogsByDate(staffId: string, date: string): Promise<WorkLog[]> {
  try {
    logger.info('날짜별 근무 기록 조회', { staffId, date });

    const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('date', '==', date)
    );

    const snapshot = await getDocs(q);
    const workLogs = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    // createdAt 기준 오름차순 정렬 (JS)
    return workLogs.sort((a, b) => {
      const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return aTime - bTime;
    });
  } catch (error) {
    logger.error('날짜별 근무 기록 조회 실패', error as Error, { staffId, date });
    throw mapFirebaseError(error);
  }
}

/**
 * 근무 기록 상세 조회
 */
export async function getWorkLogById(workLogId: string): Promise<WorkLog | null> {
  try {
    logger.info('근무 기록 상세 조회', { workLogId });

    const docRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as WorkLog;
  } catch (error) {
    logger.error('근무 기록 상세 조회 실패', error as Error, { workLogId });
    throw mapFirebaseError(error);
  }
}

/**
 * 출근 체크 (QR 스캔 또는 직접)
 */
export async function checkIn(
  workLogId: string,
  qrCodeId?: string
): Promise<CheckInResult> {
  try {
    logger.info('출근 체크 시작', { workLogId, qrCodeId });

    const result = await runTransaction(db, async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new Error('근무 기록을 찾을 수 없습니다.');
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 2. 이미 출근했는지 확인
      if (workLog.status === 'checked_in' || workLog.status === 'checked_out') {
        throw new AlreadyCheckedInError({
          message: '이미 출근 처리되었습니다.',
          userMessage: '이미 출근 처리가 완료되었습니다.',
          workLogId,
        });
      }

      // 3. QR 코드 검증 (있는 경우)
      if (qrCodeId) {
        const qrRef = doc(db, QR_CODES_COLLECTION, qrCodeId);
        const qrDoc = await transaction.get(qrRef);

        if (!qrDoc.exists()) {
          throw new InvalidQRCodeError({
            message: '유효하지 않은 QR 코드입니다.',
            userMessage: '유효하지 않은 QR 코드입니다. 다시 스캔해주세요.',
            qrData: qrCodeId,
          });
        }

        const qrData = qrDoc.data() as QRCodeData;
        validateQRCode(qrData);

        if (qrData.action !== 'checkIn') {
          throw new InvalidQRCodeError({
            message: '출근용 QR 코드가 아닙니다.',
            userMessage: '출근용 QR 코드가 아닙니다. 올바른 QR 코드를 스캔해주세요.',
          });
        }

        // QR 코드 사용 처리
        transaction.update(qrRef, { isUsed: true });
      }

      // 4. 출근 처리
      const checkInTime = Timestamp.now();
      transaction.update(workLogRef, {
        status: 'checked_in',
        actualStartTime: checkInTime,
        updatedAt: serverTimestamp(),
      });

      return {
        workLogId,
        checkInTime: checkInTime.toDate(),
      };
    });

    logger.info('출근 체크 완료', { workLogId });

    return {
      success: true,
      workLogId: result.workLogId,
      checkInTime: result.checkInTime,
      message: '출근이 완료되었습니다.',
    };
  } catch (error) {
    logger.error('출근 체크 실패', error as Error, { workLogId });

    if (
      error instanceof AlreadyCheckedInError ||
      error instanceof InvalidQRCodeError ||
      error instanceof ExpiredQRCodeError
    ) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 퇴근 체크 (QR 스캔 또는 직접)
 */
export async function checkOut(
  workLogId: string,
  qrCodeId?: string
): Promise<CheckOutResult> {
  try {
    logger.info('퇴근 체크 시작', { workLogId, qrCodeId });

    const result = await runTransaction(db, async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new Error('근무 기록을 찾을 수 없습니다.');
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 2. 출근했는지 확인
      if (workLog.status !== 'checked_in') {
        throw new NotCheckedInError({
          message: '먼저 출근 처리가 필요합니다.',
          userMessage: '출근 처리 후 퇴근할 수 있습니다.',
        });
      }

      // 3. QR 코드 검증 (있는 경우)
      if (qrCodeId) {
        const qrRef = doc(db, QR_CODES_COLLECTION, qrCodeId);
        const qrDoc = await transaction.get(qrRef);

        if (!qrDoc.exists()) {
          throw new InvalidQRCodeError({
            message: '유효하지 않은 QR 코드입니다.',
            userMessage: '유효하지 않은 QR 코드입니다. 다시 스캔해주세요.',
            qrData: qrCodeId,
          });
        }

        const qrData = qrDoc.data() as QRCodeData;
        validateQRCode(qrData);

        if (qrData.action !== 'checkOut') {
          throw new InvalidQRCodeError({
            message: '퇴근용 QR 코드가 아닙니다.',
            userMessage: '퇴근용 QR 코드가 아닙니다. 올바른 QR 코드를 스캔해주세요.',
          });
        }

        // QR 코드 사용 처리
        transaction.update(qrRef, { isUsed: true });
      }

      // 4. 퇴근 처리
      const checkOutTime = Timestamp.now();
      const startTime = workLog.actualStartTime;

      let workDuration = 0;
      if (startTime) {
        const startDate =
          startTime instanceof Timestamp ? startTime.toDate() : new Date(startTime as string);
        workDuration = calculateWorkDuration(startDate, checkOutTime.toDate());
      }

      transaction.update(workLogRef, {
        status: 'checked_out',
        actualEndTime: checkOutTime,
        updatedAt: serverTimestamp(),
      });

      return {
        workLogId,
        checkOutTime: checkOutTime.toDate(),
        workDuration,
      };
    });

    logger.info('퇴근 체크 완료', { workLogId, workDuration: result.workDuration });

    return {
      success: true,
      workLogId: result.workLogId,
      checkOutTime: result.checkOutTime,
      workDuration: result.workDuration,
      message: '퇴근이 완료되었습니다.',
    };
  } catch (error) {
    logger.error('퇴근 체크 실패', error as Error, { workLogId });

    if (
      error instanceof NotCheckedInError ||
      error instanceof InvalidQRCodeError ||
      error instanceof ExpiredQRCodeError
    ) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 오늘 출근한 근무 기록 조회
 */
export async function getTodayCheckedInWorkLog(staffId: string): Promise<WorkLog | null> {
  try {
    const today = formatDateString(new Date());
    const workLogs = await getWorkLogsByDate(staffId, today);

    return workLogs.find((wl) => wl.status === 'checked_in') || null;
  } catch (error) {
    logger.error('오늘 출근 기록 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
  }
}

/**
 * 현재 근무 중인지 확인
 */
export async function isCurrentlyWorking(staffId: string): Promise<boolean> {
  const workLog = await getTodayCheckedInWorkLog(staffId);
  return workLog !== null;
}

/**
 * 근무 기록 통계 조회
 */
export async function getWorkLogStats(staffId: string): Promise<WorkLogStats> {
  try {
    logger.info('근무 기록 통계 조회', { staffId });

    // 최근 3개월 데이터 조회
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('date', '>=', formatDateString(threeMonthsAgo)),
      orderBy('date', 'desc'),
      limit(500)
    );

    const snapshot = await getDocs(q);
    const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    let completedCount = 0;
    let totalHoursWorked = 0;
    let pendingPayroll = 0;
    let completedPayroll = 0;
    const workDays = new Set<string>();

    workLogs.forEach((workLog) => {
      if (workLog.status === 'checked_out' || workLog.status === 'completed') {
        completedCount++;
        workDays.add(workLog.date);

        // 근무 시간 계산
        if (workLog.actualStartTime && workLog.actualEndTime) {
          const start =
            workLog.actualStartTime instanceof Timestamp
              ? workLog.actualStartTime.toDate()
              : new Date(workLog.actualStartTime as string);
          const end =
            workLog.actualEndTime instanceof Timestamp
              ? workLog.actualEndTime.toDate()
              : new Date(workLog.actualEndTime as string);
          totalHoursWorked += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }

        // 정산 금액
        if (workLog.payrollAmount) {
          if (workLog.payrollStatus === 'completed') {
            completedPayroll += workLog.payrollAmount;
          } else {
            pendingPayroll += workLog.payrollAmount;
          }
        }
      }
    });

    const averageHoursPerDay = workDays.size > 0 ? totalHoursWorked / workDays.size : 0;

    return {
      totalWorkLogs: workLogs.length,
      completedCount,
      totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
      averageHoursPerDay: Math.round(averageHoursPerDay * 10) / 10,
      pendingPayroll,
      completedPayroll,
    };
  } catch (error) {
    logger.error('근무 기록 통계 조회 실패', error as Error, { staffId });
    throw mapFirebaseError(error);
  }
}

/**
 * 월별 정산 정보 조회
 */
export async function getMonthlyPayroll(
  staffId: string,
  year: number,
  month: number
): Promise<{
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
  workLogs: WorkLog[];
}> {
  try {
    logger.info('월별 정산 조회', { staffId, year, month });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('date', '>=', formatDateString(startDate)),
      where('date', '<=', formatDateString(endDate)),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    let totalAmount = 0;
    let pendingAmount = 0;
    let completedAmount = 0;

    workLogs.forEach((workLog) => {
      if (workLog.payrollAmount) {
        totalAmount += workLog.payrollAmount;
        if (workLog.payrollStatus === 'completed') {
          completedAmount += workLog.payrollAmount;
        } else {
          pendingAmount += workLog.payrollAmount;
        }
      }
    });

    return {
      totalAmount,
      pendingAmount,
      completedAmount,
      workLogs,
    };
  } catch (error) {
    logger.error('월별 정산 조회 실패', error as Error, { staffId, year, month });
    throw mapFirebaseError(error);
  }
}

/**
 * 관리자: 근무 시간 수정
 */
export async function updateWorkTime(
  workLogId: string,
  updates: {
    actualStartTime?: Date;
    actualEndTime?: Date;
    notes?: string;
  }
): Promise<void> {
  try {
    logger.info('근무 시간 수정', { workLogId, updates });

    const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.actualStartTime) {
      updateData.actualStartTime = Timestamp.fromDate(updates.actualStartTime);
    }

    if (updates.actualEndTime) {
      updateData.actualEndTime = Timestamp.fromDate(updates.actualEndTime);
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    await updateDoc(workLogRef, updateData);

    logger.info('근무 시간 수정 완료', { workLogId });
  } catch (error) {
    logger.error('근무 시간 수정 실패', error as Error, { workLogId });
    throw mapFirebaseError(error);
  }
}

/**
 * 정산 상태 업데이트
 */
export async function updatePayrollStatus(
  workLogId: string,
  status: PayrollStatus,
  amount?: number
): Promise<void> {
  try {
    logger.info('정산 상태 업데이트', { workLogId, status, amount });

    const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
    const updateData: Record<string, unknown> = {
      payrollStatus: status,
      updatedAt: serverTimestamp(),
    };

    if (amount !== undefined) {
      updateData.payrollAmount = amount;
    }

    if (status === 'completed') {
      updateData.payrollDate = serverTimestamp();
    }

    await updateDoc(workLogRef, updateData);

    logger.info('정산 상태 업데이트 완료', { workLogId });
  } catch (error) {
    logger.error('정산 상태 업데이트 실패', error as Error, { workLogId });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * 단일 근무 기록 실시간 구독
 *
 * @description 관리자가 시간을 수정하면 즉시 UI에 반영
 *
 * @example
 * const unsubscribe = subscribeToWorkLog(workLogId, {
 *   onUpdate: (workLog) => setWorkLog(workLog),
 *   onError: (error) => console.error(error),
 * });
 *
 * // 클린업
 * return () => unsubscribe();
 */
export function subscribeToWorkLog(
  workLogId: string,
  callbacks: {
    onUpdate: (workLog: WorkLog | null) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  logger.info('근무 기록 실시간 구독 시작', { workLogId });

  const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);

  const unsubscribe = onSnapshot(
    workLogRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        logger.warn('구독 중인 근무 기록이 존재하지 않음', { workLogId });
        callbacks.onUpdate(null);
        return;
      }

      const workLog: WorkLog = {
        id: docSnap.id,
        ...docSnap.data(),
      } as WorkLog;

      logger.debug('근무 기록 업데이트 수신', {
        workLogId,
        status: workLog.status,
      });

      callbacks.onUpdate(workLog);
    },
    (error) => {
      logger.error('근무 기록 구독 에러', error, { workLogId });
      callbacks.onError?.(mapFirebaseError(error) as Error);
    }
  );

  return unsubscribe;
}

/**
 * 내 근무 기록 목록 실시간 구독
 *
 * @description 스케줄 화면에서 실시간 업데이트 수신
 *
 * @example
 * const unsubscribe = subscribeToMyWorkLogs(staffId, {
 *   dateRange: { start: '2025-01-01', end: '2025-01-31' },
 *   onUpdate: (workLogs) => setWorkLogs(workLogs),
 *   onError: (error) => console.error(error),
 * });
 *
 * // 클린업
 * return () => unsubscribe();
 */
export function subscribeToMyWorkLogs(
  staffId: string,
  options: {
    dateRange?: { start: string; end: string };
    pageSize?: number;
    onUpdate: (workLogs: WorkLog[]) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  const { dateRange, pageSize = DEFAULT_PAGE_SIZE, onUpdate, onError } = options;

  logger.info('근무 기록 목록 실시간 구독 시작', { staffId, dateRange });

  const workLogsRef = collection(db, WORK_LOGS_COLLECTION);

  // 쿼리 생성 - 날짜 범위 유무에 따라 분기
  const q = dateRange
    ? query(
        workLogsRef,
        where('staffId', '==', staffId),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end),
        orderBy('date', 'desc'),
        limit(pageSize)
      )
    : query(
        workLogsRef,
        where('staffId', '==', staffId),
        orderBy('date', 'desc'),
        limit(pageSize)
      );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as WorkLog[];

      logger.debug('근무 기록 목록 업데이트 수신', {
        staffId,
        count: workLogs.length,
      });

      onUpdate(workLogs);
    },
    (error) => {
      logger.error('근무 기록 목록 구독 에러', error, { staffId });
      onError?.(mapFirebaseError(error) as Error);
    }
  );

  return unsubscribe;
}

/**
 * 오늘의 근무 상태 실시간 구독
 *
 * @description 출퇴근 버튼 상태를 실시간으로 업데이트
 */
export function subscribeToTodayWorkStatus(
  staffId: string,
  callbacks: {
    onUpdate: (workLog: WorkLog | null) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  const today = formatDateString(new Date());

  logger.info('오늘 근무 상태 실시간 구독 시작', { staffId, today });

  const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
  const q = query(
    workLogsRef,
    where('staffId', '==', staffId),
    where('date', '==', today),
    where('status', 'in', ['confirmed', 'checked_in']),
    limit(1)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callbacks.onUpdate(null);
        return;
      }

      const docSnap = snapshot.docs[0];
      const workLog: WorkLog = {
        id: docSnap.id,
        ...docSnap.data(),
      } as WorkLog;

      logger.debug('오늘 근무 상태 업데이트', {
        staffId,
        status: workLog.status,
      });

      callbacks.onUpdate(workLog);
    },
    (error) => {
      logger.error('오늘 근무 상태 구독 에러', error, { staffId });
      callbacks.onError?.(mapFirebaseError(error) as Error);
    }
  );

  return unsubscribe;
}
