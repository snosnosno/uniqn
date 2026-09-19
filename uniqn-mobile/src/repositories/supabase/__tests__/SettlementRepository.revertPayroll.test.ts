/**
 * 지급 완료 되돌리기 계약 (SETTLE-3 → 감사 P5/L1 로 서버 이전)
 *
 * @description 금전 상태를 역행시키는 조작이므로 되돌리기에는 (1) 사유 강제 (2) 감사 이력
 *   (3) payroll_date 클리어가 강제돼야 한다. 사유 없이 되돌릴 수 있으면 '누가 왜 되돌렸나' 가 사라진다.
 *
 *   🔴 **그 강제가 어디에 있는지가 바뀌었다.** 예전에는 이 클라 메서드가 직접 검증하고
 *   `.update()` 로 이력을 통째 덮어썼다. 그래서 raw PostgREST 로 우회할 수 있었고,
 *   select→update read-modify-write 라 동시 요청이 앞 이력 항목을 조용히 지웠다(Lost Update).
 *   이제는 `set_work_log_payroll_status` RPC 가 FOR UPDATE 로 잠그고 서버에서 강제한다
 *   (마이그 20260802130000).
 *
 *   따라서 이 파일의 책임도 바뀐다:
 *     · 사유 필수·XSS·200자·이력 형태의 **실질 계약**은 pgTAP
 *       `supabase/tests/settlement_payroll_status_rpc.test.sql`(11 assertion)이 지킨다.
 *     · 여기서는 **RPC 를 올바른 인자로 부르는가**, **서버 예외를 앱 에러로 옳게 매핑하는가**,
 *       그리고 **더 이상 work_logs 를 직접 UPDATE 하지 않는가**(전환 회귀 방지)를 지킨다.
 */

import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import { ValidationError, PermissionError, BusinessError, ERROR_CODES } from '@/errors';

const WORK_LOG_ID = 'wl-1';
const ACTOR_ID = 'owner-1';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

const REASON = '금액을 잘못 산정해 지급 완료를 취소합니다';

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockRpc.mockResolvedValue({ data: { success: true }, error: null });
});

describe('updatePayrollStatusWithTransaction — 서버 RPC 위임 계약', () => {
  it('set_work_log_payroll_status 를 정확한 파라미터로 호출한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
      reason: REASON,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcParams] = mockRpc.mock.calls[0];
    expect(rpcName).toBe('set_work_log_payroll_status');
    expect(rpcParams).toEqual({
      p_work_log_id: WORK_LOG_ID,
      p_status: STATUS.PAYROLL.PENDING,
      p_reason: REASON,
    });
  });

  it('사유가 없으면 p_reason 을 null 로 보낸다 (서버가 되돌리기일 때만 강제한다)', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.COMPLETED, ACTOR_ID);

    expect(mockRpc.mock.calls[0][1]).toEqual({
      p_work_log_id: WORK_LOG_ID,
      p_status: STATUS.PAYROLL.COMPLETED,
      p_reason: null,
    });
  });

  /**
   * 🔑 전환 회귀 방지 — 이 단언이 없으면 누군가 클라 직접 UPDATE 를 되살려도 아무도 모른다.
   * 직접 UPDATE 경로가 살아 있으면 서버 강제(사유 필수·FOR UPDATE)가 통째로 우회된다.
   */
  it('work_logs 를 클라에서 직접 UPDATE 하지 않는다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
      reason: REASON,
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('updatePayrollStatusWithTransaction — 서버 예외 매핑', () => {
  it('사유 미입력(INVALID_INPUT)은 VALIDATION_REQUIRED 로 매핑한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('INVALID_INPUT: 지급 완료를 취소하려면 사유를 입력해주세요.'),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID)
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_REQUIRED });
  });

  it('사유 미입력은 ValidationError 인스턴스로 전파된다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('INVALID_INPUT: 지급 완료를 취소하려면 사유를 입력해주세요.'),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('XSS·길이 위반(INVALID_INPUT)은 보안 코드로 매핑한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('INVALID_INPUT: 수정 사유에 허용되지 않는 문자가 포함되어 있습니다'),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
        reason: '<script>alert(1)</script>',
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_XSS_DETECTED });
  });

  it('PERMISSION_DENIED 는 PermissionError 로 매핑한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error(
        'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 상태를 변경할 수 있습니다'
      ),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
        reason: REASON,
      })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('WORK_LOG_NOT_FOUND 는 NOT_FOUND BusinessError 로 매핑한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('WORK_LOG_NOT_FOUND: wl-1'),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
        reason: REASON,
      })
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('서버 문구를 그대로 사용자에게 전달한다 (클라·서버 문구 이중 관리 방지)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('INVALID_INPUT: 수정 사유는 200자 이하여야 합니다'),
    });
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
        reason: 'x'.repeat(201),
      })
    ).rejects.toMatchObject({ userMessage: '수정 사유는 200자 이하여야 합니다' });
  });
});
