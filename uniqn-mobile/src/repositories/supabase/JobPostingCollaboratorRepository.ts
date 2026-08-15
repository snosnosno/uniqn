/**
 * UNIQN Mobile - Supabase JobPostingCollaborator Repository
 *
 * @description 공고별 협업자 (Phase 5)
 *              - 권한 강제는 RLS — Repository 는 단순 조회/쓰기 + snake↔camel 변환
 *              - searchByNickname 은 UNIQN 가입자 닉네임 prefix 검색 + 상태 분류
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, BusinessError, ERROR_CODES } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import type {
  JobPostingCollaborator,
  JobPostingCollaboratorRole,
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
  role?: string | null;
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

interface UserNicknameRow {
  id: string;
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
    // 컬럼이 없던 시절의 행/응답도 manager 로 읽는다 — 기본값과 같은 방향(권한 보존)이다.
    role: row.role === 'viewer' ? 'viewer' : 'manager',
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
          'id, job_posting_id, user_id, added_by, added_at, role, users:user_id (nickname, name, email, photo_url)'
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
        .select('id, job_posting_id, user_id, added_by, added_at, role')
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

  /**
   * 협업자 권한 변경 (S3-4).
   *
   * 🔒 서버가 진짜 게이트다 — RLS `jpc_update_role_owner` 가 workspace owner 만 허용하고,
   *    트리거 `trg_jpc_role_update_guard` 가 role 이외 컬럼 변경을 막는다.
   *    권한이 없으면 UPDATE 가 **에러 없이 0행**으로 끝나므로(RLS 의 정상 동작),
   *    영향 행 수를 직접 확인해 조용한 실패를 잡는다.
   */
  async updateRole(
    jobPostingId: string,
    userId: string,
    role: JobPostingCollaboratorRole
  ): Promise<void> {
    try {
      logger.info('협업자 권한 변경', { jobPostingId, userId, role });

      const { data, error } = await supabase
        .from(TABLE)
        .update({ role })
        .eq('job_posting_id', jobPostingId)
        .eq('user_id', userId)
        .select('id');

      if (error) {
        handleSupabaseError(error, { operation: '협업자 권한 변경', table: TABLE });
      }

      if (!data || data.length === 0) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '권한을 변경할 수 없습니다. 공고 소유자만 변경할 수 있어요.',
        });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '협업자 권한 변경', table: TABLE });
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

  async searchByNickname(
    jobPostingId: string,
    nicknameQuery: string
  ): Promise<CollaboratorSearchCandidate[]> {
    try {
      // 1) RPC 호출 — search_collaborator_candidates_by_nickname 가 SECURITY DEFINER 로
      //    users RLS 우회 + workspace owner 검증 + 와일드카드 이스케이프 + LIMIT 10
      //    (users_select RLS 가 self/admin 만 허용해 직접 SELECT 는 빈 결과 반환)
      const { data: candidates, error: rpcErr } = await supabase.rpc(
        'search_collaborator_candidates_by_nickname',
        { p_job_posting_id: jobPostingId, p_nickname_query: nicknameQuery }
      );

      if (rpcErr) {
        handleSupabaseError(rpcErr, { operation: '협업자 후보 검색', table: 'users' });
      }

      const candidateRows = (candidates ?? []) as UserNicknameRow[];
      if (candidateRows.length === 0) return [];

      const candidateIds = candidateRows.map((c) => c.id);

      // 2) self / workspace_member / already_collaborator 분류용 병렬 조회
      //    공고의 workspace_id 가 필요 — RLS 통과 (owner OR member OR collaborator)
      const [authRes, jpRes, collabRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('job_postings').select('workspace_id').eq('id', jobPostingId).single(),
        supabase
          .from(TABLE)
          .select('user_id')
          .eq('job_posting_id', jobPostingId)
          .in('user_id', candidateIds),
      ]);

      const selfId = authRes.data.user?.id ?? null;
      const workspaceId = (jpRes.data as { workspace_id: string } | null)?.workspace_id ?? null;
      const collabIds = new Set<string>(
        ((collabRes.data ?? []) as { user_id: string }[]).map((c) => c.user_id)
      );

      const memberIds = new Set<string>();
      if (workspaceId) {
        const [membersRes, wsRes] = await Promise.all([
          supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId)
            .in('user_id', candidateIds),
          supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single(),
        ]);
        ((membersRes.data ?? []) as { user_id: string }[]).forEach((m) => memberIds.add(m.user_id));
        const ownerId = (wsRes.data as { owner_id: string } | null)?.owner_id ?? null;
        if (ownerId && candidateIds.includes(ownerId)) {
          memberIds.add(ownerId);
        }
      }

      // 3) 상태 분류
      return candidateRows.map((row): CollaboratorSearchCandidate => {
        let status: CollaboratorSearchCandidate['status'];
        if (selfId && row.id === selfId) status = 'self';
        else if (memberIds.has(row.id)) status = 'workspace_member';
        else if (collabIds.has(row.id)) status = 'already_collaborator';
        else status = 'addable';

        return {
          userId: row.id,
          displayName: row.nickname ?? row.name ?? null,
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
