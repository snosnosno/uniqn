/**
 * ops 플레이어 서비스 (claim 토큰 분리) — 자격 발급(운영자) + 본인 바인딩(플레이어) 위임.
 * 검증할 자유텍스트 없음(식별자/토큰/PIN). PIN 형식은 DB RPC가 강제.
 */
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsPlayerRepository } from '@/repositories/ops';
import type { OpsPlayerCredentials } from '@/types/ops';

const COMPONENT = 'opsPlayerService';

/** view_token(멱등) + PIN(로테이트) 발급(운영자). 평문 PIN 1회 반환. */
export async function issuePlayerCredentials(
  participantId: string,
  actorId: string
): Promise<OpsPlayerCredentials> {
  try {
    return await opsPlayerRepository.issuePlayerCredentials(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '플레이어 자격 발급', component: COMPONENT });
  }
}

/** 본인 계정 1회 바인딩(플레이어, PIN 게이트). */
export async function claimParticipant(
  viewToken: string,
  claimPin: string,
  userId: string
): Promise<void> {
  try {
    await opsPlayerRepository.claimParticipant(viewToken, claimPin, userId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '참가자 클레임', component: COMPONENT });
  }
}
