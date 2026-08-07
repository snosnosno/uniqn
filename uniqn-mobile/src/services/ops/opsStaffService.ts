/**
 * ops 스태프 로스터(1e) 서비스 — 쓰기 5종(공고연결/스냅샷임포트/수동추가/제거/테이블배정)을
 * Repository 로 위임(기존 opsParticipantService 문형). 검증은 Repository→RPC(SECDEF) 경계에서
 * 이미 수행되므로 여기선 인자 조립 + 로깅 + 에러 통과가 책임의 전부다.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsStaffRepository } from '@/repositories/ops';
import { updateSlot } from '@/services/workSchedule/gridWriteService';
import type { OpsStaffWorkLogLink } from '@/types/ops';
import type { StaffRole } from '@/types/role';

const COMPONENT = 'opsStaffService';

/** 대회↔공고 연결/변경/해제(jobPostingId=null). */
export async function setTournamentPosting(
  tournamentId: string,
  actorId: string,
  jobPostingId: string | null
): Promise<void> {
  try {
    logger.info('ops 대회-공고 연결', { component: COMPONENT, tournamentId });
    return await opsStaffRepository.setTournamentPosting({ tournamentId, actorId, jobPostingId });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '대회-공고 연결',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}

/** 연결된 공고의 확정 스태프(work_logs SSOT)를 스냅샷 import. date=null 이면 전체 날짜. */
export async function importFromPosting(
  tournamentId: string,
  actorId: string,
  date: string | null
): Promise<{ imported: number; skipped: number }> {
  try {
    logger.info('ops 스태프 스냅샷 임포트', { component: COMPONENT, tournamentId });
    return await opsStaffRepository.importFromPosting({ tournamentId, actorId, date });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '스태프 스냅샷 임포트',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}

/** 가입자 검색 결과 기반 로스터 수동 추가(source='manual'). */
export async function addStaff(
  tournamentId: string,
  actorId: string,
  staffId: string,
  role: StaffRole,
  customRole?: string | null
): Promise<void> {
  try {
    logger.info('ops 스태프 로스터 추가', { component: COMPONENT, tournamentId, staffId });
    return await opsStaffRepository.addStaff({
      tournamentId,
      actorId,
      staffId,
      role,
      customRole: customRole ?? null,
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '스태프 로스터 추가',
      component: COMPONENT,
      context: { tournamentId, staffId },
    });
  }
}

/** 로스터 제거 + cascade-clear(배정 중이던 테이블의 assignedStaffId 선해제, RPC 내부 처리). */
export async function removeStaff(
  tournamentId: string,
  actorId: string,
  opsStaffId: string
): Promise<void> {
  try {
    logger.info('ops 스태프 로스터 제거', { component: COMPONENT, tournamentId, opsStaffId });
    return await opsStaffRepository.removeStaff({ tournamentId, actorId, opsStaffId });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '스태프 로스터 제거',
      component: COMPONENT,
      context: { tournamentId, opsStaffId },
    });
  }
}

/**
 * 스태프별 근태 대상 work_log 해석 (결함 ⑦-2). 읽기 전용.
 * 사유 코드(`reason`)와 쓰기 가능 여부(`writeAllowed`)는 **직교**한다 — 화면은 둘 다 봐야 한다.
 */
export async function resolveWorkLogs(
  tournamentId: string,
  actorId: string
): Promise<OpsStaffWorkLogLink[]> {
  try {
    return await opsStaffRepository.resolveWorkLogs({ tournamentId, actorId });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: 'ops 근태 대상 해석',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}

/**
 * ops 콘솔에서 근태(출퇴근)를 기록·정정·취소한다 (결함 ⑦-2).
 *
 * 🔴 **여기서 `work_logs` 를 직접 PATCH 하지 않는다.** `work_logs_payroll_direct_write_block`
 *    (20260805120000)의 판별식은 payroll 4컬럼만 보므로 `check_in_ts`/`check_out_ts` 직접
 *    PATCH 는 **그냥 통과한다** — 감사·수정이력·알림·정산완료잠금을 전부 우회한 잘못된 쓰기가
 *    조용히 성공한다. 반드시 `update_work_log_slot`(SECDEF RPC)을 경유한다.
 *
 * 🔴 3상 계약을 그대로 넘긴다: `undefined`=미변경 / `null`=기록 삭제 / `Date`=기록.
 *    `??`·truthy 로 다루면 **되돌리기(삭제)가 조용히 무시된다** — 편도 문이 만들어진다.
 *
 * 대상 `workLogId` 는 반드시 `resolveWorkLogs` 가 `reason==='ok'` 로 돌려준 값이어야 한다.
 * `source_work_log_id` 나 임의로 고른 행을 넣으면 틀린 날짜·취소된 행에 시각이 박힌다.
 */
export async function recordAttendance(
  workLogId: string,
  actorId: string,
  patch: { checkIn?: Date | null; checkOut?: Date | null }
): Promise<void> {
  try {
    logger.info('ops 근태 기록', {
      component: COMPONENT,
      workLogId,
      axes: Object.keys(patch),
    });
    return await updateSlot(workLogId, {
      ...patch,
      reason: 'ops 콘솔 근태 기록',
      editedBy: actorId,
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: 'ops 근태 기록',
      component: COMPONENT,
      context: { workLogId },
    });
  }
}

/** 딜러 테이블 배정. staffId=null 이면 해제(멱등). move 시맨틱은 RPC 내부 처리. */
export async function assignTableStaff(
  tournamentId: string,
  actorId: string,
  tableId: string,
  staffId: string | null
): Promise<void> {
  try {
    logger.info('ops 테이블 딜러 배정', { component: COMPONENT, tournamentId, tableId });
    return await opsStaffRepository.assignTableStaff({ tournamentId, actorId, tableId, staffId });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '테이블 딜러 배정',
      component: COMPONENT,
      context: { tournamentId, tableId },
    });
  }
}
