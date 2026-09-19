// src/repositories/supabase/__tests__/SettlementRepository.venueContainer.test.ts
//
// 지점(컨테이너) 직속 배치 근무의 정산 확정·취소 회귀 테스트.
//
// 🔴 이 파일의 계약이 감사 L1 잔여에서 바뀌었다.
//
// 전환 전: 확정은 클라가 공고를 읽어 `parseJobPostingDocument` 로 파싱하고 금액을 계산했다.
//   컨테이너는 그 파서에서 **null 로 증발**했고(schedule 이 `{kind, softTargets, roleSalaries}` 라
//   dated 분기의 `.strict()` + 필수 필드와 충돌), 증상은 '공고 데이터를 파싱할 수 없습니다' 였다.
//   그래서 이 파일은 "파서를 null 로 목해도 성공하는가"와 "지점 단가표 금액으로 저장하는가"를
//   클라에서 검증했다.
//
// 전환 후: 확정도 되돌리기도 **서버 RPC 단일 왕복**이다. 클라는 공고를 아예 읽지 않는다.
//   → 컨테이너 증발 결함의 영향권에서 확정·취소 둘 다 벗어났고, 그것이 이 전환의 부수 효과다.
//   → 지점 단가표 해소·폴백 단가 같은 **금액 규칙은 이제 서버에 있다**:
//        supabase/tests/settlement_amount_calc.test.sql (순수 함수 픽스처)
//        src/domains/settlement/__tests__/settlementAmountParity.test.ts (짝 픽스처)
//   여기서 지키는 것은 "클라가 직접 쓰지 않고 서버 값을 그대로 쓴다" 하나로 좁혀졌다.
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';

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
const VENUE_HOURLY = 20000;
const HOURS = 4;

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  repo = new SupabaseSettlementRepository();
});

describe('지점 컨테이너 정산 확정 (서버 RPC 위임)', () => {
  it('확정은 settle_work_log RPC 1회로 끝나고 work_logs 를 직접 UPDATE 하지 않는다', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, workLogId: WORK_LOG_ID, amount: VENUE_HOURLY * HOURS },
      error: null,
    });

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: VENUE_HOURLY * HOURS },
      OWNER
    );

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('settle_work_log', {
      p_work_log_id: WORK_LOG_ID,
      p_notes: null,
    });
    // 🔴 직접 쓰기가 남아 있으면 L1 3단계(payroll 컬럼 직접 UPDATE 차단)를 걸 수 없다.
    //    또한 클라가 공고를 읽지 않는다는 증거이기도 하다 — 컨테이너 증발 영향권 이탈.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('저장 금액은 서버가 돌려준 canonical 값이다 (클라가 다시 계산하지 않는다)', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, workLogId: WORK_LOG_ID, amount: VENUE_HOURLY * HOURS },
      error: null,
    });

    // 호출자가 엉뚱한 금액을 넘겨도 결과는 서버 값이다.
    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 1 },
      OWNER
    );

    expect(result.amount).toBe(VENUE_HOURLY * HOURS);
  });

  it('🔴 응답 형태가 낯설면 0원 성공으로 접지 않는다 (fail-closed)', async () => {
    // amount 누락 — 통과시키면 화면에 "0원 정산 완료"가 뜨고 payroll_amount 도 0 으로 굳는다.
    mockRpc.mockResolvedValue({ data: { success: true, workLogId: WORK_LOG_ID }, error: null });

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.success).toBe(false);
    expect(result.amount).toBe(0);
    expect(result.message).toContain('정산 결과를 확인할 수 없습니다');
  });

  it('서버 도메인 에러는 throw 하지 않고 {success:false, message} 로 접힌다 (화면 계약)', async () => {
    // 프로덕션 형태 그대로 — supabase-js 의 PostgrestError 는 Error 를 상속한다.
    mockRpc.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('ALREADY_SETTLED: 이미 정산 완료되었습니다'), {
        code: 'P0001',
      }),
    });

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('이미 정산 완료되었습니다');
  });

  it('출퇴근 미완료(INVALID_STATUS)는 동시성 특례로 오분류되지 않는다', async () => {
    // ⚠️ 공통 핸들러에는 `P0001 && INVALID_STATUS` 를 confirm_application 동시성으로 보는
    //    특례가 있다. 매퍼가 이 케이스를 먼저 잡지 않으면 "다른 사용자가 먼저 처리했어요"라는
    //    거짓 안내가 나간다(P5 에서 실제로 그럴 뻔했다).
    mockRpc.mockResolvedValue({
      data: null,
      error: Object.assign(
        new Error('INVALID_STATUS: 출퇴근이 완료된 근무 기록만 정산할 수 있습니다'),
        { code: 'P0001' }
      ),
    });

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.message).toBe('출퇴근이 완료된 근무 기록만 정산할 수 있습니다');
  });

  it('🔑 Error 를 상속하지 않은 에러 모양도 접두사 매칭이 살아 있다', async () => {
    // `instanceof Error` 만 보고 String(error) 로 떨어지면 평범한 객체가 '[object Object]' 가 되어
    // 매칭이 통째로 무력화되고 서버 문구 대신 '알 수 없는 오류'가 화면에 나간다.
    // PostgrestError 는 Error 를 상속하지만 이 경계에 다른 모양이 들어올 수 있다.
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산할 수 있습니다' },
    });

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.message).toBe('권한이 있는 공고의 근무 기록만 정산할 수 있습니다');
  });
});

// ============================================================================
// SETTLE-3 — 지급 완료 취소
// ============================================================================
//
// 사유 필수·XSS·200자·이력 형태의 실질 계약은 서버에 있고
// pgTAP `supabase/tests/settlement_payroll_status_rpc.test.sql` 이 지킨다.
describe('지점 컨테이너 지급 완료 취소 (SETTLE-3 → 서버 RPC 위임)', () => {
  const REASON = '금액을 잘못 산정해 다시 계산합니다';

  it('되돌리기는 RPC 에 위임하고 work_logs 를 직접 UPDATE 하지 않는다', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, OWNER, {
      reason: REASON,
    });

    expect(mockRpc).toHaveBeenCalledWith('set_work_log_payroll_status', {
      p_work_log_id: WORK_LOG_ID,
      p_status: STATUS.PAYROLL.PENDING,
      p_reason: REASON,
    });
    // 직접 UPDATE 경로가 되살아나면 서버 강제(사유 필수·FOR UPDATE)가 통째로 우회된다.
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
