/**
 * OpsStaffRepository(1e) — 로스터 읽기(snake→camel 매핑) + RPC 5종 인자 스네이크 변환 +
 * 신규 P0001 에러코드(NO_LINKED_POSTING/DUPLICATE_STAFF/STAFF_NOT_IN_ROSTER/STAFF_NOT_FOUND/
 * POSTING_NOT_FOUND) → AppError 매핑 contract test.
 *
 * mapOpsRpcError/handleSupabaseError 는 실제 구현 사용(실제 에러코드 등록 여부까지 검증하기 위해 mock 안 함).
 */
import { SupabaseOpsStaffRepository } from '../OpsStaffRepository';
import { BusinessError, ERROR_CODES, isBusinessError } from '@/errors';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as { then?: unknown }).then = function then<T1 = unknown, T2 = never>(
    onfulfilled?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('SupabaseOpsStaffRepository.listByTournament', () => {
  const repo = new SupabaseOpsStaffRepository();

  it('snake_case 행 → camelCase OpsStaff 매핑 + created_at asc 정렬', async () => {
    const row = {
      id: 'os1',
      tournament_id: 't1',
      staff_id: 's1',
      role: 'dealer',
      custom_role: null,
      staff_name: '홍길동',
      staff_nickname: '길동이',
      source: 'snapshot_import',
      source_work_log_id: 'wl1',
      created_at: '2026-07-07T00:00:00Z',
    };
    const chain = makeChain({ data: [row], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await repo.listByTournament('t1');

    expect(mockFrom).toHaveBeenCalledWith('ops_staff');
    expect(chain.eq).toHaveBeenCalledWith('tournament_id', 't1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual([
      {
        id: 'os1',
        tournamentId: 't1',
        staffId: 's1',
        role: 'dealer',
        customRole: null,
        staffName: '홍길동',
        staffNickname: '길동이',
        source: 'snapshot_import',
        sourceWorkLogId: 'wl1',
        createdAt: '2026-07-07T00:00:00Z',
      },
    ]);
  });

  it('빈 응답 → 빈 배열', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    expect(await repo.listByTournament('t1')).toEqual([]);
  });

  it('select 에러 → AppError 전파(handleSupabaseError 경유)', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'boom', code: '42501' } }));
    await expect(repo.listByTournament('t1')).rejects.toBeTruthy();
  });
});

describe('SupabaseOpsStaffRepository — RPC 5종 인자 스네이크 변환', () => {
  const repo = new SupabaseOpsStaffRepository();

  it('setTournamentPosting: p_job_posting_id=null 도 그대로 전달(해제)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { tournamentId: 't1', jobPostingId: null },
      error: null,
    });

    await repo.setTournamentPosting({ tournamentId: 't1', actorId: 'a1', jobPostingId: null });

    expect(mockRpc).toHaveBeenCalledWith('ops_set_tournament_posting', {
      p_tournament_id: 't1',
      p_actor_id: 'a1',
      p_job_posting_id: null,
    });
  });

  it('importFromPosting: date=null + imported/skipped 그대로 반환', async () => {
    mockRpc.mockResolvedValueOnce({ data: { imported: 3, skipped: 1 }, error: null });

    const result = await repo.importFromPosting({
      tournamentId: 't1',
      actorId: 'a1',
      date: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('ops_import_staff_from_posting', {
      p_tournament_id: 't1',
      p_actor_id: 'a1',
      p_date: null,
    });
    expect(result).toEqual({ imported: 3, skipped: 1 });
  });

  it('addStaff: role/customRole 스네이크 변환', async () => {
    mockRpc.mockResolvedValueOnce({ data: { opsStaffId: 'os1' }, error: null });

    await repo.addStaff({
      tournamentId: 't1',
      actorId: 'a1',
      staffId: 's1',
      role: 'dealer',
      customRole: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('ops_add_staff', {
      p_tournament_id: 't1',
      p_actor_id: 'a1',
      p_staff_id: 's1',
      p_role: 'dealer',
      p_custom_role: null,
    });
  });

  it('removeStaff: opsStaffId → p_ops_staff_id 변환', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: true, clearedTableIds: [] }, error: null });

    await repo.removeStaff({ tournamentId: 't1', actorId: 'a1', opsStaffId: 'os1' });

    expect(mockRpc).toHaveBeenCalledWith('ops_remove_staff', {
      p_tournament_id: 't1',
      p_actor_id: 'a1',
      p_ops_staff_id: 'os1',
    });
  });

  it('assignTableStaff: staffId=null 도 그대로 전달(해제)', async () => {
    mockRpc.mockResolvedValueOnce({ data: { tableId: 'tb1', staffId: null }, error: null });

    await repo.assignTableStaff({
      tournamentId: 't1',
      actorId: 'a1',
      tableId: 'tb1',
      staffId: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('ops_assign_table_staff', {
      p_tournament_id: 't1',
      p_actor_id: 'a1',
      p_table_id: 'tb1',
      p_staff_id: null,
    });
  });
});

describe('SupabaseOpsStaffRepository — 신규 P0001 에러코드 매핑', () => {
  const repo = new SupabaseOpsStaffRepository();

  it('NO_LINKED_POSTING(importFromPosting) → BUSINESS_INVALID_STATE', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'NO_LINKED_POSTING: 연결된 공고가 없습니다. 먼저 공고를 연결하세요' },
    });

    const promise = repo.importFromPosting({ tournamentId: 't1', actorId: 'a1', date: null });
    await expect(promise).rejects.toThrow();
    try {
      await promise;
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.BUSINESS_INVALID_STATE);
    }
  });

  it('DUPLICATE_STAFF(addStaff) → BUSINESS_INVALID_STATE', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DUPLICATE_STAFF: 이미 로스터에 있는 스태프입니다' },
    });

    try {
      await repo.addStaff({
        tournamentId: 't1',
        actorId: 'a1',
        staffId: 's1',
        role: 'dealer',
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.BUSINESS_INVALID_STATE);
    }
  });

  it('STAFF_NOT_IN_ROSTER(assignTableStaff) → BUSINESS_INVALID_STATE', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'STAFF_NOT_IN_ROSTER: 로스터에 없는 스태프입니다' },
    });

    try {
      await repo.assignTableStaff({
        tournamentId: 't1',
        actorId: 'a1',
        tableId: 'tb1',
        staffId: 's1',
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.BUSINESS_INVALID_STATE);
    }
  });

  it('STAFF_NOT_FOUND(addStaff) → INFRA_NOT_FOUND', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'STAFF_NOT_FOUND: 추가할 수 없는 사용자입니다' },
    });

    try {
      await repo.addStaff({
        tournamentId: 't1',
        actorId: 'a1',
        staffId: 's1',
        role: 'dealer',
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.INFRA_NOT_FOUND);
    }
  });

  it('POSTING_NOT_FOUND(setTournamentPosting) → INFRA_NOT_FOUND (보안 게이트 — 폴백 누락 회귀가드)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'POSTING_NOT_FOUND: 공고를 찾을 수 없거나 접근 권한이 없습니다' },
    });

    try {
      await repo.setTournamentPosting({ tournamentId: 't1', actorId: 'a1', jobPostingId: 'p1' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.INFRA_NOT_FOUND);
    }
  });

  it('TABLE_NOT_FOUND(assignTableStaff) → 기존 OPS_TABLE_NOT_FOUND 매핑 재사용(회귀가드)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다' },
    });

    try {
      await repo.assignTableStaff({
        tournamentId: 't1',
        actorId: 'a1',
        tableId: 'tb1',
        staffId: 's1',
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(isBusinessError(e)).toBe(true);
      expect((e as BusinessError).code).toBe(ERROR_CODES.OPS_TABLE_NOT_FOUND);
    }
  });
});
