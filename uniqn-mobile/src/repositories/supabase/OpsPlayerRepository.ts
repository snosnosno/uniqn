import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPlayerRepository } from '../interfaces/IOpsPlayerRepository';
import type { OpsPlayerView, OpsPlayerCredentials } from '@/types/ops';

// ── RPC 응답 경계 검증 (인증 토큰·금전 경로) ────────────────────────────────
// 생성타입에 1c 테이블 미반영 → unknown 경유하던 자리를, 앱이 실제 소비하는 핵심
// 필드만 얇게 parse 한다. passthrough 로 나머지 필드는 그대로 통과(DB 필드 추가에도 불변).

const playerViewLevelSchema = z
  .object({ durationSec: z.number(), isBreak: z.boolean() })
  .passthrough();

/** ops_get_player_view 응답 경계 스키마 — 본인 안전필드 + 클럭 타이밍 핵심. */
export const opsPlayerViewResponseSchema = z
  .object({
    me: z
      .object({
        entryNumber: z.number(),
        name: z.string(),
        status: z.string(),
        chips: z.number(),
      })
      .passthrough(),
    tournament: z.object({ name: z.string(), status: z.string() }).passthrough(),
    clock: z
      .object({
        levelStartedAt: z.string().nullable(),
        isRunning: z.boolean(),
        pausedRemainingSec: z.number().nullable(),
      })
      .passthrough(),
    currentLevel: playerViewLevelSchema.nullable(),
    stats: z.object({ playing: z.number(), entries: z.number() }).passthrough(),
    nextBreak: z.object({}).passthrough().nullable(),
    serverNow: z.string(),
  })
  .passthrough();

/** ops_issue_player_credentials 응답 경계 스키마 — 자격증명 3필드(빈값 방지). */
export const opsPlayerCredentialsResponseSchema = z
  .object({
    participantId: z.string().optional(),
    viewToken: z.string().min(1),
    claimPin: z.string().min(1),
  })
  .passthrough();

/**
 * ops 공개 플레이어뷰 Repository (claim 토큰 분리).
 * getPlayerView 만 anon GRANT(본인 안전필드 화이트리스트). issue/claim 은 authed.
 */
export class SupabaseOpsPlayerRepository implements IOpsPlayerRepository {
  async getPlayerView(viewToken: string): Promise<OpsPlayerView> {
    try {
      const { data, error } = await supabase.rpc('ops_get_player_view', {
        p_view_token: viewToken,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
      // RPC 가 camelCase jsonb(본인 안전필드)로 직접 반환 → toCamelCase 불요.
      // 경계 검증: 생성타입 미반영 unknown 을 얇게 parse(passthrough — 필드 strip 없음).
      const parsed = opsPlayerViewResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '플레이어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요',
        });
      }
      return parsed.data as unknown as OpsPlayerView;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
    }
  }

  async issuePlayerCredentials(
    participantId: string,
    actorId: string
  ): Promise<OpsPlayerCredentials> {
    try {
      const { data, error } = await supabase.rpc('ops_issue_player_credentials', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 플레이어 자격 발급' });
      // 경계 검증: viewToken/claimPin 비어있으면 parse 실패 → 수동 빈값 체크를 대체.
      const parsed = opsPlayerCredentialsResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '자격증명 발급에 실패했습니다. 잠시 후 다시 시도해주세요',
        });
      }
      const r = parsed.data;
      return {
        participantId: r.participantId ?? participantId,
        viewToken: r.viewToken,
        claimPin: r.claimPin,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 플레이어 자격 발급' });
    }
  }

  async claimParticipant(viewToken: string, claimPin: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_claim_participant', {
        p_view_token: viewToken,
        p_claim_pin: claimPin,
        p_user_id: userId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    }
  }
}
