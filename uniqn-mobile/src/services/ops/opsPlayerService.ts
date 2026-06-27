/**
 * ops 플레이어 서비스 (1c-4) — claim 토큰 발급(운영자) + 본인 바인딩(플레이어) 위임.
 * 검증할 텍스트 입력 없음(식별자/토큰만) → Zod 없이 Repository(SECDEF RPC) 위임.
 * 플레이어뷰 조회(getPlayerView)는 읽기전용 → 훅이 Repository 직접 호출.
 */
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsPlayerRepository } from '@/repositories/ops';

const COMPONENT = 'opsPlayerService';

/** claim_token 발급/회전(멱등, 운영자). 발급된 토큰 반환. */
export async function issueClaimToken(participantId: string, actorId: string): Promise<string> {
  try {
    return await opsPlayerRepository.issueClaimToken(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: 'claim 토큰 발급', component: COMPONENT });
  }
}

/** 본인 계정 1회 바인딩(플레이어). */
export async function claimParticipant(claimToken: string, userId: string): Promise<void> {
  try {
    await opsPlayerRepository.claimParticipant(claimToken, userId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '참가자 클레임', component: COMPONENT });
  }
}
