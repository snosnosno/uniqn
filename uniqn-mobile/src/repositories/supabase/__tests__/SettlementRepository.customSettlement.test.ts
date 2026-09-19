// src/repositories/supabase/__tests__/SettlementRepository.customSettlement.test.ts
//
// updateWorkLogCustomSettlement 의 **RPC 계약** 테스트 (감사 S-D, 마이그 20260807190000).
//
// 🔄 계약 전환 (2026-08-07): 이 파일은 원래 클라이언트가 직접 하던 일을 고정했다 —
//    소유권 선행 조회 → payrollStatus 확인 → AlreadySettledError → from().update().
//    그 전부가 서버 RPC 로 옮겨갔다(read-modify-write 의 이력 Lost Update 를 닫기 위해서다).
//    따라서 여기서 지킬 것은 **호출 계약**이다: 무엇을 어떤 이름으로 보내는가, 서버 에러를
//    어떤 앱 에러로 되돌리는가, 그리고 직접 UPDATE 로 되돌아가지 않았는가.
//    동작 자체(잠금·동결·이력 누적)의 진실원은 pgTAP settlement_custom_rpc.test.sql 이다.
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { AlreadySettledError, ERROR_CODES } from '@/errors';
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
    modificationEntry: { at: '2026-07-11T00:00:00.000Z', by: OWNER },
  };
}

/** 서버가 RAISE 한 도메인 에러의 PostgREST 표현. */
function rpcError(message: string) {
  return { data: null, error: { message, code: 'P0001' } };
}

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { success: true, historyCount: 1 }, error: null });
  repo = new SupabaseSettlementRepository();
});

describe('updateWorkLogCustomSettlement — RPC 계약', () => {
  it('RPC 를 1회 호출하고 인자 이름·값이 서버 시그니처와 일치한다', async () => {
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_work_log_custom_settlement', {
      p_work_log_id: WORK_LOG_ID,
      p_custom_salary_info: data.customSalaryInfo,
      p_custom_tax_settings: data.customTaxSettings,
      p_modification_entry: data.modificationEntry,
      p_custom_allowances: data.customAllowances,
    });
  });

  it('🔑 직접 UPDATE 로 되돌아가지 않는다 — from() 을 아예 부르지 않는다', async () => {
    // 이 단언이 이 파일의 회귀 방어다. 클라가 다시 work_logs 를 직접 쓰면
    // 이력 append 가 read-modify-write 로 돌아가 Lost Update 가 되살아난다.
    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('수당 미설정(undefined)은 null 로 명시해 보낸다 — 키 생략이 아니다', async () => {
    // 키를 생략하면 "수당을 지웠다"와 "수당을 안 건드렸다"가 같은 요청이 된다.
    // 이 화면의 계약은 항상 전량 저장이므로 부재 = 공고 기본 수당 사용 = null 이다.
    const data = { ...makeCustomSettlementData(), customAllowances: undefined };

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    const args = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args).toHaveProperty('p_custom_allowances', null);
  });

  it('정산 완료 건(서버 ALREADY_SETTLED) → AlreadySettledError 로 되돌린다', async () => {
    mockRpc.mockResolvedValue(
      rpcError('ALREADY_SETTLED: 정산이 완료된 근무 기록은 정산 설정을 수정할 수 없습니다')
    );

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toBeInstanceOf(AlreadySettledError);
  });

  it('정산 완료 차단 에러 코드는 전환 전과 같은 BUSINESS_ALREADY_SETTLED 다', async () => {
    mockRpc.mockResolvedValue(
      rpcError('ALREADY_SETTLED: 정산이 완료된 근무 기록은 정산 설정을 수정할 수 없습니다')
    );

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({ code: ERROR_CODES.BUSINESS_ALREADY_SETTLED });
  });

  it('권한 없음(서버 PERMISSION_DENIED) → 서버 문구를 그대로 사용자에게 노출한다', async () => {
    mockRpc.mockResolvedValue(
      rpcError('PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 설정을 수정할 수 있습니다')
    );

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({
      code: ERROR_CODES.INFRA_PERMISSION_DENIED,
      userMessage: '권한이 있는 공고의 근무 기록만 정산 설정을 수정할 수 있습니다',
    });
  });

  it('근무기록 없음(서버 WORK_LOG_NOT_FOUND) → INFRA_NOT_FOUND', async () => {
    mockRpc.mockResolvedValue(rpcError('WORK_LOG_NOT_FOUND: 근무 기록을 찾을 수 없습니다'));

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({ code: ERROR_CODES.INFRA_NOT_FOUND });
  });

  it('사유 XSS(서버 INVALID_INPUT) → 보안 코드로 접는다', async () => {
    mockRpc.mockResolvedValue(
      rpcError('INVALID_INPUT: 수정 사유에 허용되지 않는 문자가 포함되어 있습니다')
    );

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_XSS_DETECTED });
  });

  it('형식 오류(서버 INVALID_INPUT, 보안 아님) → VALIDATION_FORMAT', async () => {
    mockRpc.mockResolvedValue(rpcError('INVALID_INPUT: 급여 설정 형식이 올바르지 않습니다'));

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FORMAT });
  });
});
