import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPlayerRepository } from '../interfaces/IOpsPlayerRepository';
import type { OpsPlayerView, OpsPlayerCredentials } from '@/types/ops';

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
      return data as unknown as OpsPlayerView;
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
      const r = data as unknown as OpsPlayerCredentials | null;
      if (!r?.viewToken || !r?.claimPin) {
        throw new Error('ops_issue_player_credentials: 빈 자격증명을 반환했습니다');
      }
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
