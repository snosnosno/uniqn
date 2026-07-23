/**
 * 블라인드 프리셋 서비스 (계획 B) — 시스템 경계 입력 검증 후 Repository 위임.
 * name 은 자유 텍스트 사용자 입력 → trim·길이·XSS refine. levels 는 블라인드 구조 스키마 재사용.
 */
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';
import { opsBlindLevelsSchema } from '@/schemas/opsBlindLevel.schema';
import { opsBlindPresetRepository } from '@/repositories/ops';

const COMPONENT = 'opsBlindPresetService';

const presetNameSchema = z
  .string()
  .trim()
  .min(1, { message: '프리셋 이름을 입력해주세요' })
  .max(60, { message: '프리셋 이름은 60자 이하로 입력해주세요' })
  .refine(xssValidation, { message: '이름에 사용할 수 없는 문자가 포함되어 있습니다' });

/** 프리셋 저장(신규) — 이름·레벨 검증 후 저장. 생성 id 반환. */
export async function save(actorId: string, name: string, levels: unknown): Promise<string> {
  try {
    const parsedName = presetNameSchema.safeParse(name);
    if (!parsedName.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: parsedName.error.issues[0]?.message ?? '프리셋 이름을 확인해 주세요.',
      });
    }
    const parsedLevels = opsBlindLevelsSchema.safeParse(levels);
    if (!parsedLevels.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: parsedLevels.error.issues[0]?.message ?? '블라인드 레벨 입력을 확인해 주세요.',
      });
    }
    logger.info('ops 블라인드 프리셋 저장', {
      component: COMPONENT,
      count: parsedLevels.data.length,
    });
    return await opsBlindPresetRepository.save(actorId, parsedName.data, parsedLevels.data);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '블라인드 프리셋 저장', component: COMPONENT });
  }
}

/** 프리셋 삭제. */
export async function remove(actorId: string, presetId: string): Promise<void> {
  try {
    logger.info('ops 블라인드 프리셋 삭제', { component: COMPONENT, presetId });
    await opsBlindPresetRepository.remove(actorId, presetId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '블라인드 프리셋 삭제', component: COMPONENT });
  }
}
