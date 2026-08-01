// src/repositories/supabase/__tests__/SettlementRepository.venueContainer.test.ts
//
// 지점(컨테이너) 직속 배치 근무의 정산 확정 회귀 테스트.
//
// 지키는 불변식 2개:
//  ① 컨테이너 공고는 정산 경로에서 **증발하지 않는다**.
//     `parseJobPostingDocument` 는 컨테이너를 null 로 만든다(schedule 이
//     `{kind, softTargets, roleSalaries}` 라 dated 분기의 .strict() + 필수 필드와 충돌).
//     증발하면 개별 경로는 '공고 데이터를 파싱할 수 없습니다', 일괄 경로는
//     '권한이 없는 공고입니다' 로 실패해 **지점 정산이 통째로 불가능**해진다.
//     → 이 테스트는 `parseJobPostingDocument` 를 **항상 null 로 목**한다. 그래도 성공해야
//       컨테이너 분기가 스키마를 우회하고 있다는 증거가 된다.
//  ② 저장되는 금액이 **지점 단가표 금액**이다(폴백 15,000원이 아니다).
//     canonical 재계산이 호출자 amount 를 덮어쓰므로, 여기가 틀리면 화면과 지급 기록이 갈라진다.
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

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

const mockParseWorkLog = jest.fn();
const mockParseJobPosting = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return {
    ...actual,
    parseWorkLogDocument: (...a: unknown[]) => mockParseWorkLog(...a),
    parseJobPostingDocument: (...a: unknown[]) => mockParseJobPosting(...a),
  };
});

const OWNER = 'owner-1';
const WORK_LOG_ID = 'wl-1';
const VENUE_ID = 'venue-1';
const VENUE_HOURLY = 20000;
const FALLBACK_HOURLY = 15000;
const HOURS = 4;

let jobPostingReadResult: { data: unknown; error: unknown };
let updateCalls: { id: string; data: Record<string, unknown> }[];
let workLogFixture: WorkLog;

/** prod 컨테이너 행 형태 그대로 — `get_or_create_venue_container` 산출물. */
function makeContainerRow(roleSalaries: unknown[]) {
  return {
    id: VENUE_ID,
    title: '스노의 지점',
    status: 'container',
    owner_id: OWNER,
    workspace_id: 'ws-1',
    posting_type: 'regular',
    schedule: { kind: 'dated', softTargets: {}, roleSalaries },
    location: {},
    compensation: {},
    role_catalog: [],
    total_positions: 0,
    filled_positions: 0,
  };
}

function makeFromChain(table: string) {
  let isUpdate = false;
  let pendingUpdate: Record<string, unknown> | undefined;
  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (data: Record<string, unknown>) => {
      isUpdate = true;
      pendingUpdate = data;
      return chain;
    },
    eq: (_col: string, id: string) => {
      if (isUpdate) {
        updateCalls.push({ id, data: pendingUpdate ?? {} });
        return Promise.resolve({ error: null });
      }
      return chain;
    },
    maybeSingle: () =>
      Promise.resolve(
        table === 'work_logs' ? { data: { id: WORK_LOG_ID }, error: null } : jobPostingReadResult
      ),
  };
  return chain;
}

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: false, error: null });
  mockParseWorkLog.mockReset();
  mockParseJobPosting.mockReset();
  updateCalls = [];

  workLogFixture = {
    id: WORK_LOG_ID,
    jobPostingId: VENUE_ID,
    staffId: 'staff-1',
    role: 'dealer',
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    checkInTime: '2026-08-01T10:00:00.000Z',
    checkOutTime: '2026-08-01T14:00:00.000Z',
  } as unknown as WorkLog;

  jobPostingReadResult = {
    data: makeContainerRow([{ role: 'dealer', salary: { type: 'hourly', amount: VENUE_HOURLY } }]),
    error: null,
  };

  mockFrom.mockImplementation((table: string) => makeFromChain(table));
  mockParseWorkLog.mockImplementation(() => workLogFixture);
  // 🔴 컨테이너는 이 파서를 절대 통과하지 못한다. null 고정이 곧 회귀 가드다.
  mockParseJobPosting.mockImplementation(() => null);

  repo = new SupabaseSettlementRepository();
});

describe('지점 컨테이너 정산 확정', () => {
  it('컨테이너 공고가 증발하지 않고 정산이 성공한다', async () => {
    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.success).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].data.payroll_status).toBe(STATUS.PAYROLL.COMPLETED);
  });

  it('지점 단가표 금액으로 저장한다 (폴백 15,000원이 아니다)', async () => {
    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.amount).toBe(VENUE_HOURLY * HOURS);
    expect(result.amount).not.toBe(FALLBACK_HOURLY * HOURS);
    expect(updateCalls[0].data.payroll_amount).toBe(VENUE_HOURLY * HOURS);
  });

  it('단가표에 해당 역할이 없으면 폴백 단가로 저장한다', async () => {
    jobPostingReadResult = {
      data: makeContainerRow([{ role: 'floor', salary: { type: 'hourly', amount: 30000 } }]),
      error: null,
    };

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.amount).toBe(FALLBACK_HOURLY * HOURS);
  });

  it('일반 공고는 여전히 스키마 파서를 거친다 — 증발하면 실패한다', async () => {
    jobPostingReadResult = {
      data: { ...makeContainerRow([]), status: 'active' },
      error: null,
    };

    const result = await repo.settleWorkLogWithTransaction(
      { workLogId: WORK_LOG_ID, amount: 0 },
      OWNER
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('파싱');
    expect(updateCalls).toHaveLength(0);
  });
});

// ============================================================================
// SETTLE-3 — 지급 완료 취소
// ============================================================================
//
// 🔴 이 블록의 계약이 바뀌었다 (감사 P5/L1).
// 되돌리기는 이제 `set_work_log_payroll_status` RPC 에 위임한다(마이그 20260802130000).
// 클라가 공고를 더 이상 파싱하지 않으므로 **컨테이너 증발 결함의 영향권에서 아예 벗어났다** —
// 전환의 부수 효과이고, 아래 두 번째 테스트가 그것을 증거로 고정한다.
//
// 사유 필수·XSS·200자·이력 형태의 실질 계약은 서버로 옮겨갔고
// pgTAP `supabase/tests/settlement_payroll_status_rpc.test.sql`(11 assertion)이 지킨다.
// 확정(settleWorkLogWithTransaction)은 아직 클라 파서를 거치므로
// 위 '지점 컨테이너 정산 확정' describe 가 증발 회귀를 계속 지킨다.
describe('지점 컨테이너 지급 완료 취소 (SETTLE-3 → 서버 RPC 위임)', () => {
  const REASON = '금액을 잘못 산정해 다시 계산합니다';

  beforeEach(() => {
    workLogFixture = {
      ...workLogFixture,
      payrollStatus: STATUS.PAYROLL.COMPLETED,
      payrollDate: '2026-08-01T15:00:00.000Z',
      payrollAmount: VENUE_HOURLY * HOURS,
    } as unknown as WorkLog;
  });

  it('되돌리기는 RPC 에 위임하고 work_logs 를 직접 UPDATE 하지 않는다', async () => {
    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, OWNER, {
      reason: REASON,
    });

    expect(mockRpc).toHaveBeenCalledWith('set_work_log_payroll_status', {
      p_work_log_id: WORK_LOG_ID,
      p_status: STATUS.PAYROLL.PENDING,
      p_reason: REASON,
    });
    // 직접 UPDATE 경로가 되살아나면 서버 강제(사유 필수·FOR UPDATE)가 통째로 우회된다.
    expect(updateCalls).toHaveLength(0);
  });

  it('공고 파서가 null 을 반환해도 되돌리기가 막히지 않는다 — 컨테이너 증발 영향권 이탈', async () => {
    // 전환 전에는 이 상황에서 '파싱할 수 없습니다' 로 죽어, 컨테이너 직속 행이
    // 확정도 취소도 못 하는 편도 문이 됐다. 이제 클라는 공고를 아예 읽지 않는다.
    mockParseJobPosting.mockReturnValue(null);

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, OWNER, {
        reason: REASON,
      })
    ).resolves.toBeUndefined();
  });
});
