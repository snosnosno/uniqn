/**
 * ops 참가자 서비스 — 워크인 등록(검증) + 리바이/애드온 위임.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsParticipantRepository, type RegisterParticipantInput } from '@/repositories/ops';
import { registerParticipantSchema } from '@/schemas/opsParticipant.schema';

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
