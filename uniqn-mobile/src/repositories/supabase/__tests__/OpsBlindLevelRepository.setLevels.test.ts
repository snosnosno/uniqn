/**
 * OpsBlindLevelRepository.setLevels — RPC 이름·인자 키 계약 + prevSort(저장 전 순번) 전달 규칙.
 *
 * supabase 클라이언트는 Database 제네릭 없이 만들어져 `rpc('오타', {틀린키})` 도 tsc 를 통과한다.
 * 서버(마이그 20261010100000)는 jsonb 행에 `prev_sort` **키가 하나라도 있으면** 레이트 등록 자동 마감 기준을
 * 그 레벨의 새 순번으로 옮기고, 키가 전혀 없으면 종전대로 순번을 유지한다. 그래서 "키를 싣느냐"가 계약이다.
 */
import { SupabaseOpsBlindLevelRepository } from '../OpsBlindLevelRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const level = {
  level: 1,
  smallBlind: 100,
  bigBlind: 200,
  ante: 0,
  durationSec: 600,
  isBreak: false,
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe('SupabaseOpsBlindLevelRepository.setLevels', () => {
  const repo = new SupabaseOpsBlindLevelRepository();

  it('ops_set_blind_levels 를 스네이크 키로 부르고, prevSort 는 값·null 모두 prev_sort 로 싣는다', async () => {
    mockRpc.mockResolvedValue({
      data: { count: 2, reanchored: false, cutoff_sort: 1 },
      error: null,
    });

    const result = await repo.setLevels('t1', 'u1', [
      { ...level, prevSort: 2 },
      { ...level, level: 2, prevSort: null },
    ]);

    expect(mockRpc).toHaveBeenCalledWith('ops_set_blind_levels', {
      p_tournament_id: 't1',
      p_actor_id: 'u1',
      p_levels: [
        {
          level: 1,
          small_blind: 100,
          big_blind: 200,
          ante: 0,
          duration_sec: 600,
          is_break: false,
          prev_sort: 2,
        },
        {
          level: 2,
          small_blind: 100,
          big_blind: 200,
          ante: 0,
          duration_sec: 600,
          is_break: false,
          prev_sort: null,
        },
      ],
    });
    expect(result).toEqual({ count: 2, reanchored: false, cutoffSort: 1 });
  });

  it('prevSort 를 안 준 행에는 prev_sort 키를 만들지 않는다 — 서버가 종전(순번 유지) 동작을 고른다', async () => {
    mockRpc.mockResolvedValue({ data: { count: 1, reanchored: false }, error: null });

    const result = await repo.setLevels('t1', 'u1', [level]);

    const payload = mockRpc.mock.calls[0][1].p_levels as Record<string, unknown>[];
    expect(payload).toHaveLength(1);
    expect('prev_sort' in payload[0]).toBe(false);
    // 구 서버(반환에 cutoff_sort 없음)여도 깨지지 않는다
    expect(result).toEqual({ count: 1, reanchored: false, cutoffSort: null });
  });
});
