// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/services/ops/opsPlayerService.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/**
 * ops 플레이어 서비스 (claim 토큰 분리) — 자격 발급(운영자) + 본인 바인딩(플레이어) 위임.
 * 검증할 자유텍스트 없음(식별자/토큰/PIN). PIN 형식은 DB RPC가 강제.
 */
import { handleServiceError } from '@/core/errors/serviceErrorHandler';
import { isAppError } from '@/core/errors/AppError';
import { opsPlayerRepository } from '@/core/repositories/ops';
import type { OpsPlayerCredentials } from '@/core/types/ops';

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
