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
  onSnapshot,
  Timestamp,
  serverTimestamp,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { maskSensitiveId, sanitizeLogData } from '@/utils/security';
import { mapFirebaseError, BusinessError, ERROR_CODES } from '@/errors';
import { trackSettlementComplete } from './analyticsService';
import { RealtimeManager } from '@/shared/realtime';
import type { WorkLog, PayrollStatus } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
const DEFAULT_PAGE_SIZE = 50;

// ============================================================================
// Types
// ============================================================================

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
    logger.info('근무 기록 목록 조회', { staffId: maskSensitiveId(staffId) });

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
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
    logger.error('근무 기록 목록 조회 실패', error as Error, { staffId: maskSensitiveId(staffId) });
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
    logger.info('날짜별 근무 기록 조회', { staffId: maskSensitiveId(staffId), date });

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
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
    // Firebase 에러 코드만 로깅 (상세 메시지는 보안상 제외)
    const firebaseCode = (error as { code?: string })?.code || 'unknown';
    logger.error('날짜별 근무 기록 조회 실패', error as Error, {
      staffId: maskSensitiveId(staffId),
      date,
      firebaseErrorCode: firebaseCode,
    });
    throw mapFirebaseError(error);
  }
}

/**
 * 근무 기록 상세 조회
 */
export async function getWorkLogById(workLogId: string): Promise<WorkLog | null> {
  try {
    logger.info('근무 기록 상세 조회', { workLogId });

    const docRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);
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

// @deprecated checkIn, checkOut 함수는 eventQRService.processEventQRCheckIn으로 대체됨
// QR 스캔 없이 수동 출퇴근은 더 이상 지원하지 않음

/**
 * 오늘 출근한 근무 기록 조회
 */
export async function getTodayCheckedInWorkLog(staffId: string): Promise<WorkLog | null> {
  try {
    const today = formatDateString(new Date());
    const workLogs = await getWorkLogsByDate(staffId, today);

    return workLogs.find((wl) => wl.status === 'checked_in') || null;
  } catch (error) {
    logger.error('오늘 출근 기록 조회 실패', error as Error, { staffId: maskSensitiveId(staffId) });
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
    logger.info('근무 기록 통계 조회', { staffId: maskSensitiveId(staffId) });

    // 최근 3개월 데이터 조회
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
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
    logger.error('근무 기록 통계 조회 실패', error as Error, { staffId: maskSensitiveId(staffId) });
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
    logger.info('월별 정산 조회', { staffId: maskSensitiveId(staffId), year, month });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
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
    logger.error('월별 정산 조회 실패', error as Error, { staffId: maskSensitiveId(staffId), year, month });
    throw mapFirebaseError(error);
  }
}

/**
 * 관리자: 근무 시간 수정 (트랜잭션 사용)
 *
 * @description 이미 정산 완료된 기록은 수정 불가
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
    logger.info('근무 시간 수정', { workLogId, updates: sanitizeLogData(updates) });

    const db = getFirebaseDb();

    await runTransaction(db, async (transaction) => {
      const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 이미 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === 'completed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산 완료된 근무 기록은 수정할 수 없습니다',
        });
      }

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

      transaction.update(workLogRef, updateData);
    });

    logger.info('근무 시간 수정 완료', { workLogId });
  } catch (error) {
    logger.error('근무 시간 수정 실패', error as Error, { workLogId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 정산 상태 업데이트 (트랜잭션 사용)
 *
 * @description 중복 정산 방지 및 상태 검증 포함
 */
export async function updatePayrollStatus(
  workLogId: string,
  status: PayrollStatus,
  amount?: number
): Promise<void> {
  try {
    logger.info('정산 상태 업데이트', { workLogId, status, amount });

    const db = getFirebaseDb();

    await runTransaction(db, async (transaction) => {
      const workLogRef = doc(db, WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 중복 정산 방지
      if (status === 'completed' && workLog.payrollStatus === 'completed') {
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

      if (status === 'completed') {
        updateData.payrollDate = serverTimestamp();
      }

      transaction.update(workLogRef, updateData);
    });

    logger.info('정산 상태 업데이트 완료', { workLogId });

    // Analytics 이벤트 (정산 완료 시)
    if (status === 'completed' && amount !== undefined) {
      trackSettlementComplete(amount, 1);
    }
  } catch (error) {
    logger.error('정산 상태 업데이트 실패', error as Error, { workLogId });
    throw error instanceof Error ? error : mapFirebaseError(error);
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
/**
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 */
export function subscribeToWorkLog(
  workLogId: string,
  callbacks: {
    onUpdate: (workLog: WorkLog | null) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  return RealtimeManager.subscribe(
    RealtimeManager.Keys.workLog(workLogId),
    () => {
      logger.info('근무 기록 실시간 구독 시작', { workLogId });

      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);

      return onSnapshot(
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
    }
  );
}

/**
 * 내 근무 기록 목록 실시간 구독
 *
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 * 스케줄 화면에서 실시간 업데이트 수신
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

  return RealtimeManager.subscribe(
    RealtimeManager.Keys.workLogsByRange(staffId, dateRange?.start, dateRange?.end),
    () => {
      logger.info('근무 기록 목록 실시간 구독 시작', { staffId: maskSensitiveId(staffId), dateRange });

      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);

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

      return onSnapshot(
        q,
        (snapshot) => {
          const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as WorkLog[];

          logger.debug('근무 기록 목록 업데이트 수신', {
            staffId: maskSensitiveId(staffId),
            count: workLogs.length,
          });

          onUpdate(workLogs);
        },
        (error) => {
          logger.error('근무 기록 목록 구독 에러', error, { staffId: maskSensitiveId(staffId) });
          onError?.(mapFirebaseError(error) as Error);
        }
      );
    }
  );
}

/**
 * 오늘의 근무 상태 실시간 구독
 *
 * @description Phase 12 - RealtimeManager로 중복 구독 방지
 * 출퇴근 버튼 상태를 실시간으로 업데이트
 */
export function subscribeToTodayWorkStatus(
  staffId: string,
  callbacks: {
    onUpdate: (workLog: WorkLog | null) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  const today = formatDateString(new Date());

  return RealtimeManager.subscribe(
    RealtimeManager.Keys.todayWorkStatus(staffId, today),
    () => {
      logger.info('오늘 근무 상태 실시간 구독 시작', { staffId: maskSensitiveId(staffId), today });

      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
      const q = query(
        workLogsRef,
        where('staffId', '==', staffId),
        where('date', '==', today),
        where('status', 'in', ['confirmed', 'checked_in']),
        limit(1)
      );

      return onSnapshot(
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
            staffId: maskSensitiveId(staffId),
            status: workLog.status,
          });

          callbacks.onUpdate(workLog);
        },
        (error) => {
          logger.error('오늘 근무 상태 구독 에러', error, { staffId: maskSensitiveId(staffId) });
          callbacks.onError?.(mapFirebaseError(error) as Error);
        }
      );
    }
  );
}
