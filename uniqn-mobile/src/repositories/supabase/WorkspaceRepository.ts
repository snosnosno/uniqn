/**
 * UNIQN Mobile - Supabase Workspace Repository
 *
 * @description 공고 워크스페이스 (PR #2)
 *              - workspaces 테이블 CRUD
 *              - RLS 가 권한 강제 (workspaces_select_owner_or_member, _insert_employer_with_cap, _update_owner)
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapWorkspaceRpcError } from '@/errors/workspace';
import type { Workspace } from '@/types/workspace';
import type { IWorkspaceRepository } from '../interfaces/IWorkspaceRepository';

const TABLE = 'workspaces' as const;
const COLUMNS = 'id, name, owner_id, member_count, created_at, updated_at' as const;

function rowToWorkspace(row: Record<string, unknown>): Workspace {
  return toCamelCase<Workspace>(row);
}

export class SupabaseWorkspaceRepository implements IWorkspaceRepository {
  /**
   * 워크스페이스 생성 — RPC `create_workspace` 경유.
   *
   * SECURITY DEFINER + public.users.role 조회로 JWT staleness 우회.
   * (Edge Function 사후 setRole + refreshSession 누락으로 client JWT 의 app_metadata.role 이
   *  비어 있어도 동작 — 2026-05-09 root cause fix)
   *
   * RPC 에러 코드:
   *   AUTH_REQUIRED         → AppError E1
   *   PERMISSION_DENIED     → AppError E5
   *   VALIDATION_REQUIRED   → AppError E3
   *   WORKSPACE_CAP_REACHED → BusinessError E6090
   */
  async create(name: string): Promise<Workspace> {
    try {
      logger.info('워크스페이스 생성 시작', { name });

      const { data, error } = await supabase.rpc('create_workspace', { p_name: name });

      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '워크스페이스 생성', table: TABLE });
      }

      const row = data as Record<string, unknown> | null;
      if (!row) {
        handleSupabaseError(new Error('create_workspace returned null'), {
          operation: '워크스페이스 생성',
          table: TABLE,
        });
      }

      logger.info('워크스페이스 생성 완료', { workspaceId: row!.id });
      return rowToWorkspace(row!);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 생성', table: TABLE });
    }
  }

  async findById(id: string): Promise<Workspace | undefined> {
    try {
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '워크스페이스 조회', table: TABLE });
      }
      return data ? rowToWorkspace(data as Record<string, unknown>) : undefined;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 조회', table: TABLE });
    }
  }

  /**
   * "내가 멤버인 모든 워크스페이스" — owner OR editor.
   * RLS workspaces_select_owner_or_member 가 자동으로 필터링하므로 select * 만 호출.
   */
  async findAllByMember(_userId: string): Promise<Workspace[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .order('created_at', { ascending: true });

      if (error) {
        handleSupabaseError(error, { operation: '워크스페이스 목록 조회', table: TABLE });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(rowToWorkspace);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 목록 조회', table: TABLE });
    }
  }

  async updateName(id: string, name: string): Promise<Workspace> {
    try {
      logger.info('워크스페이스 이름 변경', { workspaceId: id });

      const { data, error } = await supabase
        .from(TABLE)
        .update({ name })
        .eq('id', id)
        .select(COLUMNS)
        .single();

      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '워크스페이스 이름 변경', table: TABLE });
      }

      return rowToWorkspace(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 이름 변경', table: TABLE });
    }
  }

  async getOwnerProfile(
    workspaceId: string
  ): Promise<{ id: string; displayName: string | null; photoUrl: string | null } | null> {
    try {
      const { data, error } = await supabase.rpc('get_workspace_owner_profile', {
        _workspace_id: workspaceId,
      });

      if (error) {
        handleSupabaseError(error, { operation: '워크스페이스 소유자 조회', table: TABLE });
      }

      const rows = (data ?? []) as {
        id: string;
        nickname: string | null;
        name: string | null;
        photo_url: string | null;
      }[];
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        id: row.id,
        displayName: row.nickname ?? row.name ?? null,
        photoUrl: row.photo_url ?? null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 소유자 조회', table: TABLE });
    }
  }
}

export const workspaceRepository = new SupabaseWorkspaceRepository();
