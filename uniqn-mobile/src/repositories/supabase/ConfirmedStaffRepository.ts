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
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';
import {
  resolveNoShowRevertStatus,
  assertWorkTimeReason,
  appendWorkTimeModification,
} from '@/domains/staff';
// work_logs SELECT 화이트리스트·ts 매핑 정본(자체 사본 드리프트 금지).
import { WORK_LOG_COLUMNS as TABLE_COLUMNS, applyTsPreference } from './workLogColumns';
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

// ============================================================================
// Helpers
// ============================================================================

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

/** 수동 상태 변경이 타임스탬프를 만들거나 지울 때 이력에 남길 사유 문구 */
const MANUAL_STATUS_REASON: Record<string, string> = {
  [STATUS.WORK_LOG.SCHEDULED]: '수동 출근 예정 처리 — 기록된 출퇴근 시각 삭제',
  [STATUS.WORK_LOG.CHECKED_IN]: '수동 출근 처리',
  [STATUS.WORK_LOG.CHECKED_OUT]: '수동 퇴근 처리',
  [STATUS.WORK_LOG.COMPLETED]: '수동 근무 완료 처리',
};

/**
 * 수동 상태 변경으로 출퇴근 시각이 **실제로 바뀔 때만** 남길 감사 이력을 계산한다(순수 함수).
 *
 * @description 시간 수정 경로는 사유 입력 + `appendWorkTimeModification` 으로 이력을 강제하는데,
 *   수동 상태 변경은 그러지 않아 두 가지 구멍이 있었다.
 *   ① `scheduled` 로 되돌리면 QR 로 찍힌 시각이 이력 없이 사라져 복원 근거가 0이 된다.
 *   ② 수동 출근/퇴근으로 만들어진 시각이 실측값과 DB 상 구별되지 않는다.
 *
 *   체크인 알림 트리거는 `NULL → 값` 전이만 보므로 삭제는 통보되지 않았는데,
 *   이 이력을 남기면 `modification_history` 길이 증가로 `notify_on_work_log_update` 가 발화해
 *   스태프 통보 공백도 함께 닫힌다(새 트리거 불필요).
 *
 * @returns 변화가 없으면 `null`. 변한 축만 `newStartTime`/`newEndTime` 에 담는다(미변경 축은
 *   `undefined` 로 남겨 표시 컴포넌트가 "변경 없음"으로 처리하게 한다 — appendWorkTimeModification 계약).
 */
export function buildManualStatusAudit(
  status: string,
  patch: { check_in_ts?: string | null; check_out_ts?: string | null },
  existingCheckIn: string | null,
  existingCheckOut: string | null
): { newStartTime?: string | null; newEndTime?: string | null; reason: string } | null {
  const nextCheckIn = 'check_in_ts' in patch ? (patch.check_in_ts ?? null) : undefined;
  const nextCheckOut = 'check_out_ts' in patch ? (patch.check_out_ts ?? null) : undefined;

  const startChanged = nextCheckIn !== undefined && nextCheckIn !== existingCheckIn;
  const endChanged = nextCheckOut !== undefined && nextCheckOut !== existingCheckOut;

  if (!startChanged && !endChanged) return null;

  const audit: { newStartTime?: string | null; newEndTime?: string | null; reason: string } = {
    reason: MANUAL_STATUS_REASON[status] ?? '수동 상태 변경',
  };
  if (startChanged) audit.newStartTime = nextCheckIn ?? null;
  if (endChanged) audit.newEndTime = nextCheckOut ?? null;
  return audit;
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
 * 공고 권한 검증 헬퍼 — prod RLS wl_update(owner | ws member | posting collaborator)와 일치.
 * admin 은 통과시키지 않는다: wl_update 에 admin 분기가 없어 UPDATE 가 0행 silent no-op 이 된다.
 */
async function verifyPostingAuthority(
  jobPostingId: string,
  actorId: string,
  operation: string
): Promise<void> {
  const { data: jobData, error: jobError } = await supabase
    .from('job_postings')
    .select('id, owner_id, workspace_id')
    .eq('id', jobPostingId)
    .maybeSingle();

  if (jobError) handleSupabaseError(jobError, { operation, table: 'job_postings' });

  if (!jobData) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  const row = jobData as Record<string, unknown>;
  const postingOwnerId = row.owner_id as string;

  // owner 는 workspaceId 유무와 무관하게 통과(레거시 row). 비-owner 만 멤버십·협업자 판정.
  if (postingOwnerId === actorId) return;

  const workspaceId = row.workspace_id as string | null;
  if (!workspaceId) {
    throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '공고에 팀이 지정되지 않았습니다.',
    });
  }

  const authority = await resolvePostingAuthority({
    jobPostingId,
    workspaceId,
    postingOwnerId,
    actorId,
    operation,
  });

  if (!canManagePosting(authority)) {
    throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '이 공고에 대한 권한이 없습니다.',
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

      // 권한 검증 — workLog 에서 얻은 jobPostingId 로만 판정한다.
      // 클라이언트가 넘긴 jobPostingId 를 신뢰하면 타 공고 권한으로 우회 가능.
      await verifyPostingAuthority(workLog.jobPostingId, context.actorId, '스태프 역할 변경');

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

      // 권한 검증 — workLog 에서 얻은 jobPostingId 로만 판정한다.
      await verifyPostingAuthority(workLog.jobPostingId, context.actorId, '근무 시간 수정');

      // 2. 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: '이미 정산이 완료된 근무 기록은 수정할 수 없습니다.',
        });
      }

      // 3. 수정 사유 검증 + 이력 append. modification_history 길이 증가가 DB 트리거
      // (notify_on_work_log_update)를 발화시켜 스태프에게 "근무 시간 변경" 알림을 보내고,
      // SettlementDetailModal 이력 섹션에 표시된다. role_change_history 와 동일한 클라 append 패턴.
      const safeReason = assertWorkTimeReason(context.reason);
      const newModificationHistory = appendWorkTimeModification(workLog.modificationHistory, {
        previousStartTime: workLog.checkInTime,
        previousEndTime: workLog.checkOutTime,
        newStartTime: context.checkInTime === undefined ? undefined : context.checkInTime,
        newEndTime: context.checkOutTime === undefined ? undefined : context.checkOutTime,
        reason: safeReason,
        modifiedBy: context.actorId,
        modifiedAt: new Date(),
      });

      // 4. 업데이트 데이터 구성
      // 정산 내역은 read-time 재계산이라 무효화할 컬럼이 없다. 과거 여기 있던
      // `settlement_breakdown: null` 은 work_logs 에 존재하지 않는 컬럼이라 UPDATE 전체가
      // PGRST204 로 거부됐다(SettlementRepository 정본과 동일 결함). 가드=workLogWriteColumns.test.ts.
      const updateData: Record<string, unknown> = {
        has_time_modification_logs: true,
        modification_history: newModificationHistory,
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

      await verifyPostingAuthority(jobPostingId, context.actorId, '노쇼 처리');

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

      await verifyPostingAuthority(jobPostingId, context.actorId, '노쇼 취소');

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

      await verifyPostingAuthority(jobPostingId, context.actorId, '스태프 상태 변경');

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

      const timestampPatch = buildStatusTimestampPatch(
        context.status,
        existingCheckIn,
        existingCheckOut,
        now
      );

      const updateData: Record<string, unknown> = {
        status: context.status,
        updated_at: now,
        ...timestampPatch,
      };

      // 4. 타임스탬프가 실제로 바뀌면 감사 이력을 남긴다 — 시간 수정 경로와 대칭.
      //    삭제(scheduled 복귀)도 여기서 이력이 남아야 복원 근거가 생기고, 길이 증가가
      //    notify_on_work_log_update 를 발화시켜 스태프에게도 통보된다.
      const audit = buildManualStatusAudit(
        context.status,
        timestampPatch,
        existingCheckIn,
        existingCheckOut
      );
      if (audit) {
        updateData.modification_history = appendWorkTimeModification(workLog.modificationHistory, {
          previousStartTime: workLog.checkInTime,
          previousEndTime: workLog.checkOutTime,
          newStartTime: audit.newStartTime,
          newEndTime: audit.newEndTime,
          reason: audit.reason,
          modifiedBy: context.actorId,
          modifiedAt: new Date(now),
        });
        updateData.has_time_modification_logs = true;
      }

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
