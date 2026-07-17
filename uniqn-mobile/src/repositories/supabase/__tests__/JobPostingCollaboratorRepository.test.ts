/**
 * JobPostingCollaboratorRepository unit tests
 *
 * Repository 는 RLS 의존 — 여기서는 Supabase 응답 매핑 + 에러 분기 + searchByNickname
 * 상태 분류만 검증한다. 정책 자체의 보안 동작은 pg_prove RLS 매트릭스에서 다룸.
 */

import { SupabaseJobPostingCollaboratorRepository } from '../JobPostingCollaboratorRepository';
import { supabase } from '@/lib/supabase';
import { BusinessError } from '@/errors';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/utils/supabase', () => ({
  toCamelCase: <T>(x: T) => x,
  handleSupabaseError: jest.fn().mockImplementation((error: unknown) => {
    throw new Error(String((error as { message?: string })?.message ?? 'supabase error'));
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('SupabaseJobPostingCollaboratorRepository', () => {
  let repo: SupabaseJobPostingCollaboratorRepository;

  beforeEach(() => {
    repo = new SupabaseJobPostingCollaboratorRepository();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // findByJobPostingWithUser
  // ==========================================================================

  describe('findByJobPostingWithUser', () => {
    it('snake_case 응답을 camelCase 로 매핑한다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'jpc-1',
              job_posting_id: 'jp-1',
              user_id: 'user-1',
              added_by: 'owner-1',
              added_at: '2026-05-12T00:00:00Z',
              users: {
                nickname: '협업자',
                name: null,
                email: 'collab@test.local',
                photo_url: null,
              },
            },
          ],
          error: null,
        }),
      });

      const result = await repo.findByJobPostingWithUser('jp-1');

      expect(result).toEqual([
        {
          id: 'jpc-1',
          jobPostingId: 'jp-1',
          userId: 'user-1',
          addedBy: 'owner-1',
          addedAt: '2026-05-12T00:00:00Z',
          displayName: '협업자',
          email: 'collab@test.local',
          photoUrl: null,
        },
      ]);
    });

    it('users.nickname 이 null 이면 name 으로 fallback 한다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'jpc-2',
              job_posting_id: 'jp-1',
              user_id: 'user-2',
              added_by: 'owner-1',
              added_at: '2026-05-12T00:00:00Z',
              users: {
                nickname: null,
                name: '이름',
                email: null,
                photo_url: null,
              },
            },
          ],
          error: null,
        }),
      });

      const result = await repo.findByJobPostingWithUser('jp-1');
      expect(result[0]?.displayName).toBe('이름');
    });

    it('빈 응답 시 빈 배열을 반환한다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await repo.findByJobPostingWithUser('jp-empty');
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // add
  // ==========================================================================

  describe('add', () => {
    it('UNIQUE 충돌 (23505) 시 BusinessError 친절 메시지를 던진다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        }),
      });

      await expect(repo.add('jp-1', 'user-1', 'owner-1')).rejects.toBeInstanceOf(BusinessError);
      await expect(repo.add('jp-1', 'user-1', 'owner-1')).rejects.toMatchObject({
        userMessage: '이미 협업 중인 사용자입니다',
      });
    });

    it('CHECK 위반 (23514) 시 자가 추가 친절 메시지를 던진다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23514', message: 'check_user_id_not_added_by' },
        }),
      });

      await expect(repo.add('jp-1', 'owner-1', 'owner-1')).rejects.toBeInstanceOf(BusinessError);
      await expect(repo.add('jp-1', 'owner-1', 'owner-1')).rejects.toMatchObject({
        userMessage: '본인은 협업자로 추가할 수 없습니다',
      });
    });

    it('성공 시 camelCase 객체를 반환한다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'jpc-new',
            job_posting_id: 'jp-1',
            user_id: 'user-1',
            added_by: 'owner-1',
            added_at: '2026-05-12T00:00:00Z',
          },
          error: null,
        }),
      });

      const result = await repo.add('jp-1', 'user-1', 'owner-1');
      expect(result).toEqual({
        id: 'jpc-new',
        jobPostingId: 'jp-1',
        userId: 'user-1',
        addedBy: 'owner-1',
        addedAt: '2026-05-12T00:00:00Z',
      });
    });

    it('알 수 없는 에러는 handleSupabaseError 경로로 전달된다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
      });

      await expect(repo.add('jp-1', 'user-1', 'owner-1')).rejects.toThrow('permission denied');
    });
  });

  // ==========================================================================
  // remove
  // ==========================================================================

  describe('remove', () => {
    it('성공 시 정상 종료', async () => {
      const eqSecond = jest.fn().mockResolvedValue({ data: null, error: null });
      const eqFirst = jest.fn().mockReturnValue({ eq: eqSecond });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqFirst });
      (mockSupabase.from as jest.Mock).mockReturnValue({ delete: deleteMock });

      await expect(repo.remove('jp-1', 'user-1')).resolves.toBeUndefined();
      expect(eqFirst).toHaveBeenCalledWith('job_posting_id', 'jp-1');
      expect(eqSecond).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('에러 시 handleSupabaseError 경로로 전달된다', async () => {
      const eqSecond = jest
        .fn()
        .mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
      const eqFirst = jest.fn().mockReturnValue({ eq: eqSecond });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqFirst });
      (mockSupabase.from as jest.Mock).mockReturnValue({ delete: deleteMock });

      await expect(repo.remove('jp-1', 'user-1')).rejects.toThrow('denied');
    });
  });

  // ==========================================================================
  // findSharedJobPostingsForUser
  // ==========================================================================

  describe('findSharedJobPostingsForUser', () => {
    it('JOIN 응답을 SharedJobPosting 로 매핑한다', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              added_at: '2026-05-12T00:00:00Z',
              job_postings: {
                id: 'jp-1',
                title: '공유 공고',
                workspace_id: 'ws-1',
                workspaces: { id: 'ws-1', name: '워크스페이스' },
              },
            },
          ],
          error: null,
        }),
      });

      const result = await repo.findSharedJobPostingsForUser('user-1');
      expect(result).toEqual([
        {
          jobPostingId: 'jp-1',
          jobPostingTitle: '공유 공고',
          workspaceId: 'ws-1',
          workspaceName: '워크스페이스',
          addedAt: '2026-05-12T00:00:00Z',
        },
      ]);
    });

    it('job_postings 가 null 인 행을 필터링한다 (RLS 차단)', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ added_at: '2026-05-12', job_postings: null }],
          error: null,
        }),
      });

      const result = await repo.findSharedJobPostingsForUser('user-1');
      expect(result).toEqual([]);
    });

    it('workspaces 가 null 이면 workspaceName 은 빈 문자열', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              added_at: '2026-05-12T00:00:00Z',
              job_postings: {
                id: 'jp-1',
                title: '공유 공고',
                workspace_id: 'ws-1',
                workspaces: null,
              },
            },
          ],
          error: null,
        }),
      });

      const result = await repo.findSharedJobPostingsForUser('user-1');
      expect(result[0]?.workspaceName).toBe('');
    });
  });

  // ==========================================================================
  // searchByNickname
  // ==========================================================================

  describe('searchByNickname', () => {
    function setupSearchMocks(opts: {
      candidates: {
        id: string;
        email: string;
        nickname: string | null;
        name: string | null;
        photo_url: string | null;
      }[];
      selfId: string | null;
      workspaceId: string | null;
      collaboratorIds: string[];
      memberIds: string[];
      ownerId: string | null;
    }) {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: opts.candidates,
        error: null,
      });
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: opts.selfId ? { id: opts.selfId } : null },
      });

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'job_postings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: opts.workspaceId ? { workspace_id: opts.workspaceId } : null,
              error: null,
            }),
          };
        }
        if (table === 'job_posting_collaborators') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: opts.collaboratorIds.map((user_id) => ({ user_id })),
              error: null,
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: opts.memberIds.map((user_id) => ({ user_id })),
              error: null,
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: opts.ownerId ? { owner_id: opts.ownerId } : null,
              error: null,
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });
    }

    it('self / workspace_member / already_collaborator / addable 4 상태로 분류한다', async () => {
      setupSearchMocks({
        candidates: [
          { id: 'me', email: 'me@test.local', nickname: 'me', name: null, photo_url: null },
          { id: 'member-1', email: 'm1@test.local', nickname: 'm1', name: null, photo_url: null },
          { id: 'collab-1', email: 'c1@test.local', nickname: 'c1', name: null, photo_url: null },
          { id: 'add-1', email: 'a1@test.local', nickname: 'a1', name: null, photo_url: null },
        ],
        selfId: 'me',
        workspaceId: 'ws-1',
        collaboratorIds: ['collab-1'],
        memberIds: ['member-1'],
        ownerId: 'someone-else',
      });

      const result = await repo.searchByNickname('jp-1', 'test');

      expect(result).toEqual([
        { userId: 'me', displayName: 'me', email: 'me@test.local', photoUrl: null, status: 'self' },
        {
          userId: 'member-1',
          displayName: 'm1',
          email: 'm1@test.local',
          photoUrl: null,
          status: 'workspace_member',
        },
        {
          userId: 'collab-1',
          displayName: 'c1',
          email: 'c1@test.local',
          photoUrl: null,
          status: 'already_collaborator',
        },
        {
          userId: 'add-1',
          displayName: 'a1',
          email: 'a1@test.local',
          photoUrl: null,
          status: 'addable',
        },
      ]);
    });

    it('workspace owner 후보는 workspace_member 로 분류된다', async () => {
      setupSearchMocks({
        candidates: [
          {
            id: 'owner-1',
            email: 'o1@test.local',
            nickname: 'owner',
            name: null,
            photo_url: null,
          },
        ],
        selfId: 'caller',
        workspaceId: 'ws-1',
        collaboratorIds: [],
        memberIds: [],
        ownerId: 'owner-1',
      });

      const result = await repo.searchByNickname('jp-1', 'owner');
      expect(result[0]?.status).toBe('workspace_member');
    });

    it('RPC 빈 결과 시 빈 배열을 반환한다 (보조 쿼리 호출 없음)', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repo.searchByNickname('jp-1', 'nomatch');

      expect(result).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('우선순위: self > workspace_member > already_collaborator (selfId 가 collaborator 인 경우 self)', async () => {
      setupSearchMocks({
        candidates: [
          {
            id: 'me',
            email: 'me@test.local',
            nickname: 'me',
            name: null,
            photo_url: null,
          },
        ],
        selfId: 'me',
        workspaceId: 'ws-1',
        collaboratorIds: ['me'],
        memberIds: ['me'],
        ownerId: null,
      });

      const result = await repo.searchByNickname('jp-1', 'me');
      expect(result[0]?.status).toBe('self');
    });

    // 분기 순서: self > workspace_member > already_collaborator > addable.
    // self 가 아닌 후보가 동시에 member ∧ collaborator 일 때 member 가 이김.
    // 구현 분기 (Repository line 267-273) 의 silent flip 방지.
    it('우선순위: workspace_member > already_collaborator (self 아닌 member 가 collaborator 도 겸할 때 member 우선)', async () => {
      setupSearchMocks({
        candidates: [
          {
            id: 'editor-and-collab',
            email: 'ec@test.local',
            nickname: 'editor-collab',
            name: null,
            photo_url: null,
          },
        ],
        selfId: 'caller',
        workspaceId: 'ws-1',
        collaboratorIds: ['editor-and-collab'],
        memberIds: ['editor-and-collab'],
        ownerId: null,
      });

      const result = await repo.searchByNickname('jp-1', 'ec');
      expect(result[0]?.status).toBe('workspace_member');
    });
  });
});
