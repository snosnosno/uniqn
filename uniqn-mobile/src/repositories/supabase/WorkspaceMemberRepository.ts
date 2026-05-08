/**
 * UNIQN Mobile - Supabase Workspace Member Repository
 *
 * @description 공고 워크스페이스 멤버 (PR #2)
 *              - editor 멤버만 (D2: owner는 workspaces.owner_id 단독)
 *              - INSERT/UPDATE/DELETE 는 RPC 우회 (accept_workspace_invitation, remove_workspace_member)
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import { mapWorkspaceRpcError } from '@/errors/workspace';
import type { WorkspaceMemberWithUser } from '@/types/workspace';
import type { IWorkspaceMemberRepository } from '../interfaces/IWorkspaceRepository';

const TABLE = 'workspace_members' as const;

interface MemberJoinRow {
  workspace_id: string;
  user_id: string;
  role: 'editor';
  invited_by: string | null;
  joined_at: string;
  users: {
    nickname: string | null;
    name: string | null;
    email: string | null;
    photo_url: string | null;
  } | null;
}

function rowToMemberWithUser(row: MemberJoinRow): WorkspaceMemberWithUser {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by ?? null,
    joinedAt: row.joined_at,
    displayName: row.users?.nickname ?? row.users?.name ?? null,
    email: row.users?.email ?? null,
    photoUrl: row.users?.photo_url ?? null,
  };
}

export class SupabaseWorkspaceMemberRepository implements IWorkspaceMemberRepository {
  async findByWorkspaceWithUser(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'workspace_id, user_id, role, invited_by, joined_at, users:user_id (nickname, name, email, photo_url)'
        )
        .eq('workspace_id', workspaceId)
        .order('joined_at', { ascending: true });

      if (error) {
        handleSupabaseError(error, { operation: '멤버 목록 조회', table: TABLE });
      }

      return ((data ?? []) as unknown as MemberJoinRow[]).map(rowToMemberWithUser);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '멤버 목록 조회', table: TABLE });
    }
  }

  async findWorkspaceIdsForUser(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('workspace_id')
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '내 워크스페이스 ID 조회', table: TABLE });
      }
      return (data ?? []).map((r) => (r as { workspace_id: string }).workspace_id);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '내 워크스페이스 ID 조회', table: TABLE });
    }
  }

  async removeViaRpc(workspaceId: string, userId: string): Promise<void> {
    try {
      logger.info('멤버 제거 RPC', { workspaceId, userId });
      const { data, error } = await supabase.rpc('remove_workspace_member', {
        p_workspace_id: workspaceId,
        p_user_id: userId,
      });

      // supabase-js: 에러는 error 또는 data 응답 패턴 둘 다 가능
      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '멤버 제거', table: TABLE });
      }
      // void RPC 는 data 를 사용하지 않음
      void data;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '멤버 제거', table: TABLE });
    }
  }
}

export const workspaceMemberRepository = new SupabaseWorkspaceMemberRepository();
