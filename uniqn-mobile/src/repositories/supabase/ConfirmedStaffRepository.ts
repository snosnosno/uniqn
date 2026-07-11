/**
 * UNIQN Mobile - Supabase Confirmed Staff Repository
 *
 * @description Supabase PostgREST 기반 확정 스태프 Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 공고별 확정 스태프(WorkLog) 조회
 * 2. 역할 변경, 시간 수정, 노쇼, 상태 변경 트랜잭션
 * 3. 확정 스태프 실시간 구독
 *
 * Note: confirmed staff 데이터는 work_logs 테이블에서 조회
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase, createRealtimeSubscription } from '@/utils/supabase';
import { parseWorkLogDocuments, parseWorkLogDocument } from '@/schemas';
import { STATUS } from '@/constants';
import { resolveNoShowRevertStatus } from '@/domains/staff';
import type { UnsubscribeFn } from '@/types/common';
import type { RoleChangeHistory, WorkLog } from '@/types';
import type {
  IConfirmedStaffRepository,
  ConfirmedStaffSubscriptionCallbacks,
  UpdateRoleContext,
  UpdateConfirmedStaffWorkTimeContext,
  MarkNoShowContext,
  CancelNoShowContext,
  UpdateStaffStatusContext,
  AddDirectStaffContext,
  RemoveDirectStaffContext,
} from '../interfaces';

// ============================================================================
// Constants
// ============================================================================

const TABLE = 'work_logs';
const TABLE_COLUMNS =
  'id,application_id,assignment_group_id,check_in_ts,check_out_ts,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;

// ============================================================================
// Helpers
// ============================================================================

// Phase D: ts 컬럼 → 도메인 `checkInTime`/`checkOutTime` 매핑.
function applyTsPreference(camel: Record<string, unknown>): Record<string, unknown> {
  return {
    ...camel,
    checkInTime: camel.checkInTs ?? null,
    checkOutTime: camel.checkOutTs ?? null,
  };
}

function rowsToWorkLogs(rows: Record<string, unknown>[]): WorkLog[] {
  return parseWorkLogDocuments(
    rows.map((row) => ({
      ...applyTsPreference(toCamelCase<Record<string, unknown>>(row)),
      id: row.id,
    }))
  );
}

function toWorkLog(row: Record<string, unknown>): WorkLog | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseWorkLogDocument({ ...applyTsPreference(camel), id: row.id });
}

/**
 * 수동 상태 변경 시 종결 status 와 타임스탬프(check_in_ts/check_out_ts) 정합을 위한
 * 패치 계산(순수 함수). 정산 게이트가 status 가 아닌 타임스탬프로 판정하므로,
 * 수동 출근/퇴근/완료 처리 시에도 타임스탬프를 함께 기록/정리해야 정산이 풀린다.
 *
 * - scheduled        → 근무 전: 타임스탬프 정리(null)
 * - checked_in       → 출근: check_in 기록(기존 우선), check_out 비움
 * - checked_out/완료 → 퇴근/완료: check_in·check_out 모두 기록(기존 우선)
 */
export function buildStatusTimestampPatch(
  status: string,
  existingCheckIn: string | null,
  existingCheckOut: string | null,
  now: string
): { check_in_ts?: string | null; check_out_ts?: string | null } {
  switch (status) {
    case STATUS.WORK_LOG.SCHEDULED:
      return { check_in_ts: null, check_out_ts: null };
    case STATUS.WORK_LOG.CHECKED_IN:
      return { check_in_ts: existingCheckIn ?? now, check_out_ts: null };
    case STATUS.WORK_LOG.CHECKED_OUT:
    case STATUS.WORK_LOG.COMPLETED:
      return { check_in_ts: existingCheckIn ?? now, check_out_ts: existingCheckOut ?? now };
    default:
      return {};
  }
}

/** 공통 catch 핸들러 */
function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLE });
}

/**
 * 직접 추가/삭제 RPC 가 RAISE 한 도메인 에러를 사용자 친화 메시지로 변환.
 * (매칭되지 않으면 null 반환 → 공통 핸들러로 위임)
 */
function toDirectStaffBusinessError(error: unknown): BusinessError | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('MAX_CAPACITY_REACHED')) {
    return new BusinessError(ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED, {
      userMessage: '해당 일정의 모집 인원이 가득 찼습니다.',
    });
  }
  if (message.includes('DUPLICATE_ASSIGNMENT')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '이미 같은 날짜/역할로 추가된 스태프입니다.',
    });
  }
  if (message.includes('STAFF_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '대상 사용자를 찾을 수 없습니다.',
    });
  }
  if (message.includes('STAFF_ALREADY_CHECKED_IN')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '출근 처리된 스태프는 삭제할 수 없습니다.',
    });
  }
  if (message.includes('NOT_DIRECT_STAFF')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '지원을 통해 확정된 스태프는 확정 해제로 처리해주세요.',
    });
  }
  if (message.includes('PERMISSION_DENIED')) {
    return new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '이 작업을 수행할 권한이 없습니다.',
    });
  }
  return null;
}

/**
 * WorkLog 존재 확인 헬퍼
 */
async function loadWorkLog(workLogId: string, operation: string): Promise<WorkLog> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(TABLE_COLUMNS)
    .eq('id', workLogId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation, table: TABLE });

  if (!data) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다.',
    });
  }

  const workLog = toWorkLog(data as Record<string, unknown>);
  if (!workLog) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '근무 기록 데이터가 올바르지 않습니다.',
    });
  }

  return workLog;
}

/**
 * 공고 소유권 검증 헬퍼
 */
async function verifyJobPostingOwnership(
  jobPostingId: string,
  ownerId: string,
  operation: string
): Promise<void> {
  const { data: jobData, error: jobError } = await supabase
    .from('job_postings')
    .select('id, owner_id')
    .eq('id', jobPostingId)
    .maybeSingle();

  if (jobError) handleSupabaseError(jobError, { operation, table: 'job_postings' });

  if (!jobData) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  if ((jobData as Record<string, unknown>).owner_id !== ownerId) {
    throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '공고 소유자만 이 작업을 수행할 수 있습니다.',
    });
  }
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseConfirmedStaffRepository implements IConfirmedStaffRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
    try {
      logger.info('공고별 확정 스태프 WorkLog 조회', { jobPostingId });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .order('date', { ascending: true });

      if (error) handleSupabaseError(error, { operation: '공고별 확정 스태프 조회', table: TABLE });

      const workLogs = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);

      logger.info('공고별 확정 스태프 조회 완료', { jobPostingId, count: workLogs.length });
      return workLogs;
    } catch (error) {
      rethrowOrHandle(error, '공고별 확정 스태프 조회', { jobPostingId });
    }
  }

  async getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜별 확정 스태프 WorkLog 조회', { jobPostingId, date });

      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('date', date);

      if (error) handleSupabaseError(error, { operation: '날짜별 확정 스태프 조회', table: TABLE });

      const workLogs = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
      return workLogs;
    } catch (error) {
      rethrowOrHandle(error, '날짜별 확정 스태프 조회', { jobPostingId, date });
    }
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async updateRoleWithTransaction(context: UpdateRoleContext): Promise<void> {
    try {
      logger.info('스태프 역할 변경 시작', { workLogId: context.workLogId });

      // 1. 현재 WorkLog 조회
      const workLog = await loadWorkLog(context.workLogId, '스태프 역할 변경');

      // 2. 역할 변경 이력 구성
      const previousRole = workLog.role;
      const roleChangeHistory: RoleChangeHistory[] = workLog.roleChangeHistory ?? [];
      const newHistory = [
        ...roleChangeHistory,
        {
          previousRole,
          newRole: context.newRole,
          reason: context.reason,
          changedBy: context.changedBy,
          changedAt: new Date(),
        },
      ];

      const roleUpdate = context.isStandardRole
        ? { role: context.newRole, custom_role: null }
        : { role: 'other', custom_role: context.newRole };

      // 3. 업데이트
      const { error } = await supabase
        .from(TABLE)
        .update({
          ...roleUpdate,
          role_change_history: newHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', context.workLogId);

      if (error) handleSupabaseError(error, { operation: '스태프 역할 변경', table: TABLE });

      logger.info('스태프 역할 변경 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '스태프 역할 변경', { workLogId: context.workLogId });
    }
  }

  async updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', {
        workLogId: context.workLogId,
        checkInTime: context.checkInTime?.toISOString() ?? '미정',
        checkOutTime: context.checkOutTime?.toISOString() ?? '미정',
      });

      // 1. 현재 WorkLog 조회
      const workLog = await loadWorkLog(context.workLogId, '근무 시간 수정');

      // 2. 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산이 완료된 근무 기록은 수정할 수 없습니다.',
        });
      }

      // 3. 업데이트 데이터 구성
      const updateData: Record<string, unknown> = {
        has_time_modification_logs: true,
        updated_at: new Date().toISOString(),
      };

      if (context.checkInTime !== undefined) {
        updateData.check_in_ts = context.checkInTime ? context.checkInTime.toISOString() : null;
      }

      if (context.checkOutTime !== undefined) {
        updateData.check_out_ts = context.checkOutTime ? context.checkOutTime.toISOString() : null;
      }

      // 상태 결정: 양쪽 다 있으면 checked_out
      const finalCheckIn = context.checkInTime ?? workLog.checkInTime;
      const finalCheckOut = context.checkOutTime ?? workLog.checkOutTime;

      if (finalCheckIn && finalCheckOut) {
        updateData.status = STATUS.WORK_LOG.CHECKED_OUT;
      } else if (finalCheckIn) {
        updateData.status = STATUS.WORK_LOG.CHECKED_IN;
      }

      const { error } = await supabase.from(TABLE).update(updateData).eq('id', context.workLogId);

      if (error) handleSupabaseError(error, { operation: '근무 시간 수정', table: TABLE });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '근무 시간 수정', { workLogId: context.workLogId });
    }
  }

  async markAsNoShow(context: MarkNoShowContext): Promise<void> {
    try {
      logger.info('노쇼 처리', { workLogId: context.workLogId });

      // 1. WorkLog 조회
      const workLog = await loadWorkLog(context.workLogId, '노쇼 처리');

      // 2. 공고 소유권 확인
      const jobPostingId = workLog.jobPostingId;
      if (!jobPostingId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록에 공고 정보가 없습니다.',
        });
      }

      await verifyJobPostingOwnership(jobPostingId, context.ownerId, '노쇼 처리');

      // 3. 노쇼 상태 업데이트
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: STATUS.WORK_LOG.NO_SHOW,
          no_show_reason: context.reason,
          no_show_at: now,
          updated_at: now,
        })
        .eq('id', context.workLogId);

      if (error) handleSupabaseError(error, { operation: '노쇼 처리', table: TABLE });

      logger.info('노쇼 처리 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '노쇼 처리', { workLogId: context.workLogId });
    }
  }

  async cancelNoShow(context: CancelNoShowContext): Promise<void> {
    try {
      logger.info('노쇼 취소', { workLogId: context.workLogId });

      // 1. WorkLog 조회
      const workLog = await loadWorkLog(context.workLogId, '노쇼 취소');

      // 2. 공고 소유권 확인
      const jobPostingId = workLog.jobPostingId;
      if (!jobPostingId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록에 공고 정보가 없습니다.',
        });
      }

      await verifyJobPostingOwnership(jobPostingId, context.ownerId, '노쇼 취소');

      // 3. 노쇼 상태가 아니면 취소 대상이 아님
      if (workLog.status !== STATUS.WORK_LOG.NO_SHOW && !workLog.noShowAt) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '노쇼 처리된 근무 기록이 아닙니다.',
        });
      }

      // 4. 정산 완료된 경우 취소 불가 (updateWorkTimeWithTransaction과 동일 정책)
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산이 완료된 근무 기록은 노쇼를 취소할 수 없습니다.',
        });
      }

      // 5. 남아있는 출퇴근 타임스탬프로부터 상태를 재구성 후 노쇼 필드 제거
      //    (DB CHECK 제약 work_logs_status_timestamp_consistency 정합 유지)
      const status = resolveNoShowRevertStatus(workLog.checkInTime, workLog.checkOutTime);
      const now = new Date().toISOString();

      const { error } = await supabase
        .from(TABLE)
        .update({
          status,
          no_show_at: null,
          no_show_reason: null,
          updated_at: now,
        })
        .eq('id', context.workLogId);

      if (error) handleSupabaseError(error, { operation: '노쇼 취소', table: TABLE });

      logger.info('노쇼 취소 완료', { workLogId: context.workLogId, status });
    } catch (error) {
      rethrowOrHandle(error, '노쇼 취소', { workLogId: context.workLogId });
    }
  }

  async updateStatus(context: UpdateStaffStatusContext): Promise<void> {
    try {
      logger.info('스태프 상태 변경', { workLogId: context.workLogId, status: context.status });

      // 1. WorkLog 조회
      const workLog = await loadWorkLog(context.workLogId, '스태프 상태 변경');

      // 2. 공고 소유권 확인
      const jobPostingId = workLog.jobPostingId;
      if (!jobPostingId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '근무 기록에 공고 정보가 없습니다.',
        });
      }

      await verifyJobPostingOwnership(jobPostingId, context.ownerId, '스태프 상태 변경');

      // 3. 상태 업데이트 — 종결 status 와 타임스탬프 정합 유지.
      //    정산 게이트가 status 가 아닌 check_in_ts/check_out_ts 로 판정하므로(SSOT),
      //    수동으로 출근/퇴근/완료 처리 시 타임스탬프를 함께 기록해야 정산이 풀린다.
      //    (미기록 시 스태프관리=완료/정산=출퇴근 미완료 모순 발생)
      const now = new Date().toISOString();
      const existingCheckIn = workLog.checkInTime
        ? new Date(workLog.checkInTime).toISOString()
        : null;
      const existingCheckOut = workLog.checkOutTime
        ? new Date(workLog.checkOutTime).toISOString()
        : null;

      const updateData: Record<string, unknown> = {
        status: context.status,
        updated_at: now,
        ...buildStatusTimestampPatch(context.status, existingCheckIn, existingCheckOut, now),
      };

      const { error } = await supabase.from(TABLE).update(updateData).eq('id', context.workLogId);

      if (error) handleSupabaseError(error, { operation: '스태프 상태 변경', table: TABLE });

      logger.info('스태프 상태 변경 완료', {
        workLogId: context.workLogId,
        status: context.status,
      });
    } catch (error) {
      rethrowOrHandle(error, '스태프 상태 변경', {
        workLogId: context.workLogId,
        status: context.status,
      });
    }
  }

  // ==========================================================================
  // 직접 추가/삭제 (지원서 없이 스태프 투입)
  // ==========================================================================

  async addDirectStaff(context: AddDirectStaffContext): Promise<string[]> {
    try {
      logger.info('스태프 직접 추가', {
        jobPostingId: context.jobPostingId,
        staffId: context.staffId,
        assignments: context.assignments.length,
      });

      const { data, error } = await supabase.rpc('add_direct_staff', {
        p_job_posting_id: context.jobPostingId,
        p_staff_id: context.staffId,
        p_assignments: context.assignments.map((a) => ({
          date: a.date,
          role: a.role,
          customRole: a.customRole ?? null,
          timeSlot: a.timeSlot ?? null,
          notes: a.notes ?? null,
        })),
      });

      if (error) {
        const mapped = toDirectStaffBusinessError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '스태프 직접 추가', table: TABLE });
      }

      const result = data as { workLogIds?: string[] } | null;
      const workLogIds = result?.workLogIds ?? [];

      logger.info('스태프 직접 추가 완료', {
        jobPostingId: context.jobPostingId,
        count: workLogIds.length,
      });
      return workLogIds;
    } catch (error) {
      // 매핑된 BusinessError 는 rethrowOrHandle 의 isAppError 분기로 그대로 재전파된다.
      rethrowOrHandle(error, '스태프 직접 추가', { jobPostingId: context.jobPostingId });
    }
  }

  async removeDirectStaff(context: RemoveDirectStaffContext): Promise<void> {
    try {
      logger.info('직접 추가 스태프 삭제', { workLogId: context.workLogId });

      const { error } = await supabase.rpc('remove_direct_staff', {
        p_work_log_id: context.workLogId,
      });

      if (error) {
        const mapped = toDirectStaffBusinessError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '직접 추가 스태프 삭제', table: TABLE });
      }

      logger.info('직접 추가 스태프 삭제 완료', { workLogId: context.workLogId });
    } catch (error) {
      // 매핑된 BusinessError 는 rethrowOrHandle 의 isAppError 분기로 그대로 재전파된다.
      rethrowOrHandle(error, '직접 추가 스태프 삭제', { workLogId: context.workLogId });
    }
  }

  // ==========================================================================
  // 실시간 구독 (Realtime)
  // ==========================================================================

  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): UnsubscribeFn {
    logger.info('확정 스태프 실시간 구독 시작', { jobPostingId });

    // 초기 데이터 1회 fetch — 변경 이벤트가 오지 않아도 구독자가 빈 상태에서 탈출
    void this.getByJobPostingId(jobPostingId)
      .then((workLogs) => callbacks.onUpdate(workLogs))
      .catch((error) => callbacks.onError?.(toError(error)));

    return createRealtimeSubscription(TABLE, `job_posting_id=eq.${jobPostingId}`, (_payload) => {
      try {
        // 변경 이벤트 발생 시 전체 목록 재조회
        void this.getByJobPostingId(jobPostingId)
          .then((workLogs) => callbacks.onUpdate(workLogs))
          .catch((error) => callbacks.onError?.(toError(error)));
      } catch (error) {
        logger.error('확정 스태프 구독 처리 에러', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    });
  }
}
