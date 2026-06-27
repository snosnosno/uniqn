/**
 * ops 블라인드 레벨 서비스 — 전체교체(Zod 검증 후 위임) (1c).
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsBlindLevelRepository } from '@/repositories/ops';
import { opsBlindLevelsSchema, type OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

const COMPONENT = 'opsBlindLevelService';

export async function setLevels(
  tournamentId: string,
  actorId: string,
  levels: readonly OpsBlindLevelInput[]
): Promise<{ count: number; reanchored: boolean }> {
  try {
    logger.info('ops 블라인드 설정', { component: COMPONENT, tournamentId, count: levels.length });
    const parsed = opsBlindLevelsSchema.safeParse(levels);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message;
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '블라인드 레벨 입력을 확인해 주세요.',
      });
    }
    return await opsBlindLevelRepository.setLevels(tournamentId, actorId, parsed.data);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '블라인드 설정',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}
