/**
 * ops 모니터 서비스 (1c-3) — 모니터 토큰 발급/회전 위임.
 * 검증할 텍스트 입력 없음(식별자/불리언만) → Zod 없이 Repository(SECDEF RPC) 위임.
 * 스냅샷 조회(getSnapshot)는 읽기전용 → 훅이 Repository 직접 호출(Service 불요).
 */
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsMonitorRepository } from '@/repositories/ops';

const COMPONENT = 'opsMonitorService';

/** 모니터 토큰 발급/회전(멱등). force=true 면 강제 재발급(유출 대응). 발급된 토큰 반환. */
export async function rotateToken(
  tournamentId: string,
  actorId: string,
  force = false
): Promise<string> {
  try {
    return await opsMonitorRepository.rotateToken(tournamentId, actorId, force);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '모니터 토큰 발급', component: COMPONENT });
  }
}
