/**
 * ops 대회 서비스 — 경계 검증(zod) + 로깅 + Repository 위임. Supabase 직접 호출 금지.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import {
  opsTournamentRepository,
  type CreateOpsTournamentInput,
  type UpdateOpsTournamentPatch,
} from '@/repositories/ops';
import {
  createOpsTournamentSchema,
  updateOpsTournamentSchema,
} from '@/schemas/opsTournament.schema';
import type { OpsTournamentStatus } from '@/types/ops';

const COMPONENT = 'opsTournamentService';

function firstZodMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): string {
  const first = Object.values(error.flatten().fieldErrors).flat()[0];
  return typeof first === 'string' ? first : '입력값을 확인해 주세요.';
}

export async function createTournament(
  input: CreateOpsTournamentInput,
  actorId: string
): Promise<{ tournamentId: string }> {
  try {
    logger.info('ops 대회 생성', { component: COMPONENT, actorId });
    const parsed = createOpsTournamentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: firstZodMessage(parsed.error),
      });
    }
    return await opsTournamentRepository.createWithEvent(input, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '대회 생성',
      component: COMPONENT,
      context: { actorId },
    });
  }
}

export async function updateTournament(
  id: string,
  actorId: string,
  patch: UpdateOpsTournamentPatch
): Promise<void> {
  try {
    logger.info('ops 대회 수정', { component: COMPONENT, id });
    const parsed = updateOpsTournamentSchema.safeParse(patch);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: firstZodMessage(parsed.error),
      });
    }
    await opsTournamentRepository.updateTournament(id, actorId, patch);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '대회 수정',
      component: COMPONENT,
      context: { id },
    });
  }
}

export async function setTournamentStatus(
  id: string,
  actorId: string,
  status: OpsTournamentStatus
): Promise<void> {
  try {
    logger.info('ops 대회 상태 변경', { component: COMPONENT, id, status });
    await opsTournamentRepository.setStatus(id, actorId, status);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '대회 상태 변경',
      component: COMPONENT,
      context: { id },
    });
  }
}

/** S1 A4: 지난 대회 복제 — 설정·블라인드 구조·monitor_config 복사(owner 전용, 서버 RPC). */
export async function duplicateTournament(
  sourceTournamentId: string,
  actorId: string,
  options?: { name?: string; eventDate?: string }
): Promise<{ tournamentId: string }> {
  try {
    logger.info('ops 대회 복제', { component: COMPONENT, sourceTournamentId });
    return await opsTournamentRepository.duplicateTournament(sourceTournamentId, actorId, options);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '대회 복제',
      component: COMPONENT,
      context: { sourceTournamentId },
    });
  }
}

/** S1 C6: TV 모니터 구성 저장(owner 전용). null = 기본값 복귀. 서버가 화이트리스트 검증(P0001). */
export async function setMonitorConfig(
  id: string,
  actorId: string,
  config: { v: 1; preset: string; slots: (string | null)[] } | null
): Promise<void> {
  try {
    logger.info('ops TV 모니터 구성 저장', { component: COMPONENT, id });
    await opsTournamentRepository.setMonitorConfig(id, actorId, config);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: 'TV 모니터 구성 저장',
      component: COMPONENT,
      context: { id },
    });
  }
}

export async function toggleRegistration(
  id: string,
  actorId: string,
  open: boolean
): Promise<void> {
  try {
    logger.info('ops 등록 토글', { component: COMPONENT, id, open });
    await opsTournamentRepository.toggleRegistration(id, actorId, open);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '등록 토글',
      component: COMPONENT,
      context: { id },
    });
  }
}
