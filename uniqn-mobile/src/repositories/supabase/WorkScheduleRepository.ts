/**
 * UNIQN Mobile — Supabase WorkSchedule Repository (근무표 읽기)
 *
 * 두 읽기 RPC(get_venue_grid_summary / get_venue_day_slots)를 감싸는 read-only 레포.
 * - 둘 다 SECDEF + 워크스페이스 게이트 + anon REVOKE, venue_span_posting_ids(SSOT) 경유.
 * - 생성타입(supabase.ts)에 신규 RPC 미반영(prod 후 MCP gen 정합) → rpc 는 느슨타입, 응답은
 *   camelCase 로 투영해 반환(job_count→jobCount 등, CLAUDE.md 필드명 규칙).
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  isAppError,
  type AppError,
} from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { toDateString } from '@/utils/date';
import type { GridSummaryRow } from '@/domains/workSchedule';
import type {
  IWorkScheduleRepository,
  VenueDaySlot,
  SetVenueRoleSalaryInput,
  UpdatePostingSlotTimeInput,
  UpdatePostingSlotTimeResult,
} from '../interfaces/IWorkScheduleRepository';

const TABLE = 'work_logs' as const;

export class SupabaseWorkScheduleRepository implements IWorkScheduleRepository {
  async getVenueGridSummary(
    venueId: string,
    fromDate: string,
    toDate: string
  ): Promise<GridSummaryRow[]> {
    try {
      logger.info('운영처 그리드 요약 조회', { venueId, fromDate, toDate });
      const { data, error } = await supabase.rpc('get_venue_grid_summary', {
        p_venue: venueId,
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 그리드 요약 조회', table: TABLE });
      const rows = (data ?? []) as {
        d: string;
        headcount: number | string;
        job_count: number | string;
        required_count: number | string;
      }[];
      // snake_case → camelCase 매핑 + 숫자 정규화(NaN 방어)
      return rows.map((r) => ({
        d: r.d,
        headcount: Number(r.headcount) || 0,
        jobCount: Number(r.job_count) || 0,
        requiredCount: Number(r.required_count) || 0,
      }));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 그리드 요약 조회', table: TABLE });
    }
  }

  async getVenueDaySlots(venueId: string, date: string): Promise<VenueDaySlot[]> {
    try {
      logger.info('운영처 하루 슬롯 조회', { venueId, date });
      const { data, error } = await supabase.rpc('get_venue_day_slots', {
        p_venue: venueId,
        p_date: date,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 하루 슬롯 조회', table: TABLE });
      const rows = (data ?? []) as Record<string, unknown>[];
      // RPC 가 snake_case(work_log_id/staff_name/time_slot…) 반환 → camelCase 투영.
      return rows.map((row) => toCamelCase<VenueDaySlot>(row));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 하루 슬롯 조회', table: TABLE });
    }
  }

  async setVenueSoftTarget(venueId: string, date: string, count: number): Promise<void> {
    try {
      // E5: write 경계에서 날짜키를 YYYY-MM-DD 로 정규화(RPC 도 재정규화하나 클라단 일관성 보장).
      const dateKey = toDateString(date);
      logger.info('운영처 soft-target 설정', { venueId, date: dateKey, count });
      const { error } = await supabase.rpc('set_venue_soft_target', {
        p_venue: venueId,
        p_date: dateKey,
        p_count: count,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 soft-target 설정', table: TABLE });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 soft-target 설정', table: TABLE });
    }
  }

  async setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void> {
    try {
      logger.info('지점 역할 단가 설정', {
        venueId,
        role: input.role,
        remove: input.salary === null,
      });
      const { error } = await supabase.rpc('set_venue_role_salary', {
        p_venue: venueId,
        p_role: input.role,
        p_custom_role: input.customRole ?? null,
        p_salary_type: input.salary?.type ?? null,
        p_amount: input.salary?.amount ?? null,
      });
      if (error) handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    }
  }

  /**
   * 공고 슬롯 시간 일괄 변경(3-C) — `update_posting_slot_time` RPC 1회.
   *
   * 근무 시각과 공고 원문 정원을 한 트랜잭션에서 함께 옮긴다. 대상은 구인자가 고른
   * `workLogIds` 이고, 서버가 그것들이 전부 (공고·날짜·역할 키·출발 시각 키) 축에
   * 속하는지 검증해 하나라도 벗어나면 전체를 거부한다(`SLOT_MISMATCH`).
   *
   * 🔑 시간 축은 **유효한 것 하나만** 실어 보낸다 — 서버의 우선순위 분기(`timeUndecided`
   *    우선)와 이중 관리되지 않도록. `updateSlot`(WorkLogRepositoryVenue)과 같은 관용구다.
   */
  async updatePostingSlotTime(
    input: UpdatePostingSlotTimeInput
  ): Promise<UpdatePostingSlotTimeResult> {
    try {
      logger.info('공고 슬롯 시간 일괄 변경', {
        jobPostingId: input.jobPostingId,
        date: input.date,
        roleKey: input.roleKey,
        fromSlotKey: input.fromSlotKey,
        targetCount: input.workLogIds.length,
      });

      const patch: Record<string, unknown> = input.timeUndecided
        ? { timeUndecided: true }
        : { startTime: input.startTime };

      const { data, error } = await supabase.rpc('update_posting_slot_time', {
        p_job_posting_id: input.jobPostingId,
        p_date: input.date,
        p_role_key: input.roleKey,
        p_from_slot_key: input.fromSlotKey,
        p_work_log_ids: [...input.workLogIds],
        p_patch: patch,
      });

      if (error) {
        const mapped = toPostingSlotTimeError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '공고 슬롯 시간 일괄 변경', table: TABLE });
      }

      const raw = (data ?? {}) as {
        total?: number;
        updated?: number;
        assignmentSynced?: number;
        skipped?: { workLogId?: string; reason?: string }[];
        capacitySkipReason?: string | null;
      };

      const result: UpdatePostingSlotTimeResult = {
        total: Number(raw.total ?? 0),
        updated: Number(raw.updated ?? 0),
        assignmentSynced: Number(raw.assignmentSynced ?? 0),
        skipped: (raw.skipped ?? []).map((s) => ({
          workLogId: String(s.workLogId ?? ''),
          reason: String(s.reason ?? 'unknown'),
        })),
        // 서버는 JSON null 로 "사유 없음"을 보낸다 — optional 필드에 null 을 흘리지 않는다.
        ...(raw.capacitySkipReason ? { capacitySkipReason: raw.capacitySkipReason } : {}),
      };

      // 부분 성공은 실패가 아니지만(시각 변경은 성사됐다) 조용히 넘기지 않고 관측 가능하게 남긴다.
      if (result.skipped.length > 0 || result.capacitySkipReason) {
        logger.warn('공고 슬롯 시간 일괄 변경 — 일부 후속 작업을 건너뜀', {
          jobPostingId: input.jobPostingId,
          skipped: result.skipped.length,
          capacitySkipReason: result.capacitySkipReason,
        });
      }

      logger.info('공고 슬롯 시간 일괄 변경 완료', {
        jobPostingId: input.jobPostingId,
        updated: result.updated,
      });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '공고 슬롯 시간 일괄 변경', table: TABLE });
      // handleSupabaseError 는 반드시 throw 한다 — 타입 좁히기용 도달 불가 분기.
      throw error;
    }
  }
}

/**
 * `update_posting_slot_time` 이 RAISE 한 도메인 에러를 앱 에러로 변환.
 * (매칭되지 않으면 null → 공통 핸들러로 위임)
 *
 * 서버 메시지는 `CODE: 사용자 문구` 형식이라 접두사를 떼어 그대로 노출한다 —
 * 같은 문구를 클라와 서버 두 곳에서 관리하면 조용히 갈라진다(`updateSlot` 과 동일 관용구).
 */
function toPostingSlotTimeError(error: unknown): AppError | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  const userMessage = (fallback: string): string => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };

  // 🔑 N건을 도는 RPC 라 단건보다 데드락 창이 넓다. 재시도하면 성공하는 실패이므로
  //    '알 수 없는 오류'로 뭉개지 말고 사용자에게 재시도할 이유를 알린다.
  if (code === '40P01' || message.includes('deadlock detected')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '다른 작업과 겹쳤어요. 잠시 후 다시 시도해주세요.',
    });
  }

  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: userMessage('권한이 있는 공고의 근무 시간만 변경할 수 있습니다'),
    });
  }
  // 🔑 목록을 띄운 뒤 다른 사람이 그 슬롯을 바꾸면 여기로 온다 — 화면이 낡았다는 뜻이므로
  //    "다시 불러오라"고 말해야 한다. 사용자가 잘못 고른 것이 아니다.
  if (message.includes('SLOT_MISMATCH')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '선택한 인원의 근무 정보가 그 사이 바뀌었어요. 새로고침 후 다시 시도해주세요.',
    });
  }
  if (message.includes('JOB_POSTING_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다',
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다',
    });
  }
  if (message.includes('INVALID_INPUT')) {
    return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: userMessage('변경 요청이 올바르지 않습니다'),
    });
  }
  return null;
}
