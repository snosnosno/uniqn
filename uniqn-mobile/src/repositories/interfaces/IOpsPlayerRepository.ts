import type { OpsPlayerView } from '@/types/ops';

/**
 * ops 공개 플레이어뷰 Repository (1c-4).
 * getPlayerView 는 anon SECDEF RPC(본인 안전필드 투영) — claim_token capability.
 * issueClaimToken 은 운영자 전용(QR 발급), claimParticipant 는 플레이어 본인 1회 바인딩.
 */
export interface IOpsPlayerRepository {
  /** 공개 플레이어뷰. 토큰 무효 시 AppError(OPS_CLAIM_TOKEN_INVALID). */
  getPlayerView(claimToken: string): Promise<OpsPlayerView>;
  /** claim_token 발급/회전(멱등, 운영자). claimToken 반환. */
  issueClaimToken(participantId: string, actorId: string): Promise<string>;
  /** 본인 계정 1회 바인딩(플레이어). 이미 타계정 연결 시 OPS_CLAIM_ALREADY_CLAIMED. */
  claimParticipant(claimToken: string, userId: string): Promise<void>;
}
