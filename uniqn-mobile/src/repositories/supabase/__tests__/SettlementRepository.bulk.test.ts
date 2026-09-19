// src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts
//
// bulkSettlementWithTransaction 회귀 테스트 (머니 패스).
//
// 전환 이력: 이 파일은 원래 "청크 내 per-row UPDATE 를 Promise.all 로 병렬화한 구현"의
// 순서·집계·부분실패 격리를 잠갔다. 감사 L1 잔여에서 그 루프가 통째로 서버 RPC
// (`bulk_settle_work_logs`)로 옮겨졌으므로, 이제 이 파일이 지켜야 할 것은 바뀌었다:
//
//   ① 청크당 RPC **정확히 1회**, 한 번에 100건을 넘기지 않는다
//      (서버 상한과 어긋나면 청크 전체가 INVALID_INPUT 으로 죽는다)
//   ② 부분 성공 계약(successCount/failedCount/totalAmount/results 순서)이 그대로 보존된다
//   ③ 한 청크가 실패해도 **그 청크만** 실패로 기록되고 앞 청크의 성공은 유지된다
//   ④ 응답 형태가 낯설면 금액을 지어내지 않고 실패로 접는다(0원 성공 금지)
//
// 행별 권한·상태·중복·금액 판정 자체는 이제 서버에 있고
// supabase/tests/settlement_settle_rpcs.test.sql 이 고정한다 — 여기서 중복 검증하지 않는다.
import { SupabaseSettlementRepository } from '../SettlementRepository';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRpc = jest.requireMock('@/lib/supabase').supabase.rpc as jest.Mock;

const OWNER = 'owner-1';

/** 서버 응답(jsonb) 모양 그대로 — 성공 항목 */
const ok = (id: string, amount: number) => ({
  success: true,
  workLogId: id,
  amount,
  message: '정산 완료',
});
/** 서버 응답(jsonb) 모양 그대로 — 실패 항목 */
const ng = (id: string, message: string) => ({
  success: false,
  workLogId: id,
  amount: 0,
  message,
});

interface RpcResultItem {
  success: boolean;
  workLogId: string;
  amount: number;
  message: string;
}

/** bulk_settle_work_logs 응답 봉투 */
const envelope = (results: RpcResultItem[]) => ({
  data: {
    totalCount: results.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    totalAmount: results.reduce((sum, r) => sum + (r.success ? r.amount : 0), 0),
    results,
  },
  error: null,
});

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  repo = new SupabaseSettlementRepository();
});

/** 이 세션의 bulk RPC 호출만 추린다 */
const bulkCalls = () => mockRpc.mock.calls.filter((c) => c[0] === 'bulk_settle_work_logs');

describe('bulkSettlementWithTransaction', () => {
  it('전부 성공: 청크당 RPC 1회 · 순서·합계 보존', async () => {
    mockRpc.mockResolvedValue(envelope([ok('wl-1', 1000), ok('wl-2', 2000), ok('wl-3', 3000)]));

    const result = await repo.bulkSettlementWithTransaction(
      { workLogIds: ['wl-1', 'wl-2', 'wl-3'] },
      OWNER
    );

    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.totalAmount).toBe(6000);
    expect(result.totalCount).toBe(3);
    expect(result.results.map((r) => r.workLogId)).toEqual(['wl-1', 'wl-2', 'wl-3']);
    expect(result.results.map((r) => r.amount)).toEqual([1000, 2000, 3000]);

    expect(bulkCalls()).toHaveLength(1);
    expect(bulkCalls()[0][1]).toEqual({
      p_work_log_ids: ['wl-1', 'wl-2', 'wl-3'],
      p_notes: null,
    });
  });

  it('부분 실패: 실패 행만 격리되고 순서·합계가 보존된다 (롤백 없음)', async () => {
    mockRpc.mockResolvedValue(
      envelope([ok('wl-1', 1000), ng('wl-2', '정산 업데이트 실패'), ok('wl-3', 3000)])
    );

    const result = await repo.bulkSettlementWithTransaction(
      { workLogIds: ['wl-1', 'wl-2', 'wl-3'] },
      OWNER
    );

    expect(result.results.map((r) => r.workLogId)).toEqual(['wl-1', 'wl-2', 'wl-3']);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.results[1].message).toBe('정산 업데이트 실패');
    expect(result.results[2].success).toBe(true);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.totalAmount).toBe(4000); // 1000 + 3000
  });

  it('서버가 낸 항목별 문구(권한·상태·중복)를 그대로 화면 계약으로 전달한다', async () => {
    mockRpc.mockResolvedValue(
      envelope([
        ng('wl-done', '이미 정산 완료되었습니다'),
        ng('wl-foreign', '권한이 없는 공고입니다'),
      ])
    );

    const result = await repo.bulkSettlementWithTransaction(
      { workLogIds: ['wl-done', 'wl-foreign'] },
      OWNER
    );

    const byId = Object.fromEntries(result.results.map((r) => [r.workLogId, r]));
    expect(byId['wl-done'].message).toBe('이미 정산 완료되었습니다');
    expect(byId['wl-foreign'].message).toBe('권한이 없는 공고입니다');
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(result.totalAmount).toBe(0);
  });

  it('🔴 청크 상한 100 — 한 번에 100건을 넘겨 보내지 않는다 (서버 상한과 동치)', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `wl-${i}`);
    mockRpc.mockImplementation((_fn: string, args: { p_work_log_ids: string[] }) =>
      Promise.resolve(envelope(args.p_work_log_ids.map((id) => ok(id, 10))))
    );

    const result = await repo.bulkSettlementWithTransaction({ workLogIds: ids }, OWNER);

    expect(bulkCalls()).toHaveLength(2);
    expect(bulkCalls()[0][1].p_work_log_ids).toHaveLength(100);
    expect(bulkCalls()[1][1].p_work_log_ids).toHaveLength(50);
    // 어느 호출도 서버 상한을 넘지 않는다
    for (const call of bulkCalls()) {
      expect(call[1].p_work_log_ids.length).toBeLessThanOrEqual(100);
    }
    expect(result.successCount).toBe(150);
    expect(result.totalAmount).toBe(1500);
    expect(result.results.map((r) => r.workLogId)).toEqual(ids);
  });

  it('🔴 청크 호출 실패는 그 청크만 실패로 기록하고 앞 청크의 성공을 유지한다', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `wl-${i}`);
    let call = 0;
    mockRpc.mockImplementation((_fn: string, args: { p_work_log_ids: string[] }) => {
      call += 1;
      if (call === 2) return Promise.resolve({ data: null, error: { message: 'timeout' } });
      return Promise.resolve(envelope(args.p_work_log_ids.map((id) => ok(id, 10))));
    });

    const result = await repo.bulkSettlementWithTransaction({ workLogIds: ids }, OWNER);

    expect(result.successCount).toBe(100);
    expect(result.failedCount).toBe(50);
    expect(result.totalAmount).toBe(1000);
    expect(result.results.slice(100).every((r) => !r.success)).toBe(true);
    expect(result.results[100].message).toBe('정산 업데이트 실패');
  });

  it('🔴 응답 형태가 낯설면 0원 성공으로 접지 않고 실패로 기록한다 (fail-closed)', async () => {
    // amount 가 문자열로 온 오염 응답 — 통과시키면 화면에 "0원 정산 완료"가 뜬다.
    mockRpc.mockResolvedValue({
      data: {
        results: [{ success: true, workLogId: 'wl-1', amount: '1000', message: '정산 완료' }],
      },
      error: null,
    });

    const result = await repo.bulkSettlementWithTransaction({ workLogIds: ['wl-1'] }, OWNER);

    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.totalAmount).toBe(0);
    expect(result.results[0].message).toBe('정산 업데이트 실패');
  });

  it('메모(notes)는 서버로 그대로 전달된다', async () => {
    mockRpc.mockResolvedValue(envelope([ok('wl-1', 1000)]));

    await repo.bulkSettlementWithTransaction({ workLogIds: ['wl-1'], notes: '8월 1주차' }, OWNER);

    expect(bulkCalls()[0][1].p_notes).toBe('8월 1주차');
  });

  it('일괄 경로는 더 이상 work_logs 를 직접 UPDATE 하지 않는다', async () => {
    mockRpc.mockResolvedValue(envelope([ok('wl-1', 1000)]));

    await repo.bulkSettlementWithTransaction({ workLogIds: ['wl-1'] }, OWNER);

    // 직접 쓰기가 남아 있으면 L1 3단계(payroll 컬럼 직접 UPDATE 차단)를 걸 수 없다.
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
