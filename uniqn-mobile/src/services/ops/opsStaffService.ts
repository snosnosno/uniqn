/**
 * ops 스태프 로스터(1e) 서비스 — 쓰기 5종(공고연결/스냅샷임포트/수동추가/제거/테이블배정)을
 * Repository 로 위임(기존 opsParticipantService 문형). 검증은 Repository→RPC(SECDEF) 경계에서
 * 이미 수행되므로 여기선 인자 조립 + 로깅 + 에러 통과가 책임의 전부다.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsStaffRepository } from '@/repositories/ops';
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
