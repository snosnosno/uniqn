/**
 * ops 클럭 서비스 — 시작/일시정지/레벨이동/보정 위임 (1c).
 * 검증할 텍스트 입력 없음(숫자/식별자만) → Zod 없이 Repository(SECDEF RPC) 위임.
 */
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsClockRepository } from '@/repositories/ops';

const COMPONENT = 'opsClockService';

export async function start(tournamentId: string, actorId: string): Promise<void> {
  try {
    await opsClockRepository.start(tournamentId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '클럭 시작', component: COMPONENT });
  }
}

export async function pause(tournamentId: string, actorId: string): Promise<void> {
  try {
    await opsClockRepository.pause(tournamentId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '클럭 일시정지', component: COMPONENT });
  }
}

export async function setLevel(tournamentId: string, actorId: string, sort: number): Promise<void> {
  try {
    await opsClockRepository.setLevel(tournamentId, actorId, sort);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '클럭 레벨 이동', component: COMPONENT });
  }
}

export async function adjust(
  tournamentId: string,
  actorId: string,
  deltaSec: number
): Promise<void> {
  try {
    await opsClockRepository.adjust(tournamentId, actorId, deltaSec);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '클럭 보정', component: COMPONENT });
  }
}
