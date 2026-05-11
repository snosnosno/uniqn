/**
 * UNIQN Mobile - Supabase JobPostingCollaborator Repository
 *
 * @description 공고별 협업자 (Phase 5)
 *              - 권한 강제는 RLS — Repository 는 단순 조회/쓰기 + snake↔camel 변환
 *              - searchByEmail 은 UNIQN 가입자 이메일 prefix 검색 + 상태 분류
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, BusinessError, ERROR_CODES } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import type {
  JobPostingCollaborator,
  JobPostingCollaboratorWithUser,
  SharedJobPosting,
  CollaboratorSearchCandidate,
} from '@/types/jobPostingCollaborator';
import type { IJobPostingCollaboratorRepository } from '../interfaces/IJobPostingCollaboratorRepository';

const TABLE = 'job_posting_collaborators' as const;

// ============================================================================
// DB row 타입
// ============================================================================

interface JpcRow {
  id: string;
  job_posting_id: string;
  user_id: string;
  added_by: string;
  added_at: string;
}

interface JpcWithUserRow extends JpcRow {
  users: {
    nickname: string | null;
    name: string | null;
    email: string | null;
    photo_url: string | null;
  } | null;
}

interface SharedJpRow {
  added_at: string;
  job_postings: {
    id: string;
    title: string;
    workspace_id: string;
    workspaces: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface UserEmailRow {
  id: string;
  email: string | null;
  nickname: string | null;
  name: string | null;
  photo_url: string | null;
}

// ============================================================================
// Mappers
// ============================================================================

function rowToCollaborator(row: JpcRow): JobPostingCollaborator {
  return {
    id: row.id,
    jobPostingId: row.job_posting_id,
    userId: row.user_id,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

function rowToCollaboratorWithUser(row: JpcWithUserRow): JobPostingCollaboratorWithUser {
  return {
    ...rowToCollaborator(row),
    displayName: row.users?.nickname ?? row.users?.name ?? null,
    email: row.users?.email ?? null,
    photoUrl: row.users?.photo_url ?? null,
  };
}

function rowToSharedJobPosting(row: SharedJpRow): SharedJobPosting | null {
  if (!row.job_postings) return null;
  return {
    jobPostingId: row.job_postings.id,
    jobPostingTitle: row.job_postings.title,
    workspaceId: row.job_postings.workspace_id,
    workspaceName: row.job_postings.workspaces?.name ?? '',
    addedAt: row.added_at,
  };
}

// ============================================================================
// Repository implementation
// ============================================================================

export class SupabaseJobPostingCollaboratorRepository implements IJobPostingCollaboratorRepository {
  async findByJobPostingWithUser(jobPostingId: string): Promise<JobPostingCollaboratorWithUser[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'id, job_posting_id, user_id, added_by, added_at, users:user_id (nickname, name, email, photo_url)'
        )
        .eq('job_posting_id', jobPostingId)
        .order('added_at', { ascending: true });

      if (error) {
        handleSupabaseError(error, { operation: '협업자 목록 조회', table: TABLE });
      }

      return ((data ?? []) as unknown as JpcWithUserRow[]).map(rowToCollaboratorWithUser);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '협업자 목록 조회', table: TABLE });
    }
  }

  async findSharedJobPostingsForUser(userId: string): Promise<SharedJobPosting[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'added_at, job_postings:job_posting_id (id, title, workspace_id, workspaces:workspace_id (id, name))'
        )
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: '공유받은 공고 조회', table: TABLE });
      }

      return ((data ?? []) as unknown as SharedJpRow[])
        .map(rowToSharedJobPosting)
        .filter((x): x is SharedJobPosting => x !== null);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '공유받은 공고 조회', table: TABLE });
    }
  }

  async add(
    jobPostingId: string,
    userId: string,
    addedBy: string
  ): Promise<JobPostingCollaborator> {
    try {
      logger.info('협업자 추가', { jobPostingId, userId, addedBy });

      const { data, error } = await supabase
        .from(TABLE)
        .insert({ job_posting_id: jobPostingId, user_id: userId, added_by: addedBy })
        .select('id, job_posting_id, user_id, added_by, added_at')
        .single();

      if (error) {
        // UNIQUE 충돌 (이미 collaborator) → 친절 메시지
        if (error.code === '23505') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 협업 중인 사용자입니다',
          });
        }
        // CHECK 위반 (자가 추가) → 친절 메시지
        if (error.code === '23514') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '본인은 협업자로 추가할 수 없습니다',
          });
        }
        handleSupabaseError(error, { operation: '협업자 추가', table: TABLE });
      }

      if (!data) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '협업자 추가에 실패했습니다',
        });
      }
      return rowToCollaborator(data as JpcRow);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '협업자 추가', table: TABLE });
    }
  }

  async remove(jobPostingId: string, userId: string): Promise<void> {
    try {
      logger.info('협업자 제거', { jobPostingId, userId });

      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('job_posting_id', jobPostingId)
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '협업자 제거', table: TABLE });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '협업자 제거', table: TABLE });
    }
  }

  async searchByEmail(
    jobPostingId: string,
    emailQuery: string
  ): Promise<CollaboratorSearchCandidate[]> {
    try {
      // 1) 이메일 prefix 매칭으로 후보 (자신 제외는 status 분류에서 처리)
      const { data: candidates, error: userErr } = await supabase
        .from('users')
        .select('id, email, nickname, name, photo_url')
        .ilike('email', `${emailQuery}%`)
        .limit(10);

      if (userErr) {
        handleSupabaseError(userErr, { operation: '협업자 후보 검색', table: 'users' });
      }

      const candidateRows = (candidates ?? []) as UserEmailRow[];
      if (candidateRows.length === 0) return [];

      const candidateIds = candidateRows.map((c) => c.id);

      // 2) 현재 사용자 (self 분류용)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const selfId = user?.id ?? null;

      // 3) 공고의 workspace_id 와 기존 멤버/협업자 한 번에 조회
      const { data: jpRow } = await supabase
        .from('job_postings')
        .select('workspace_id')
        .eq('id', jobPostingId)
        .single();
      const workspaceId = (jpRow as { workspace_id: string } | null)?.workspace_id ?? null;

      const memberIds = new Set<string>();
      if (workspaceId) {
        const { data: members } = await supabase
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', workspaceId)
          .in('user_id', candidateIds);
        ((members ?? []) as { user_id: string }[]).forEach((m) => memberIds.add(m.user_id));

        // workspace owner 도 멤버로 간주
        const { data: wsRow } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .single();
        const ownerId = (wsRow as { owner_id: string } | null)?.owner_id ?? null;
        if (ownerId && candidateIds.includes(ownerId)) {
          memberIds.add(ownerId);
        }
      }

      const collabIds = new Set<string>();
      const { data: existingCollabs } = await supabase
        .from(TABLE)
        .select('user_id')
        .eq('job_posting_id', jobPostingId)
        .in('user_id', candidateIds);
      ((existingCollabs ?? []) as { user_id: string }[]).forEach((c) => collabIds.add(c.user_id));

      // 4) 상태 분류
      return candidateRows.map((row): CollaboratorSearchCandidate => {
        let status: CollaboratorSearchCandidate['status'];
        if (selfId && row.id === selfId) status = 'self';
        else if (memberIds.has(row.id)) status = 'workspace_member';
        else if (collabIds.has(row.id)) status = 'already_collaborator';
        else status = 'addable';

        return {
          userId: row.id,
          displayName: row.nickname ?? row.name ?? null,
          email: row.email ?? '',
          photoUrl: row.photo_url ?? null,
          status,
        };
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '협업자 후보 검색', table: TABLE });
    }
  }
}

export const jobPostingCollaboratorRepository = new SupabaseJobPostingCollaboratorRepository();
