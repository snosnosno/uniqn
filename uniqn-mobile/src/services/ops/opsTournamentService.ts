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
