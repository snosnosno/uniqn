/**
 * UNIQN Mobile - Supabase WorkLog Repository
 *
 * @description Supabase PostgREST 기반 WorkLog Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 근무 기록 조회 (13개 메서드)
 * 2. 실시간 구독 (5개 메서드)
 * 3. 상태/시간 변경 트랜잭션 (5개 메서드)
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES } from '@/errors';
import { handleSupabaseError, createRealtimeSubscription } from '@/utils/supabase';
import { getTodayString } from '@/utils/date';
import { STATUS } from '@/constants';
import type { UnsubscribeFn } from '@/types/common';
import type { WorkLog, PayrollStatus, QRCodeAction, QRProcessAction } from '@/types';
import type {
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
  WorkLogFilterOptions,
  UpdateSlotInput,
} from '../interfaces';
import {
  executeUpdateWorkTime,
  executeUpdatePayrollStatus,
  executeProcessQRCheckInOut,
} from './WorkLogRepositoryTransactions';
import {
  TABLE,
  DEFAULT_PAGE_SIZE,
  MAX_STATS_PAGE_SIZE,
  TABLE_COLUMNS,
  toWorkLog,
  rowsToWorkLogs,
  rethrowOrHandle,
} from './WorkLogRepositoryHelpers';
import * as venue from './WorkLogRepositoryVenue';

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseWorkLogRepository implements IWorkLogRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(workLogId: string): Promise<WorkLog | null> {
    try {
      logger.info('근무 기록 상세 조회', { workLogId });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('id', workLogId)
        .maybeSingle();

      if (error) handleSupabaseError(error, { operation: '근무 기록 상세 조회', table: TABLE });
      if (!data) return null;

      const workLog = toWorkLog(data as Record<string, unknown>);
      if (!workLog) {
        logger.warn('근무 기록 데이터 파싱 실패', { workLogId });
        return null;
      }

      return workLog;
    } catch (error) {
      rethrowOrHandle(error, '근무 기록 상세 조회', { workLogId });
    }
  }

  async getByStaffId(staffId: string, pageSize: number = DEFAULT_PAGE_SIZE): Promise<WorkLog[]> {
    try {
      logger.info('스태프별 근무 기록 조회', { staffId, pageSize });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('staff_id', staffId)
        .order('date', { ascending: false })
        .limit(pageSize);

      if (error) handleSupabaseError(error, { operation: '스태프별 근무 기록 조회', table: TABLE });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('스태프별 근무 기록 조회 완료', { staffId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '스태프별 근무 기록 조회', { staffId });
    }
  }

  async getUndatedByStaffId(staffId: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜 없는 스태프 근무 기록 조회', { staffId });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('staff_id', staffId)
        .eq('date', '');

      if (error)
        handleSupabaseError(error, {
          operation: '날짜 없는 스태프 근무 기록 조회',
          table: TABLE,
        });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('날짜 없는 스태프 근무 기록 조회 완료', { staffId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '날짜 없는 스태프 근무 기록 조회', { staffId });
    }
  }

  async getByStaffIdWithFilters(
    staffId: string,
    options?: WorkLogFilterOptions
  ): Promise<WorkLog[]> {
    try {
      logger.info('필터를 포함한 스태프별 근무 기록 조회', { staffId, options });

      let query = supabase.from(TABLE).select(TABLE_COLUMNS).eq('staff_id', staffId);

      if (options?.dateRange) {
        query = query.gte('date', options.dateRange.start).lte('date', options.dateRange.end);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      query = query
        .order('date', { ascending: false })
        .limit(options?.pageSize ?? DEFAULT_PAGE_SIZE);

      const { data, error } = await query;

      if (error)
        handleSupabaseError(error, {
          operation: '필터를 포함한 스태프별 근무 기록 조회',
          table: TABLE,
        });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('필터를 포함한 스태프별 근무 기록 조회 완료', { staffId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '필터를 포함한 스태프별 근무 기록 조회', { staffId });
    }
  }

  async getByDate(staffId: string, date: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜별 근무 기록 조회', { staffId, date });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('staff_id', staffId)
        .eq('date', date)
        .order('check_in_ts', { ascending: false, nullsFirst: false });

      if (error) handleSupabaseError(error, { operation: '날짜별 근무 기록 조회', table: TABLE });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('날짜별 근무 기록 조회 완료', { staffId, date, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '날짜별 근무 기록 조회', { staffId, date });
    }
  }

  async getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
    try {
      logger.info('공고별 근무 기록 조회', { jobPostingId });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .order('date', { ascending: false })
        .limit(MAX_STATS_PAGE_SIZE);

      if (error) handleSupabaseError(error, { operation: '공고별 근무 기록 조회', table: TABLE });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      if (items.length === MAX_STATS_PAGE_SIZE) {
        logger.warn('공고별 근무 기록 조회 상한 도달 — 페이지네이션 필요 가능', {
          jobPostingId,
          limit: MAX_STATS_PAGE_SIZE,
        });
      }
      logger.info('공고별 근무 기록 조회 완료', { jobPostingId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '공고별 근무 기록 조회', { jobPostingId });
    }
  }

  // 운영처 스팬 정산 조회 — 구현은 WorkLogRepositoryVenue 로 분리(800줄 하드캡). 동작 무변경 위임.
  async getByVenueSpanInRange(
    venueId: string,
    fromDate: string,
    toDate: string
  ): Promise<WorkLog[]> {
    return venue.getByVenueSpanInRange(venueId, fromDate, toDate);
  }

  async getCompletedByOwnerId(
    ownerId: string,
    dateRange?: { start: string; end: string }
  ): Promise<WorkLog[]> {
    try {
      logger.info('구인자별 완료된 근무 기록 조회', { ownerId });

      let query = supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('owner_id', ownerId)
        .in('status', [STATUS.WORK_LOG.CHECKED_OUT, STATUS.WORK_LOG.COMPLETED]);

      if (dateRange) {
        query = query.gte('date', dateRange.start).lte('date', dateRange.end);
      }

      query = query.order('date', { ascending: false }).limit(MAX_STATS_PAGE_SIZE);

      const { data, error } = await query;

      if (error)
        handleSupabaseError(error, { operation: '구인자별 완료된 근무 기록 조회', table: TABLE });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      if (items.length === MAX_STATS_PAGE_SIZE) {
        logger.warn(
          '구인자별 완료 근무 기록 조회 상한 도달 — dateRange 축소/페이지네이션 필요 가능',
          {
            ownerId,
            limit: MAX_STATS_PAGE_SIZE,
          }
        );
      }
      logger.info('구인자별 완료된 근무 기록 조회 완료', { ownerId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '구인자별 완료된 근무 기록 조회', { ownerId });
    }
  }

  async getUndatedCompletedByOwnerId(ownerId: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜 없는 구인자별 완료 근무 기록 조회', { ownerId });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('date', '')
        .in('status', [STATUS.WORK_LOG.CHECKED_OUT, STATUS.WORK_LOG.COMPLETED]);

      if (error)
        handleSupabaseError(error, {
          operation: '날짜 없는 구인자별 완료 근무 기록 조회',
          table: TABLE,
        });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('날짜 없는 구인자별 완료 근무 기록 조회 완료', { ownerId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '날짜 없는 구인자별 완료 근무 기록 조회', { ownerId });
    }
  }

  async getTodayCheckedIn(staffId: string): Promise<WorkLog | null> {
    try {
      const today = getTodayString();
      logger.info('오늘 출근 기록 조회', { staffId, today });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('staff_id', staffId)
        .eq('date', today)
        .eq('status', STATUS.WORK_LOG.CHECKED_IN)
        .limit(1)
        .maybeSingle();

      if (error) handleSupabaseError(error, { operation: '오늘 출근 기록 조회', table: TABLE });
      if (!data) return null;

      return toWorkLog(data as Record<string, unknown>);
    } catch (error) {
      rethrowOrHandle(error, '오늘 출근 기록 조회', { staffId });
    }
  }

  async getStats(staffId: string): Promise<WorkLogStats> {
    try {
      logger.info('근무 기록 통계 조회', { staffId });

      const workLogs = await this.getByStaffId(staffId, MAX_STATS_PAGE_SIZE);

      if (workLogs.length >= MAX_STATS_PAGE_SIZE) {
        logger.warn('통계 조회 건수 한도 도달, 결과가 불완전할 수 있음', {
          staffId,
          limit: MAX_STATS_PAGE_SIZE,
        });
      }

      const stats: WorkLogStats = {
        totalWorkLogs: workLogs.length,
        completedCount: 0,
        totalHoursWorked: 0,
        averageHoursPerDay: 0,
        pendingPayroll: 0,
        completedPayroll: 0,
      };

      for (const workLog of workLogs) {
        if (workLog.status === STATUS.WORK_LOG.COMPLETED) {
          stats.completedCount++;
        }

        if (workLog.checkInTime && workLog.checkOutTime) {
          const checkInMs = Date.parse(String(workLog.checkInTime));
          const checkOutMs = Date.parse(String(workLog.checkOutTime));
          if (Number.isFinite(checkInMs) && Number.isFinite(checkOutMs)) {
            const durationHours = (checkOutMs - checkInMs) / (1000 * 60 * 60);
            if (durationHours > 0) {
              stats.totalHoursWorked += durationHours;
            }
          }
        }

        const amount = workLog.payrollAmount ?? 0;
        if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          stats.completedPayroll += amount;
        } else {
          stats.pendingPayroll += amount;
        }
      }

      if (stats.completedCount > 0) {
        stats.averageHoursPerDay = stats.totalHoursWorked / stats.completedCount;
      }

      logger.info('근무 기록 통계 조회 완료', { staffId, stats });
      return stats;
    } catch (error) {
      rethrowOrHandle(error, '근무 기록 통계 조회', { staffId });
    }
  }

  async getMonthlyPayroll(
    staffId: string,
    year: number,
    month: number,
    workspaceId?: string
  ): Promise<MonthlyPayrollSummary> {
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      logger.info('월별 정산 요약 조회', { staffId, monthStr, workspaceId });

      const startDate = `${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // Phase 2A.후속 (PR3-B, 2026-05-10) — workspaceId 제공 시 job_postings.workspace_id
      // 로 inner-join 필터. work_logs 자체에 workspace_id 컬럼이 없어 PostgREST embed
      // resource 를 통한 join 필터링이 유일한 방법. parseWorkLogDocument 의
      // .passthrough() 가 join 결과의 nested job_postings 필드를 무시한다.
      const selectColumns = workspaceId
        ? `${TABLE_COLUMNS},job_postings!inner(workspace_id)`
        : TABLE_COLUMNS;

      let query = supabase
        .from(TABLE)
        .select(selectColumns)
        .eq('staff_id', staffId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (workspaceId) {
        query = query.eq('job_postings.workspace_id', workspaceId);
      }

      const { data, error } = await query.order('date', { ascending: true });

      if (error) handleSupabaseError(error, { operation: '월별 정산 요약 조회', table: TABLE });

      const summary: MonthlyPayrollSummary = {
        month: monthStr,
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0,
        workLogCount: 0,
        workLogs: [],
      };

      const workLogs: WorkLog[] = [];
      // join 결과 타입은 nested 객체를 포함하지만 toWorkLog 의 zod
      // .passthrough() 가 unknown 필드를 무시. 동적 select 로 union 이 된 만큼
      // unknown 경유 cast 가 필요.
      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        const workLog = toWorkLog(row);
        if (!workLog) continue;

        workLogs.push(workLog);
        summary.workLogCount++;
        const amount = workLog.payrollAmount ?? 0;
        summary.totalAmount += amount;

        if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          summary.completedAmount += amount;
        } else {
          summary.pendingAmount += amount;
        }
      }

      summary.workLogs = workLogs;

      logger.info('월별 정산 요약 조회 완료', {
        staffId,
        summary: { ...summary, workLogs: undefined },
      });
      return summary;
    } catch (error) {
      rethrowOrHandle(error, '월별 정산 요약 조회', { staffId, year, month, workspaceId });
    }
  }

  async getByDateRange(staffId: string, startDate: string, endDate: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜 범위 근무 기록 조회', { staffId, startDate, endDate });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('staff_id', staffId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error)
        handleSupabaseError(error, { operation: '날짜 범위 근무 기록 조회', table: TABLE });

      const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      logger.info('날짜 범위 근무 기록 조회 완료', {
        staffId,
        startDate,
        endDate,
        count: items.length,
      });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '날짜 범위 근무 기록 조회', { staffId, startDate, endDate });
    }
  }

  async findByJobPostingStaffDate(
    jobPostingId: string,
    staffId: string,
    date: string,
    assignmentGroupId?: string | null,
    timeSlot?: string | null
  ): Promise<WorkLog | null> {
    try {
      logger.info('공고-스태프-날짜 근무 기록 조회', { jobPostingId, staffId, date });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('staff_id', staffId)
        .eq('date', date);

      if (error)
        handleSupabaseError(error, { operation: '공고-스태프-날짜 근무 기록 조회', table: TABLE });

      if (!data || data.length === 0) {
        logger.info('공고-스태프-날짜 근무 기록 없음', { jobPostingId, staffId, date });
        return null;
      }

      const matchingWorkLogs = (data as Record<string, unknown>[])
        .map((row) => toWorkLog(row))
        .filter((workLog): workLog is WorkLog => Boolean(workLog))
        .filter((workLog) => {
          if (
            assignmentGroupId !== undefined &&
            (workLog.assignmentGroupId ?? null) !== assignmentGroupId
          ) {
            return false;
          }
          if (timeSlot !== undefined && (workLog.timeSlot ?? null) !== timeSlot) {
            return false;
          }
          return true;
        });

      if (matchingWorkLogs.length === 0) {
        return null;
      }

      if (matchingWorkLogs.length > 1) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '동일 날짜에 여러 배정이 있어 assignment별 QR이 필요합니다.',
        });
      }

      const [workLog] = matchingWorkLogs;
      logger.info('공고-스태프-날짜 근무 기록 조회 완료', {
        jobPostingId,
        staffId,
        date,
        found: !!workLog,
      });
      return workLog;
    } catch (error) {
      rethrowOrHandle(error, '공고-스태프-날짜 근무 기록 조회', { jobPostingId, staffId, date });
    }
  }

  // ==========================================================================
  // 실시간 구독 (Realtime)
  // ==========================================================================

  /** @deprecated polling으로 전환됨. getByDate + refetchInterval 사용 */
  subscribeByDate(
    staffId: string,
    date: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    logger.info('날짜별 근무 기록 초기 조회 (polling 전환)', { staffId, date });
    void this.getByDate(staffId, date).then(onData).catch(onError);
    return () => {
      /* noop */
    };
  }

  /** @deprecated polling으로 전환됨. getByStaffId + refetchInterval 사용 */
  subscribeByStaffId(
    staffId: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    logger.info('스태프별 근무 기록 초기 조회 (polling 전환)', { staffId });
    void this.getByStaffId(staffId, DEFAULT_PAGE_SIZE).then(onData).catch(onError);
    return () => {
      /* noop */
    };
  }

  subscribeById(
    workLogId: string,
    onData: (workLog: WorkLog | null) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    logger.info('단일 근무 기록 구독 시작', { workLogId });

    // 초기 데이터 1회 fetch — 변경 이벤트가 오지 않아도 구독자가 빈 상태에서 탈출
    void this.getById(workLogId)
      .then(onData)
      .catch((error) => onError(toError(error)));

    return createRealtimeSubscription(TABLE, `id=eq.${workLogId}`, (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          onData(null);
          return;
        }

        const row = payload.new as Record<string, unknown>;
        if (!row || Object.keys(row).length === 0) {
          onData(null);
          return;
        }

        const workLog = toWorkLog(row);
        onData(workLog);
      } catch (error) {
        logger.error('단일 근무 기록 구독 에러', toError(error), { workLogId });
        onError(toError(error));
      }
    });
  }

  /** @deprecated polling으로 전환됨. getByStaffIdWithFilters + refetchInterval 사용 */
  subscribeByStaffIdWithFilters(
    staffId: string,
    options: { dateRange?: { start: string; end: string }; pageSize?: number },
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    logger.info('필터를 포함한 스태프별 근무 기록 초기 조회 (polling 전환)', {
      staffId,
      dateRange: options.dateRange,
    });
    void this.getByStaffIdWithFilters(staffId, {
      dateRange: options.dateRange,
      pageSize: options.pageSize,
    })
      .then(onData)
      .catch(onError);
    return () => {
      /* noop */
    };
  }

  /** @deprecated polling으로 전환됨. 직접 조회 + refetchInterval 사용 */
  subscribeTodayActive(
    staffId: string,
    date: string,
    statuses: string[],
    onData: (workLog: WorkLog | null) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    logger.info('오늘 활성 근무 기록 초기 조회 (polling 전환)', { staffId, date, statuses });

    void supabase
      .from(TABLE)
      .select(TABLE_COLUMNS)
      .eq('staff_id', staffId)
      .eq('date', date)
      .in('status', statuses)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          onError(new Error(queryError.message));
          return;
        }

        if (!data || data.length === 0) {
          onData(null);
          return;
        }

        const workLogs = (data as Record<string, unknown>[])
          .map((row) => toWorkLog(row))
          .filter((wl): wl is WorkLog => wl !== null);

        const checkedIn = workLogs.find((wl) => wl.status === STATUS.WORK_LOG.CHECKED_IN) ?? null;
        onData(checkedIn ?? workLogs[0] ?? null);
      });

    return () => {
      /* noop */
    };
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async updatePayrollStatus(workLogId: string, status: PayrollStatus): Promise<void> {
    try {
      logger.info('정산 상태 변경', { workLogId, status });

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        payroll_status: status,
        updated_at: now,
      };

      if (status === STATUS.PAYROLL.COMPLETED) {
        updateData.payroll_date = now;
      }

      const { error } = await supabase.from(TABLE).update(updateData).eq('id', workLogId);

      if (error) handleSupabaseError(error, { operation: '정산 상태 변경', table: TABLE });

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      rethrowOrHandle(error, '정산 상태 변경', { workLogId, status });
    }
  }

  async updateWorkTimeTransaction(
    workLogId: string,
    updates: {
      checkInTime?: Date;
      checkOutTime?: Date;
      notes?: string;
    }
  ): Promise<void> {
    return executeUpdateWorkTime(workLogId, updates);
  }

  async updatePayrollStatusTransaction(
    workLogId: string,
    status: PayrollStatus,
    amount?: number
  ): Promise<void> {
    return executeUpdatePayrollStatus(workLogId, status, amount);
  }

  async flagNegativeSettlement(workLogId: string, amount: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLE)
        .update({
          _negative_settlement_detected: true,
          _negative_settlement_amount: amount,
          _negative_settlement_detected_at: new Date().toISOString(),
        })
        .eq('id', workLogId);

      if (error) handleSupabaseError(error, { operation: '음수 정산 플래그 기록', table: TABLE });

      logger.info('음수 정산 플래그 기록', { workLogId, amount });
    } catch (error) {
      rethrowOrHandle(error, '음수 정산 플래그 기록', { workLogId, amount });
    }
  }

  async processQRCheckInOutTransaction(
    workLogId: string,
    staffId: string,
    jobPostingId: string,
    action: QRProcessAction,
    checkTime: Date,
    date: string
  ): Promise<{
    action: QRCodeAction;
    hasExistingCheckInTime: boolean;
    workDuration: number;
  }> {
    return executeProcessQRCheckInOut(workLogId, staffId, jobPostingId, action, checkTime, date);
  }

  // 슬롯 편집(B2) — 구현은 WorkLogRepositoryVenue 로 분리(800줄 하드캡). 검증/동작 무변경 위임.
  async updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void> {
    return venue.updateSlot(workLogId, input);
  }
}
