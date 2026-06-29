import type { OpsPlayerView, OpsPlayerCredentials } from '@/types/ops';

/**
 * ops 공개 플레이어뷰 Repository (claim 토큰 분리).
 * getPlayerView 는 anon SECDEF RPC(본인 안전필드 투영) — view_token capability.
 * issuePlayerCredentials 는 운영자(view_token+PIN 발급/로테이트), claimParticipant 는 플레이어 본인 1회 바인딩(PIN 게이트).
 */
export interface IOpsPlayerRepository {
  /** 공개 플레이어뷰. 토큰 무효 시 AppError(OPS_VIEW_TOKEN_INVALID). */
  getPlayerView(viewToken: string): Promise<OpsPlayerView>;
  /** view_token(멱등) + 새 PIN(로테이트) 발급(운영자). 평문 PIN 1회 반환. */
  issuePlayerCredentials(participantId: string, actorId: string): Promise<OpsPlayerCredentials>;
  /** 본인 계정 1회 바인딩(플레이어, PIN 게이트). 오답 시 OPS_CLAIM_PIN_INVALID. */
  claimParticipant(viewToken: string, claimPin: string, userId: string): Promise<void>;
}
