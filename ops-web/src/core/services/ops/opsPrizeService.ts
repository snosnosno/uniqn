// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/services/ops/opsPrizeService.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/**
 * ops 상금 서비스 — 조회 + 구조 일괄 저장(Zod 검증 경유).
 */
import { logger } from '@/lib/logger';
import { handleServiceError } from '@/core/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/core/errors/AppError';
import { opsPrizeRepository } from '@/core/repositories/ops';
import { prizeStructureSchema, type PrizeStructureInput } from '@/core/schemas/opsPrize.schema';
import type { OpsPrize } from '@/core/types/ops';

const COMPONENT = 'opsPrizeService';

export async function listPrizes(tournamentId: string): Promise<OpsPrize[]> {
  try {
    return await opsPrizeRepository.list(tournamentId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 목록',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}

export async function setPrizeStructure(
  tournamentId: string,
  actorId: string,
  prizes: PrizeStructureInput
): Promise<{ count: number }> {
  try {
    const parsed = prizeStructureSchema.safeParse(prizes);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message;
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: first ?? '상금 구조를 확인해 주세요.',
      });
    }
    logger.info('ops 상금 구조 저장', {
      component: COMPONENT,
      tournamentId,
      count: parsed.data.length,
    });
    return await opsPrizeRepository.setStructure(tournamentId, actorId, parsed.data);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 구조 저장',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}
