/**
 * ops 테이블 서비스 — 추가(검증) + 잠금/우선순위/닫기(위임).
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsTableRepository, type AddTableInput } from '@/repositories/ops';
import { addTableSchema } from '@/schemas/opsSeat.schema';
import type { OpsTableStatus, OpsTableLockType } from '@/types/ops';

const COMPONENT = 'opsTableService';

export async function addTable(
  input: AddTableInput,
  actorId: string
): Promise<{ tableId: string; tableNo: number }> {
  try {
    logger.info('ops 테이블 추가', { component: COMPONENT, tournamentId: input.tournamentId });
    const parsed = addTableSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsTableRepository.addTable(input, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '테이블 추가', component: COMPONENT });
  }
}

export async function setLock(
  tableId: string,
  actorId: string,
  lockType: OpsTableLockType
): Promise<void> {
  try {
    await opsTableRepository.setLock(tableId, actorId, lockType);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '테이블 잠금', component: COMPONENT });
  }
}

export async function setPriority(
  tableId: string,
  actorId: string,
  priority: number | null
): Promise<void> {
  try {
    await opsTableRepository.setPriority(tableId, actorId, priority);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '테이블 우선순위', component: COMPONENT });
  }
}

export async function closeTable(
  tableId: string,
  actorId: string,
  status: OpsTableStatus
): Promise<void> {
  try {
    await opsTableRepository.closeTable(tableId, actorId, status);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '테이블 닫기', component: COMPONENT });
  }
}
