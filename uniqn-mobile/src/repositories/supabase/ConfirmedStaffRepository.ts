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
import { createDebouncedTrigger, REALTIME_RELOAD_DEBOUNCE_MS } from '@/utils/debounce';
import { parseWorkLogDocuments, parseWorkLogDocument } from '@/schemas';
import { settledLockMessage } from '@/domains/settlement';
import { STATUS } from '@/constants';
import { TBA_TIME_MARKER } from '@/types/assignment';
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';
import { resolveNoShowRevertStatus } from '@/domains/staff';
// work_logs SELECT 화이트리스트·ts 매핑 정본(자체 사본 드리프트 금지).
import { WORK_LOG_COLUMNS as TABLE_COLUMNS, applyTsPreference } from './workLogColumns';
// 실적(출퇴근) 쓰기의 단일 관문. 이 경로의 직접 UPDATE 는 여기로 흡수됐다.
import { updateSlot as updateWorkLogSlot } from './WorkLogRepositoryVenue';
import type { UnsubscribeFn } from '@/types/common';
import type { WorkLog, WorkLogStatus } from '@/types';
import type {
  IConfirmedStaffRepository,
  ConfirmedStaffSubscriptionCallbacks,
  ManualWorkLogStatus,
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
 * 수동 상태 변경 이력에 실릴 사유 문구.
 *
 * 🔑 **서버로 옮기지 않는다.** 이건 제품 문구이지 보안 불변식이 아니다 — 서버에 하드코딩하면
 *    문구를 다듬을 때마다 마이그레이션이 필요해진다(색 토큰 화이트리스트를 클라에 남긴 판단과
 *    같은 원리). 서버는 받은 `reason` 의 길이·XSS 만 재검증한다.
 */
const MANUAL_STATUS_REASON: Record<string, string> = {
  [STATUS.WORK_LOG.SCHEDULED]: '수동 출근 예정 처리 — 기록된 출퇴근 시각 삭제',
  [STATUS.WORK_LOG.CHECKED_IN]: '수동 출근 처리',
  [STATUS.WORK_LOG.CHECKED_OUT]: '수동 퇴근 처리',
  [STATUS.WORK_LOG.COMPLETED]: '수동 근무 완료 처리',
};

/**
 * `update_work_log_slot` 의 `status` 패치가 받는 값인지 판정한다.
 *
 * 🔴 `no_show`·`cancelled` 는 동반 컬럼(no_show_reason/no_show_at)과 복귀 규칙을 갖는 별도
 *    도메인이라 서버가 거부한다. 여기서 먼저 걸러 RPC 왕복 없이 실패시킨다(fail-closed).
 *    `UpdateStaffStatusContext.status` 는 넓은 `WorkLogStatus` 라 타입만으로는 못 막는다.
 */
function isManualWorkLogStatus(status: WorkLogStatus): status is ManualWorkLogStatus {
  return (
    status === STATUS.WORK_LOG.SCHEDULED ||
    status === STATUS.WORK_LOG.CHECKED_IN ||
    status === STATUS.WORK_LOG.CHECKED_OUT ||
    status === STATUS.WORK_LOG.COMPLETED
  );
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

  // 🗑️ `updateRoleWithTransaction` 은 삭제됐다 (감사 finding-04, 2026-08-10).
  //
  // `role_change_history` 를 읽어서 spread 로 덧붙인 뒤 통째로 덮어쓰는 read-modify-write 였다
  // (data-01 의 나머지 절반). 다만 **RPC 로 재구현하지 않고 지웠다** — 호출부가 0건인 죽은
  // 코드였기 때문이다. 역할 편집의 정본은 통합 시트(WorkLogEditSheet → useUpdateSlot →
  // `update_work_log_slot` 의 staffRole/customRole 축)이고, 서버는 그 경로에서 이미
  // `role_change_history` 를 잠금 아래에서 append 한다.
  //
  // 유일한 진입점이던 `useConfirmedStaff.changeRole`/`changeRoleAsync` 와 서비스
  // `updateStaffRole` 도 같은 PR 에서 함께 지웠다. 되살리지 말 것 — 되살리면 잠금 없는
  // 이력 쓰기 경로가 다시 생긴다.

  /**
   * 근무 시간(실적) 수정 — 서버 RPC `update_work_log_slot` 1회.
   *
   * 🔴 예전엔 여기서 조회 → 권한 검증 → 정산 잠금 → 이력 append → 상태 파생 → UPDATE 를
   * 다단계로 했다. 같은 규칙을 형제 경로(SettlementRepository)와 근무표 경로가 각자 구현해
   * 조금씩 어긋났고(SET-1 이 그 사례다), 편집기를 시트 하나로 합치면 "저장 한 번"이 호출
   * 두 번이 되어 부분 실패가 생긴다. 전부 RPC 안으로 모았다(20260806140000).
   *
   * 서버가 하는 일 — 권한 검증 · 정산 완료 잠금(ALREADY_SETTLED) · 근태 상태 파생 ·
   * `modification_history` append · `end_time_source='manual'` · `has_time_modification_logs` ·
   * `updated_at` · 사유 재검증. **여기서 다시 흉내내지 않는다.**
   *
   * `editedBy` 는 명시로 보낸다 — 서버는 값을 auth.uid() 로 덮어쓰지만, 키가 없으면
   * 퇴근 시각을 쓸 때만 `edited_by` 를 세우는 비대칭(흡수 전 파리티)이 그대로 남는다.
   */
  async updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', {
        workLogId: context.workLogId,
        checkInTime: context.checkInTime?.toISOString() ?? '미정',
        checkOutTime: context.checkOutTime?.toISOString() ?? '미정',
      });

      await updateWorkLogSlot(context.workLogId, {
        checkIn: context.checkInTime,
        checkOut: context.checkOutTime,
        reason: context.reason,
        editedBy: context.actorId,
      });

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

      // 3. 정산 완료된 경우 노쇼 전환 불가 (cancelNoShow·updateWorkTimeWithTransaction과 동일 정책)
      //    이 잠금이 없으면 '지급 완료 + 노쇼' 모순 행이 남고, 스태프 월 수입 합계는
      //    completed 만 합산하므로(scheduleService) **이미 지급한 급여가 통계에서 사라진다**.
      //    되돌리기(cancelNoShow)만 잠겨 있던 단방향 비대칭을 여기서 닫는다.
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
          userMessage: settledLockMessage('노쇼로 처리할'),
        });
      }

      // 4. 노쇼 상태 업데이트
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
          userMessage: settledLockMessage('노쇼를 취소할'),
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

  /**
   * 스태프 근태 상태 변경 — 서버 RPC `update_work_log_slot` 1회.
   *
   * 🔴 예전엔 여기서 조회 → 권한 검증 → 타임스탬프 파생 → 이력 append → UPDATE 를 다단계로
   * 했다. 그 이력 append 가 `modification_history` 를 **읽어서 통째로 덮어쓰는** read-modify-write
   * 였고, 잠금이 없어 같은 행의 시간 편집(형제 경로)과 겹치면 뒤에 끝난 쪽이 앞의 항목을
   * 지웠다 — 이력 jsonb Lost Update 의 4번째 경로다(감사 data-01). 서버는 `FOR UPDATE` 로 잠근
   * 스냅샷에서 append 하므로 두 항목이 모두 남는다(마이그 20260810100000, pgTAP 59번).
   *
   * 서버가 하는 일 — 권한 검증 · 노쇼/취소 행 가드 · 정산 완료 잠금(ALREADY_SETTLED) ·
   * 타임스탬프 역파생 · `modification_history` append · `end_time_source` · `edited_by` ·
   * `has_time_modification_logs`. **여기서 다시 흉내내지 않는다.**
   *
   * 사유 문구(MANUAL_STATUS_REASON)만 클라가 보낸다 — 제품 문구이지 보안 불변식이 아니다.
   */
  async updateStatus(context: UpdateStaffStatusContext): Promise<void> {
    try {
      logger.info('스태프 상태 변경', { workLogId: context.workLogId, status: context.status });

      // 노쇼·취소는 전용 경로(markAsNoShow/cancelNoShow)가 정본이다. 서버도 거부하지만
      // 여기서 먼저 걸러 RPC 왕복 없이 실패시킨다.
      const status = context.status;
      if (!isManualWorkLogStatus(status)) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이 상태로는 직접 변경할 수 없습니다.',
        });
      }

      await updateWorkLogSlot(context.workLogId, {
        status,
        reason: MANUAL_STATUS_REASON[status] ?? '수동 상태 변경',
        editedBy: context.actorId,
      });

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
          // [R1] null 을 보내지 않는다 — 미정은 '미정' 문자열 하나로 통일한다.
          //      서버 `_normalize_time_slot` 이 둘을 같은 NULL 로 접어 저장 결과는 동일하지만,
          //      쓰기 표현을 하나로 두지 않으면 '미정을 뜻하는 값'이 다시 늘어난다.
          timeSlot: a.timeSlot ?? TBA_TIME_MARKER,
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

    const reload = (): void => {
      try {
        void this.getByJobPostingId(jobPostingId)
          .then((workLogs) => callbacks.onUpdate(workLogs))
          .catch((error) => callbacks.onError?.(toError(error)));
      } catch (error) {
        logger.error('확정 스태프 구독 처리 에러', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    };

    // 초기 데이터 1회 fetch — 변경 이벤트가 오지 않아도 구독자가 빈 상태에서 탈출
    reload();

    // 행 변경마다 전체 재조회하면 일괄 작업 한 번이 N 회 조회로 증폭된다(realtime-02).
    // 리딩+트레일링 병합이라 단발 변경의 실시간성은 그대로다.
    const debounced = createDebouncedTrigger(reload, REALTIME_RELOAD_DEBOUNCE_MS);

    const unsubscribe = createRealtimeSubscription(
      TABLE,
      `job_posting_id=eq.${jobPostingId}`,
      (_payload) => {
        debounced.trigger();
      }
    );

    return () => {
      // 창에 걸려 있던 트레일링을 반드시 버린다 — 안 그러면 해제된 구독자에게
      // 갱신이 한 번 더 도착한다.
      debounced.cancel();
      unsubscribe();
    };
  }
}
