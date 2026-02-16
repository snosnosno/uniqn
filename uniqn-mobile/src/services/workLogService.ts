/**
 * UNIQN Mobile - 근무 기록 서비스
 *
 * @description Repository 패턴 기반 출퇴근/근무 기록 서비스
 * @version 2.0.0 - Repository 패턴 적용 (Phase 2.1)
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Firebase
 *
 * 책임 분리:
 * - Service: 복잡한 통계 계산, 트랜잭션, 실시간 구독
 * - Repository: 단순 조회 캡슐화
 */

import { type Unsubscribe } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { maskSensitiveId, sanitizeLogData } from '@/utils/security';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { toDateString } from '@/utils/date';
import { trackSettlementComplete } from './analyticsService';
import { RealtimeManager } from '@/shared/realtime';
import { workLogRepository, type WorkLogStats } from '@/repositories';
import type { WorkLog, PayrollStatus } from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Re-export Types
// ============================================================================

export type { WorkLogStats } from '@/repositories';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 50;

// ============================================================================
// Work Log Service
// ============================================================================

/**
 * 내 근무 기록 목록 조회
 *
 * @description Repository를 통해 조회
 */
export async function getMyWorkLogs(
  staffId: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<WorkLog[]> {
  try {
    logger.info('근무 기록 목록 조회', { staffId: maskSensitiveId(staffId) });

    const workLogs = await workLogRepository.getByStaffId(staffId, pageSize);

    logger.info('근무 기록 목록 조회 완료', { count: workLogs.length });

    return workLogs;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '근무 기록 목록 조회',
      component: 'workLogService',
      context: { staffId: maskSensitiveId(staffId) },
    });
  }
}

/**
 * 특정 날짜의 근무 기록 조회
 *
 * @description Repository를 통해 조회
 */
export async function getWorkLogsByDate(staffId: string, date: string): Promise<WorkLog[]> {
  try {
    logger.info('날짜별 근무 기록 조회', { staffId: maskSensitiveId(staffId), date });

    const workLogs = await workLogRepository.getByDate(staffId, date);

    return workLogs;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '날짜별 근무 기록 조회',
      component: 'workLogService',
      context: { staffId: maskSensitiveId(staffId), date },
    });
  }
}

/**
 * 근무 기록 상세 조회
 *
 * @description Repository를 통해 조회
 */
export async function getWorkLogById(workLogId: string): Promise<WorkLog | null> {
  try {
    logger.info('근무 기록 상세 조회', { workLogId });

    return await workLogRepository.getById(workLogId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '근무 기록 상세 조회',
      component: 'workLogService',
      context: { workLogId },
    });
  }
}

// @deprecated checkIn, checkOut 함수는 eventQRService.processEventQRCheckIn으로 대체됨
// QR 스캔 없이 수동 출퇴근은 더 이상 지원하지 않음

/**
 * 오늘 출근한 근무 기록 조회
 */
export async function getTodayCheckedInWorkLog(staffId: string): Promise<WorkLog | null> {
  try {
    const today = toDateString(new Date());
    const workLogs = await getWorkLogsByDate(staffId, today);

    return workLogs.find((wl) => wl.status === STATUS.WORK_LOG.CHECKED_IN) || null;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '오늘 출근 기록 조회',
      component: 'workLogService',
      context: { staffId: maskSensitiveId(staffId) },
    });
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
 *
 * @description Repository를 통해 조회
 */
export async function getWorkLogStats(staffId: string): Promise<WorkLogStats> {
  try {
    logger.info('근무 기록 통계 조회', { staffId: maskSensitiveId(staffId) });

    const stats = await workLogRepository.getStats(staffId);

    return stats;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '근무 기록 통계 조회',
      component: 'workLogService',
      context: { staffId: maskSensitiveId(staffId) },
    });
  }
}

/**
 * 월별 정산 정보 조회
 *
 * @description Repository 패턴 적용 - workLogRepository.getMonthlyPayroll 사용
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

    const summary = await workLogRepository.getMonthlyPayroll(staffId, year, month);

    return {
      totalAmount: summary.totalAmount,
      pendingAmount: summary.pendingAmount,
      completedAmount: summary.completedAmount,
      workLogs: summary.workLogs ?? [],
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '월별 정산 조회',
      component: 'workLogService',
      context: { staffId: maskSensitiveId(staffId), year, month },
    });
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
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }
): Promise<void> {
  try {
    logger.info('근무 시간 수정', { workLogId, updates: sanitizeLogData(updates) });

    await workLogRepository.updateWorkTimeTransaction(workLogId, updates);

    logger.info('근무 시간 수정 완료', { workLogId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '근무 시간 수정',
      component: 'workLogService',
      context: { workLogId },
    });
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

    await workLogRepository.updatePayrollStatusTransaction(workLogId, status, amount);

    logger.info('정산 상태 업데이트 완료', { workLogId });

    // Analytics 이벤트 (정산 완료 시)
    if (status === STATUS.PAYROLL.COMPLETED && amount !== undefined) {
      trackSettlementComplete(amount, 1);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '정산 상태 업데이트',
      component: 'workLogService',
      context: { workLogId },
    });
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
  return RealtimeManager.subscribe(RealtimeManager.Keys.workLog(workLogId), () => {
    logger.info('근무 기록 실시간 구독 시작', { workLogId });

    return workLogRepository.subscribeById(
      workLogId,
      (workLog) => {
        if (!workLog) {
          logger.warn('구독 중인 근무 기록이 존재하지 않거나 파싱 실패', { workLogId });
        } else {
          logger.debug('근무 기록 업데이트 수신', { workLogId, status: workLog.status });
        }
        callbacks.onUpdate(workLog);
      },
      (error) => {
        const appError = handleServiceError(error, {
          operation: '근무 기록 구독',
          component: 'workLogService',
          context: { workLogId },
        });
        callbacks.onError?.(appError as Error);
      }
    );
  });
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
      logger.info('근무 기록 목록 실시간 구독 시작', {
        staffId: maskSensitiveId(staffId),
        dateRange,
      });

      return workLogRepository.subscribeByStaffIdWithFilters(
        staffId,
        { dateRange, pageSize },
        (workLogs) => {
          logger.debug('근무 기록 목록 업데이트 수신', {
            staffId: maskSensitiveId(staffId),
            count: workLogs.length,
          });
          onUpdate(workLogs);
        },
        (error) => {
          const appError = handleServiceError(error, {
            operation: '근무 기록 목록 구독',
            component: 'workLogService',
            context: { staffId: maskSensitiveId(staffId) },
          });
          onError?.(appError as Error);
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
  const today = toDateString(new Date());

  return RealtimeManager.subscribe(RealtimeManager.Keys.todayWorkStatus(staffId, today), () => {
    logger.info('오늘 근무 상태 실시간 구독 시작', { staffId: maskSensitiveId(staffId), today });

    // 'confirmed'는 WorkLogStatus 타입에 미정의지만 Firestore에서 실제 사용되는 전이 상태값
    return workLogRepository.subscribeTodayActive(
      staffId,
      today,
      ['confirmed', STATUS.WORK_LOG.CHECKED_IN],
      (workLog) => {
        if (workLog) {
          logger.debug('오늘 근무 상태 업데이트', {
            staffId: maskSensitiveId(staffId),
            status: workLog.status,
          });
        }
        callbacks.onUpdate(workLog);
      },
      (error) => {
        const appError = handleServiceError(error, {
          operation: '오늘 근무 상태 구독',
          component: 'workLogService',
          context: { staffId: maskSensitiveId(staffId) },
        });
        callbacks.onError?.(appError as Error);
      }
    );
  });
}
