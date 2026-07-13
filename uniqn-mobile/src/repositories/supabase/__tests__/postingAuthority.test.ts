import {
  resolvePostingAuthority,
  canManagePosting,
} from '@/repositories/supabase/postingAuthority';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as unknown as jest.Mock;

const base = {
  jobPostingId: 'jp-1',
  workspaceId: 'ws-1',
  postingOwnerId: 'owner-1',
  actorId: 'owner-1',
  operation: '공고 수정',
};

beforeEach(() => {
  rpc.mockReset();
});

describe('resolvePostingAuthority', () => {
  it('공고 owner 면 RPC 를 한 번도 호출하지 않는다', async () => {
    const authority = await resolvePostingAuthority(base);

    expect(authority).toEqual({
      isPostingOwner: true,
      isWorkspaceMember: false,
      isPostingCollaborator: false,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('워크스페이스 멤버면 협업자 RPC 는 호출하지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });

    const authority = await resolvePostingAuthority({ ...base, actorId: 'member-1' });

    expect(authority.isWorkspaceMember).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('is_workspace_member', {
      _workspace_id: 'ws-1',
      _user_id: 'member-1',
    });
  });

  it('멤버가 아니면 공고 협업자를 확인한다', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });

    const authority = await resolvePostingAuthority({ ...base, actorId: 'collab-1' });

    expect(authority.isPostingCollaborator).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(2, 'is_posting_collaborator', {
      p_posting_id: 'jp-1',
      p_user_id: 'collab-1',
    });
  });

  it('셋 다 아니면 모든 플래그가 false 다', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });

    const authority = await resolvePostingAuthority({ ...base, actorId: 'outsider-1' });

    expect(authority).toEqual({
      isPostingOwner: false,
      isWorkspaceMember: false,
      isPostingCollaborator: false,
    });
    expect(canManagePosting(authority)).toBe(false);
  });

  it('RPC 가 null 을 반환해도 fail-closed 로 false 처리한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const authority = await resolvePostingAuthority({ ...base, actorId: 'outsider-1' });

    expect(canManagePosting(authority)).toBe(false);
  });
});

describe('canManagePosting', () => {
  it.each([
    [{ isPostingOwner: true, isWorkspaceMember: false, isPostingCollaborator: false }, true],
    [{ isPostingOwner: false, isWorkspaceMember: true, isPostingCollaborator: false }, true],
    [{ isPostingOwner: false, isWorkspaceMember: false, isPostingCollaborator: true }, true],
    [{ isPostingOwner: false, isWorkspaceMember: false, isPostingCollaborator: false }, false],
  ])('%o → %s', (authority, expected) => {
    expect(canManagePosting(authority)).toBe(expected);
  });
});
