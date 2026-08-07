// src/repositories/supabase/__tests__/SettlementRepository.modificationHistory.test.ts
//
// 정산 수정 이력이 **클라이언트에서 조립되지 않는다**는 것을 잠그는 회귀 테스트
// (감사 S-D, 마이그 20260807190000).
//
// 🔄 계약 전환 (2026-08-07): 이 파일은 원래 클라 zod 경계 검증을 고정했다 —
//    기존 배열을 읽어 새 항목을 이어붙이고, 오염(비배열)이면 [] 로 폴백하는 동작.
//    그 read-modify-write 가 바로 **Lost Update 의 원인**이었다:
//      T1 read [A] · T2 read [A] · T1 write [A,B] · T2 write [A,C]  ← B 가 조용히 사라진다
//    이제 append 는 서버 RPC 의 UPDATE 문 안에서 일어난다.
//
// 🔑 그래서 여기서 지킬 것이 뒤집혔다. "배열을 올바르게 조립하는가"가 아니라
//    **"배열을 아예 만지지 않는가"** 다. 클라가 다시 이력을 읽거나 보내기 시작하면
//    잠금이 없는 경로가 되살아나므로, 그 순간을 여기서 red 로 잡는다.
//
//    전환된 단언의 서버측 짝 (1:1):
//      · "정상(객체 배열) → 이어붙임"     → pgTAP 10·11번 (연속 저장 뒤 첫 항목 보존)
//      · "이력 없음 → 새 항목 1건"        → pgTAP 10번
//      · "오염(배열 아님) → [] 폴백"      → pgTAP 15·16번
//      · "오염(항목이 객체 아님) → 폴백"  → pgTAP 15·16번 (jsonb_typeof 는 최상위 타입만 본다)
import { SupabaseSettlementRepository } from '../SettlementRepository';
import type { TaxSettings } from '@/utils/settlement';

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
const WORK_LOG_ID = 'wl-1';

function makeCustomSettlementData() {
  return {
    customSalaryInfo: { type: 'hourly', amount: 12000 },
    customAllowances: { meal: 5000 },
    customTaxSettings: { type: 'none' } as unknown as TaxSettings,
    modificationEntry: { modifiedAt: '2026-07-24T00:00:00.000Z', reason: '금액 정정' },
  };
}

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { success: true, historyCount: 1 }, error: null });
  repo = new SupabaseSettlementRepository();
});

describe('정산 수정 이력 — 클라이언트가 조립하지 않는다 (Lost Update 방어)', () => {
  it('🔑 이력을 읽기 위한 조회를 하지 않는다 — from() 호출 0회', async () => {
    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER);

    // 전환 전에는 여기서 work_logs / job_postings 를 각각 SELECT 했다(왕복 3회).
    // 조회가 되살아나면 그 다음 단계는 배열 조립이고, 그러면 잠금 없는 경로가 돌아온다.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('🔑 이력 **배열**을 서버로 보내지 않는다 — 보내는 것은 새 항목 1개뿐', async () => {
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    const args = mockRpc.mock.calls[0][1] as Record<string, unknown>;

    // 새 항목은 객체 그대로 넘어간다
    expect(args.p_modification_entry).toEqual(data.modificationEntry);

    // 어떤 인자도 배열이어서는 안 된다. 배열이 하나라도 실리면 클라가 이력을
    // 통째로 되돌려보내고 있다는 뜻이고, 그것이 곧 덮어쓰기다.
    for (const [key, value] of Object.entries(args)) {
      expect(`${key}:${Array.isArray(value)}`).toBe(`${key}:false`);
    }
  });

  it('RPC 는 저장 1회당 정확히 1번만 호출된다 (다단계 뮤테이션 금지)', async () => {
    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER);

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('오염된 이력의 폴백 판단도 클라가 하지 않는다 — 서버 응답만 신뢰한다', async () => {
    // 전환 전에는 오염 시 logger.error 를 남기고 [] 로 접었다. 이제 그 판단은 서버
    // `jsonb_typeof(...) = 'array'` CASE 가 한다(pgTAP 15·16번). 클라는 성공 응답을
    // 그대로 성공으로 받아들이고 아무 폴백도 시도하지 않는다.
    mockRpc.mockResolvedValue({ data: { success: true, historyCount: 1 }, error: null });

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).resolves.toBeUndefined();

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
