// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/services/ops/opsBlindLevelService.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/**
 * ops 블라인드 레벨 서비스 — 전체교체(Zod 검증 후 위임) (1c).
 */
import { logger } from '@/lib/logger';
import { handleServiceError } from '@/core/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/core/errors/AppError';
import { opsBlindLevelRepository } from '@/core/repositories/ops';
import { opsBlindLevelsSchema, type OpsBlindLevelInput } from '@/core/schemas/opsBlindLevel.schema';

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
