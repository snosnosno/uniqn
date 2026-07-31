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
