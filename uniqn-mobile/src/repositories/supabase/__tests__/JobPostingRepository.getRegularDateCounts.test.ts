/**
 * SupabaseJobPostingRepository.getRegularDateCounts — RPC 래퍼 테스트
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

describe('SupabaseJobPostingRepository.getRegularDateCounts', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('RPC 이름과 파라미터를 정확히 전달한다', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const repo = new SupabaseJobPostingRepository();

    await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(mockRpc).toHaveBeenCalledWith('get_regular_posting_date_counts', {
      p_start_date: '2026-04-01',
      p_end_date: '2026-04-30',
    });
  });

  it('RPC 응답을 date→count 맵으로 변환한다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { work_date: '2026-04-14', posting_count: 2 },
        { work_date: '2026-04-18', posting_count: 12 },
      ],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({ '2026-04-14': 2, '2026-04-18': 12 });
  });

  it('posting_count가 bigint(문자열/숫자)여도 number로 정규화한다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ work_date: '2026-04-18', posting_count: '12' }],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({ '2026-04-18': 12 });
    expect(typeof result['2026-04-18']).toBe('number');
  });

  it('data가 null이어도 빈 객체 반환', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getRegularDateCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({});
  });

  it('RPC 에러 시 예외를 던진다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB connection lost', code: '08003' },
    });
    const repo = new SupabaseJobPostingRepository();

    await expect(repo.getRegularDateCounts('2026-04-01', '2026-04-30')).rejects.toThrow();
  });
});
