import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPlayerRepository } from '../interfaces/IOpsPlayerRepository';
import type { OpsPlayerView } from '@/types/ops';

/**
 * ops 공개 플레이어뷰 Repository (1c-4).
 * getPlayerView 만 anon GRANT(본인 안전필드 화이트리스트 투영). issue/claim 은 authed.
 * 생성타입 미반영 RPC → 느슨타입 rpc(§0.5 B5).
 */
export class SupabaseOpsPlayerRepository implements IOpsPlayerRepository {
  async getPlayerView(claimToken: string): Promise<OpsPlayerView> {
    try {
      const { data, error } = await supabase.rpc('ops_get_player_view', {
        p_claim_token: claimToken,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
      // RPC 가 camelCase jsonb(본인 안전필드)로 직접 반환 → toCamelCase 불요.
      return data as unknown as OpsPlayerView;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
    }
  }

  async issueClaimToken(participantId: string, actorId: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('ops_issue_claim_token', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops claim 토큰 발급' });
      return (data as unknown as { claimToken: string } | null)?.claimToken ?? '';
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops claim 토큰 발급' });
    }
  }

  async claimParticipant(claimToken: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_claim_participant', {
        p_claim_token: claimToken,
        p_user_id: userId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    }
  }
}
