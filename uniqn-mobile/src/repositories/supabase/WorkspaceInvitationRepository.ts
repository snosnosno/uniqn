/**
 * UNIQN Mobile - Supabase Workspace Invitation Repository
 *
 * @description 공고 워크스페이스 초대 (PR #2)
 *              - invite/accept/reject/revoke 는 SECURITY DEFINER RPC 경유 (atomic + 권한 체크)
 *              - SELECT 는 RLS workspace_invitations_select_relevant 필터링 적용
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, BusinessError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapWorkspaceRpcError, WORKSPACE_ERROR_CODES } from '@/errors/workspace';
import type {
  WorkspaceInvitation,
  ReceivedWorkspaceInvitation,
  AcceptInvitationResult,
} from '@/types/workspace';
import type { IWorkspaceInvitationRepository } from '../interfaces/IWorkspaceRepository';

const TABLE = 'workspace_invitations' as const;
const COLUMNS =
  'id, workspace_id, invitee_user_id, role, invited_by, status, expires_at, created_at, responded_at' as const;

function rowToInvitation(row: Record<string, unknown>): WorkspaceInvitation {
  return toCamelCase<WorkspaceInvitation>(row);
}

interface PendingJoinRow {
  id: string;
  workspace_id: string;
  invitee_user_id: string;
  role: 'editor';
  invited_by: string;
  status: WorkspaceInvitation['status'];
  expires_at: string;
  created_at: string;
  responded_at: string | null;
  workspaces: { name: string } | null;
  inviter: { nickname: string | null; name: string | null } | null;
}

function rowToReceivedInvitation(row: PendingJoinRow): ReceivedWorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    inviteeUserId: row.invitee_user_id,
    role: row.role,
    invitedBy: row.invited_by,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? null,
    workspaceName: row.workspaces?.name ?? '',
    inviterDisplayName: row.inviter?.nickname ?? row.inviter?.name ?? null,
  };
}

export class SupabaseWorkspaceInvitationRepository implements IWorkspaceInvitationRepository {
  async inviteViaRpc(workspaceId: string, inviteeUserId: string): Promise<string> {
    try {
      logger.info('워크스페이스 초대 RPC', { workspaceId, inviteeUserId });
      const { data, error } = await supabase.rpc('invite_workspace_member', {
        p_workspace_id: workspaceId,
        p_invitee_user_id: inviteeUserId,
      });

      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '워크스페이스 초대', table: TABLE });
      }

      const invitationId = data as string | null;
      if (!invitationId) {
        throw new BusinessError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_NOT_FOUND, {
          userMessage: '초대 발송에 실패했습니다.',
        });
      }
      return invitationId;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 초대', table: TABLE });
    }
  }

  async acceptViaRpc(invitationId: string): Promise<AcceptInvitationResult> {
    try {
      logger.info('워크스페이스 초대 수락 RPC', { invitationId });
      const { data, error } = await supabase.rpc('accept_workspace_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '초대 수락', table: TABLE });
      }

      const payload = (data ?? {}) as {
        invitationId?: string;
        workspaceId?: string;
        idempotent?: boolean;
      };
      if (!payload.invitationId || !payload.workspaceId) {
        throw new BusinessError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_NOT_FOUND, {
          userMessage: '초대 응답을 처리하지 못했습니다.',
        });
      }
      return {
        invitationId: payload.invitationId,
        workspaceId: payload.workspaceId,
        idempotent: Boolean(payload.idempotent),
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '초대 수락', table: TABLE });
    }
  }

  async rejectViaRpc(invitationId: string): Promise<void> {
    try {
      logger.info('워크스페이스 초대 거절 RPC', { invitationId });
      const { error } = await supabase.rpc('reject_workspace_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '초대 거절', table: TABLE });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '초대 거절', table: TABLE });
    }
  }

  async revokeViaRpc(invitationId: string): Promise<void> {
    try {
      logger.info('워크스페이스 초대 회수 RPC', { invitationId });
      const { error } = await supabase.rpc('revoke_workspace_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '초대 회수', table: TABLE });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '초대 회수', table: TABLE });
    }
  }

  async findPendingForUser(userId: string): Promise<ReceivedWorkspaceInvitation[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(`${COLUMNS}, workspaces:workspace_id (name), inviter:invited_by (nickname, name)`)
        .eq('invitee_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: '받은 초대 조회', table: TABLE });
      }
      return ((data ?? []) as unknown as PendingJoinRow[]).map(rowToReceivedInvitation);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '받은 초대 조회', table: TABLE });
    }
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: '워크스페이스 초대 목록 조회', table: TABLE });
      }
      return ((data ?? []) as Record<string, unknown>[]).map(rowToInvitation);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 초대 목록 조회', table: TABLE });
    }
  }
}

export const workspaceInvitationRepository = new SupabaseWorkspaceInvitationRepository();
