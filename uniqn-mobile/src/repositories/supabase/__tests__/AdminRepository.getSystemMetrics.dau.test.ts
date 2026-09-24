/**
 * AdminRepository.getSystemMetrics — DAU 집계 계약 (마이그 20260923100000)
 *
 * @description 예전에는 서비스가 날짜만 채우고 DAU 를 0 으로 박았다. 이제 서버 RPC
 *   `get_admin_daily_active_users` 가 집계하고, 리포지토리는 그 값을 그대로 옮긴다.
 *
 *   🔑 가장 중요한 단언은 "실패 = null" 이다. 실패를 0 으로 채우면 집계가 깨져도
 *   화면이 그럴듯한 0 을 그려 "아무도 안 왔다"로 읽힌다 — 이 수정이 없앤 결함이 그 형태였다.
 */

import { SupabaseAdminRepository } from '../AdminRepository';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
}));

/** 가입/지원 count 조회와 헬스 체크가 쓰는 thenable 체인 — 모두 성공으로 응답한다. */
function makeCountChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'gte', 'lte', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as { then?: unknown }).then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 5 }).then(onfulfilled);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockFrom.mockImplementation(() => makeCountChain());
});

describe('AdminRepository.getSystemMetrics — DAU', () => {
  const repo = new SupabaseAdminRepository();

  it('서버 RPC 를 KST·7일로 호출하고 집계값을 날짜별로 옮긴다', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { activity_date: '2026-09-17', active_users: 0 },
        { activity_date: '2026-09-18', active_users: 12 },
        { activity_date: '2026-09-23', active_users: 27 },
      ],
      error: null,
    });

    const result = await repo.getSystemMetrics();

    expect(mockRpc).toHaveBeenCalledWith('get_admin_daily_active_users', {
      p_days: 7,
      p_tz: 'Asia/Seoul',
    });
    expect(result.dailyActiveUsers).toEqual([
      { date: '2026-09-17', count: 0 },
      { date: '2026-09-18', count: 12 },
      { date: '2026-09-23', count: 27 },
    ]);
    // DAU 조회가 다른 지표를 망가뜨리지 않는다
    expect(result.dailySignups).toHaveLength(7);
    expect(result.isHealthy).toBe(true);
  });

  it('RPC 에러면 0 이 아니라 null(측정 불가)을 돌려준다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });

    const result = await repo.getSystemMetrics();

    expect(result.dailyActiveUsers).toBeNull();
    // 나머지 지표는 정상 반환 — DAU 실패가 대시보드 전체를 죽이지 않는다
    expect(result.dailySignups).toHaveLength(7);
  });

  it('RPC 가 던져도 null 로 흡수한다 (네트워크 예외)', async () => {
    mockRpc.mockRejectedValue(new Error('network'));

    const result = await repo.getSystemMetrics();

    expect(result.dailyActiveUsers).toBeNull();
  });
});
