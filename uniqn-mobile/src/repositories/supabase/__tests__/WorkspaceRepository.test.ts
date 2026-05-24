/**
 * SupabaseWorkspaceRepository - archive/restore/findArchived 단위 테스트
 */

import { SupabaseWorkspaceRepository } from '../WorkspaceRepository';
import { supabase } from '@/lib/supabase';
import { BusinessError } from '@/errors/AppError';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
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

describe('SupabaseWorkspaceRepository - archive/restore', () => {
  const repo = new SupabaseWorkspaceRepository();
  beforeEach(() => jest.clearAllMocks());

  it('archiveViaRpc 는 archive_workspace RPC 를 호출한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    await repo.archiveViaRpc('11111111-1111-1111-1111-111111111111');
    expect(supabase.rpc).toHaveBeenCalledWith('archive_workspace', {
      p_workspace_id: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('archiveViaRpc 는 진행공고 RPC 에러를 BusinessError 로 변환한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'WORKSPACE_HAS_ACTIVE_POSTINGS:2' },
    });
    await expect(repo.archiveViaRpc('11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(
      BusinessError
    );
  });

  it('restoreViaRpc 는 restore_workspace RPC 를 호출한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    await repo.restoreViaRpc('11111111-1111-1111-1111-111111111111');
    expect(supabase.rpc).toHaveBeenCalledWith('restore_workspace', {
      p_workspace_id: '11111111-1111-1111-1111-111111111111',
    });
  });
});
