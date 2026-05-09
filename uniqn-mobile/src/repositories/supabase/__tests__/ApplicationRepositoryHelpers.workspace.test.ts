/**
 * Phase 2A.후속 — loadAndVerifyJobPostingAccess workspace member + admin 호환
 */
import { loadAndVerifyJobPostingAccess } from '../ApplicationRepositoryHelpers';
import { supabase } from '@/lib/supabase';
import { PermissionError } from '@/errors';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockParseJobPosting = jest.fn();

jest.mock('@/schemas', () => ({
  parseApplicationDocument: jest.fn(),
  parseJobPostingDocument: (...args: unknown[]) => mockParseJobPosting(...args),
}));

jest.mock('@/utils/supabase', () => ({
  toCamelCase: <T>(x: T) => x,
  handleSupabaseError: jest.fn().mockImplementation((error: unknown) => {
    throw new Error(String((error as { message?: string })?.message ?? 'supabase error'));
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const fakeJobPosting = {
  id: 'jp-1',
  ownerId: 'owner-uid',
  workspaceId: 'ws-1',
  title: '테스트 공고',
  status: 'active' as const,
};

describe('loadAndVerifyJobPostingAccess — workspace member + admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // loadJobPosting 내부: supabase.from(...).select(...).eq(...).maybeSingle()
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'jp-1', owner_id: 'owner-uid', workspace_id: 'ws-1' },
            error: null,
          }),
        }),
      }),
    });

    // parseJobPostingDocument 가 fakeJobPosting 반환
    mockParseJobPosting.mockReturnValue(fakeJobPosting);
  });

  it('owner 본인 호출 시 통과 (RPC 호출 없음)', async () => {
    const result = await loadAndVerifyJobPostingAccess('jp-1', 'owner-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('워크스페이스 멤버 호출 시 통과 (is_workspace_member=true)', async () => {
    (mockSupabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    const result = await loadAndVerifyJobPostingAccess('jp-1', 'member-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('is_workspace_member', {
      _workspace_id: 'ws-1',
      _user_id: 'member-uid',
    });
  });

  it('admin 호출 시 통과 (is_workspace_member=false 인데 is_admin=true)', async () => {
    (mockSupabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_admin') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    const result = await loadAndVerifyJobPostingAccess('jp-1', 'admin-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('is_admin');
  });

  it('외부인 호출 시 PermissionError', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

    await expect(
      loadAndVerifyJobPostingAccess('jp-1', 'stranger-uid', '취소 요청 목록 조회')
    ).rejects.toThrow(PermissionError);
  });

  it('is_workspace_member RPC 에러 시 handleSupabaseError 발생', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc error', code: 'PGRST000' },
    });

    await expect(
      loadAndVerifyJobPostingAccess('jp-1', 'member-uid', '취소 요청 목록 조회')
    ).rejects.toThrow();
  });

  it('is_admin RPC 에러 시 handleSupabaseError 발생', async () => {
    (mockSupabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: false, error: null }) // is_workspace_member passes
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'admin rpc error', code: 'PGRST000' },
      });

    await expect(
      loadAndVerifyJobPostingAccess('jp-1', 'admin-uid', '취소 요청 목록 조회')
    ).rejects.toThrow();
  });

  it('Phase 2A.후속 — jobPosting.workspaceId 가 undefined 이면 PermissionError', async () => {
    // Override loadJobPosting so the parsed posting has no workspaceId
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'jp-1', owner_id: 'owner-uid', workspace_id: null },
            error: null,
          }),
        }),
      }),
    });
    mockParseJobPosting.mockReturnValueOnce({
      ...fakeJobPosting,
      workspaceId: undefined,
    });

    await expect(
      loadAndVerifyJobPostingAccess('jp-1', 'someone-else', '취소 요청 목록 조회')
    ).rejects.toThrow(PermissionError);

    // RPC should NOT have been called because the guard short-circuits
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
