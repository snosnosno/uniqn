/**
 * ops 참가자 서비스 — 워크인 등록(검증) + 리바이/애드온 위임.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsParticipantRepository, type RegisterParticipantInput } from '@/repositories/ops';
import { registerParticipantSchema } from '@/schemas/opsParticipant.schema';
import { prizeCorrectionSchema, type PrizeCorrectionInput } from '@/schemas/opsPrize.schema';
import { UUID_LIKE_RE } from '@/schemas/common';

const COMPONENT = 'opsParticipantService';

export async function registerParticipant(
  input: RegisterParticipantInput,
  actorId: string
): Promise<{ participantId: string; entryNumber: number }> {
  try {
    logger.info('ops 참가자 등록', { component: COMPONENT, tournamentId: input.tournamentId });
    const parsed = registerParticipantSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.registerWithEvent(input, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '참가자 등록',
      component: COMPONENT,
      context: { tournamentId: input.tournamentId },
    });
  }
}

export async function addRebuy(participantId: string, actorId: string): Promise<void> {
  try {
    logger.info('ops 리바이', { component: COMPONENT, participantId });
    await opsParticipantRepository.addRebuy(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '리바이',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function addAddon(participantId: string, actorId: string): Promise<void> {
  try {
    logger.info('ops 애드온', { component: COMPONENT, participantId });
    await opsParticipantRepository.addAddon(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '애드온',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function bustParticipant(
  participantId: string,
  actorId: string,
  eliminatorId?: string | null
) {
  try {
    logger.info('ops 탈락 처리', { component: COMPONENT, participantId });
    // 🔨H2: eliminatorId 그룹형 uuid 경계 가드(무검증 시 비-uuid 가 22P02 → INFRA_NOT_FOUND 오도).
    // 빈 문자열도 명시 검사(truthy 체크는 '' 를 통과시켜 RPC 22P02 유발).
    if (eliminatorId !== null && eliminatorId !== undefined && !UUID_LIKE_RE.test(eliminatorId)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '넉아웃 상대 식별자가 올바르지 않아요.',
      });
    }
    return await opsParticipantRepository.bustParticipant(participantId, actorId, eliminatorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '탈락 처리',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function undoBust(participantId: string, actorId: string) {
  try {
    logger.info('ops 탈락 취소', { component: COMPONENT, participantId });
    return await opsParticipantRepository.undoBust(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '탈락 취소',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function correctPrize(input: PrizeCorrectionInput, actorId: string) {
  try {
    logger.info('ops 상금 정정', { component: COMPONENT, participantId: input.participantId });
    const parsed = prizeCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.correctPrize(
      parsed.data.participantId,
      actorId,
      parsed.data.amount,
      parsed.data.reason ?? null
    );
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 정정',
      component: COMPONENT,
      context: { participantId: input.participantId },
    });
  }
}

export async function reenterParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 재진입', { component: COMPONENT, participantId });
    return await opsParticipantRepository.reenterParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '재진입',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

/** S1 C4: 상금 지급 마킹(undo-first — paid=false 로 왕복 취소, 서버 멱등). */
export async function setPrizePaid(participantId: string, actorId: string, paid: boolean) {
  try {
    logger.info('ops 상금 지급 마킹', { component: COMPONENT, participantId, paid });
    return await opsParticipantRepository.setPrizePaid(participantId, actorId, paid);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 지급 마킹',
      component: COMPONENT,
      context: { participantId },
    });
  }
}
