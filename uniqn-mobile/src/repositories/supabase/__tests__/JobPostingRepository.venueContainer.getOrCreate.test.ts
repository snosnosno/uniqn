/**
 * JobPostingRepository.getOrCreateVenueContainer — TS 래퍼 contract test
 *
 * get_or_create_venue_container RPC 위의 얇은 래퍼를 검증한다.
 * - S1: 운영처명 XSS 검증 통과분만 RPC 로 전달(검증 실패 시 RPC 미호출 + ValidationError).
 * - RPC 의 camelCase 반환({containerId,name,...})을 VenueContainer 로 매핑(parseVenueContainer 재사용).
 * - period 는 제공 시에만 p_period 로 전달.
 * - RPC 에러 전파.
 */
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { ERROR_CODES } from '@/errors';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

const okRpcReturn = {
  containerId: 'c1',
  workspaceId: 'ws1',
  name: '강남홀덤',
  kind: 'dated',
};

beforeEach(() => mockRpc.mockReset());

describe('JobPostingRepository.getOrCreateVenueContainer', () => {
  const repo = new SupabaseJobPostingRepository();

  it('정상 운영처명 → RPC 호출 + VenueContainer 매핑', async () => {
    mockRpc.mockResolvedValueOnce({ data: okRpcReturn, error: null });

    const result = await repo.getOrCreateVenueContainer('ws1', { name: '강남홀덤', kind: 'dated' });

    expect(mockRpc).toHaveBeenCalledWith('get_or_create_venue_container', {
      p_workspace_id: 'ws1',
      p_name: '강남홀덤',
      p_kind: 'dated',
    });
    expect(result).toMatchObject({
      id: 'c1',
      name: '강남홀덤',
      workspaceId: 'ws1',
      venueId: 'c1',
      kind: 'dated',
      softTargets: {},
    });
  });

  it('S1: XSS 운영처명 → ValidationError + RPC 미호출', async () => {
    await expect(
      repo.getOrCreateVenueContainer('ws1', { name: '<script>alert(1)', kind: 'dated' })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_XSS_DETECTED });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('period 제공 시에만 p_period 로 전달', async () => {
    mockRpc.mockResolvedValueOnce({ data: okRpcReturn, error: null });

    await repo.getOrCreateVenueContainer('ws1', {
      name: '강남홀덤',
      kind: 'dated',
      period: '2026-W27',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_or_create_venue_container', {
      p_workspace_id: 'ws1',
      p_name: '강남홀덤',
      p_kind: 'dated',
      p_period: '2026-W27',
    });
  });

  it('RPC 에러 전파', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    await expect(
      repo.getOrCreateVenueContainer('ws1', { name: '강남홀덤', kind: 'dated' })
    ).rejects.toThrow('supabase: denied');
  });
});
