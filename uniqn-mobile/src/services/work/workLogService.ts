/**
 * UNIQN Mobile - 근무 기록 서비스
 *
 * @description Repository 패턴 기반 출퇴근/근무 기록 서비스
 * @version 2.0.0 - Repository 패턴 적용 (Phase 2.1)
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Supabase
 *
 * 책임 분리:
 * - Service: 복잡한 통계 계산, 트랜잭션, 실시간 구독
 * - Repository: 단순 조회 캡슐화
 */

import type { UnsubscribeFn } from '@/types/common';
import { logger } from '@/utils/logger';
import { maskSensitiveId } from '@/utils/security';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { toDateString } from '@/utils/date';
import { RealtimeManager } from '@/shared/realtime';
import { workLogRepository, type WorkLogStats } from '@/repositories';
import type { WorkLog } from '@/types';
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

// 🪦 updatePayrollStatus 제거 (2026-08-05) — payroll 직접 UPDATE 경로의 서비스 진입점이었다.
//    #402 가 정산을 RPC 화한 뒤 UI 소비자 0곳(죽은 회로)이었고, 같은 PR 의 20260805120000
//    트리거가 서버에서 이 경로를 막는다. 살아있는 정본은 settlementMutation.updateSettlementStatus.
//    🔴 범위 밖 발견 — 여기 있던 trackSettlementComplete(정산 완료 애널리틱스)의
//       **유일한 호출부가 이 함수였다**(실측: 정의·배럴 재export 외 호출 0곳).
//       그런데 이 함수 자체에 UI 소비자가 없었으므로 그 이벤트는 이미 발화하지 않고 있었다
//       = 정산 완료 애널리틱스는 #402(정산 RPC 화) 이후 조용히 끊긴 상태다.
//       이 삭제가 계측을 없앤 게 아니라, 이미 없던 것을 드러낸 것이다.
//    ✅ 복구 완료 (2026-08-07, 감사 S-D) — 다만 **위 묘비가 지목한 곳은 틀렸었다.**
//       "settlementMutation.updateSettlementStatus 에 붙여라"고 적었으나, 그 경로의 서버 함수
//       set_work_log_payroll_status 는 `p_status='completed'` 진입을 INVALID_STATUS 로 막는다
//       (20260802161000:298 — 확정은 settle_work_log 전담). 거기 붙였다면 **영원히 발화하지 않는
//       계측**을 복구했다고 착각했을 것이다. 넘길 금액도 그 경로엔 없다.
//       정산 완료를 실제로 만드는 것은 settleWorkLog / bulkSettlement 두 곳이고, 계측은 거기 붙였다
//       (settlementMutation.ts — success 판정 뒤 발화, 실패분 제외).

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
 *   onError: (error) => logger.error('근무 기록 구독 실패', error),
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
): UnsubscribeFn {
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
 *   onError: (error) => logger.error('근무 기록 목록 구독 실패', error),
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
): UnsubscribeFn {
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
): UnsubscribeFn {
  const today = toDateString(new Date());

  return RealtimeManager.subscribe(RealtimeManager.Keys.todayWorkStatus(staffId, today), () => {
    logger.info('오늘 근무 상태 실시간 구독 시작', { staffId: maskSensitiveId(staffId), today });

    return workLogRepository.subscribeTodayActive(
      staffId,
      today,
      [STATUS.WORK_LOG.SCHEDULED, STATUS.WORK_LOG.CHECKED_IN],
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
