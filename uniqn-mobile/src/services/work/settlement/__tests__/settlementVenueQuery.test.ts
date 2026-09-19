/**
 * settlementVenueQuery.getVenueSettlementWorkLogs — 운영처 정산 reader 테스트
 *
 * 근무표 Phase 4(정산). 검증 대상:
 * - 날짜범위를 repo(SQL .gte/.lte)로 이전 — 본 서비스는 클라 날짜필터를 하지 않는다(R5).
 *   repo 가 반환한 work_log 는 추가 날짜 잘림 없이 전부 결과에 포함.
 * - SettlementCalculator 재사용으로 예상 정산액(calculatedAmount)/근무시간(hoursWorked) 부가.
 * - 컨테이너 직속 배치(getByIdBatch 미반환)는 폴백 컨텍스트로 계산(증발/에러 없음).
 * - 날짜 외 부가 필터(역할/정산상태)는 클라단 적용.
 */
import type { JobPosting, WorkLog } from '@/types';

import { getVenueSettlementWorkLogs } from '@/services/work/settlement/settlementVenueQuery';

// ============================================================================
// Mock Setup
// ============================================================================

const mockGetByVenueSpanInRange = jest.fn();
const mockGetByIdBatch = jest.fn();
const mockGetVenueContainerById = jest.fn();
const mockGetPostingSettlementContext = jest.fn();
const mockCalculate = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByVenueSpanInRange: (...args: unknown[]) => mockGetByVenueSpanInRange(...args),
  },
  jobPostingRepository: {
    getByIdBatch: (...args: unknown[]) => mockGetByIdBatch(...args),
    getVenueContainerById: (...args: unknown[]) => mockGetVenueContainerById(...args),
  },
}));

jest.mock('@/domains/job-posting', () => ({
  getPostingSettlementContext: (...args: unknown[]) => mockGetPostingSettlementContext(...args),
}));

jest.mock('@/utils/settlement', () => ({
  getEffectiveAllowances: jest.fn(() => undefined),
  getEffectiveTaxSettings: jest.fn(() => undefined),
}));

jest.mock('@/utils/settlement/constants', () => ({
  DEFAULT_SALARY_INFO: { type: 'hourly', amount: 15000 },
}));

// resolveEffectiveSalaryWithSource 는 실제 구현(출처 판정)을 검증 대상으로 삼는다.
// SettlementCalculator 만 목으로 대체해 금액 계산을 결정적으로 고정한다.
jest.mock('@/domains/settlement', () => {
  const actual = jest.requireActual('@/domains/settlement');
  return {
    SettlementCalculator: {
      calculate: (...args: unknown[]) => mockCalculate(...args),
    },
    resolveEffectiveSalaryWithSource: actual.resolveEffectiveSalaryWithSource,
    // 순수 함수 — 실물을 그대로 쓴다. 이게 목이면 읽기 경로가 쓰기 경로와 같은 컨텍스트를
    // 쓰는지를 이 테스트가 더 이상 검증하지 못한다(그게 이 함수의 존재 이유다).
    buildVenueContainerContext: actual.buildVenueContainerContext,
  };
});

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

// ============================================================================
// Fixtures
// ============================================================================

function workLog(overrides: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl',
    jobPostingId: 'p-open-1',
    staffId: 's1',
    date: '2026-07-10',
    status: 'checked_out',
    role: 'dealer',
    checkInTime: '2026-07-10T10:00:00Z',
    checkOutTime: '2026-07-10T18:00:00Z',
    payrollStatus: 'pending',
    ...overrides,
  } as unknown as WorkLog;
}

const openPosting = {
  id: 'p-open-1',
  title: '강남홀덤 7월 토너 보조',
} as unknown as JobPosting;

const DATE_RANGE = { start: '2026-07-01', end: '2026-07-31' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetByIdBatch.mockResolvedValue([openPosting]);
  mockGetVenueContainerById.mockResolvedValue(null);
  mockGetPostingSettlementContext.mockReturnValue({
    roles: [],
    defaultSalary: { type: 'hourly', amount: 15000 },
    allowances: undefined,
    taxSettings: undefined,
  });
  mockCalculate.mockReturnValue({ hoursWorked: 8, afterTaxPay: 80000 });
});

describe('getVenueSettlementWorkLogs', () => {
  it('R5: 날짜범위를 repo SQL 경계로 위임(venueId,start,end) — 클라 날짜필터 없이 전부 포함', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-1' }),
      workLog({ id: 'wl-2', jobPostingId: 'v1' }), // 컨테이너 직속
    ]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(mockGetByVenueSpanInRange).toHaveBeenCalledWith('v1', '2026-07-01', '2026-07-31');
    // repo 가 SQL 로 이미 날짜/상태 필터함 → 서비스는 추가 잘림 없이 2건 전부 반환.
    expect(result).toHaveLength(2);
  });

  it('SettlementCalculator 재사용으로 calculatedAmount/hoursWorked 부가', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([workLog({ id: 'wl-1' })]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(mockCalculate).toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: 'wl-1',
      hoursWorked: 8,
      calculatedAmount: 80000,
      jobPostingTitle: '강남홀덤 7월 토너 보조',
    });
  });

  it('스팬 공고를 getByIdBatch 로 일괄 로드(중복 제거)해 정산 컨텍스트 맵 구성', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-1', jobPostingId: 'p-open-1' }),
      workLog({ id: 'wl-2', jobPostingId: 'p-open-1' }),
    ]);

    await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(mockGetByIdBatch).toHaveBeenCalledWith(['p-open-1']);
  });

  it('컨테이너 직속 배치(getByIdBatch 미반환)는 폴백 컨텍스트로 계산(증발/에러 없음)', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([workLog({ id: 'wl-c', jobPostingId: 'v1' })]);
    mockGetByIdBatch.mockResolvedValue([]); // B4: 컨테이너는 by-id 배치에서 제외됨

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(result).toHaveLength(1);
    expect(result[0].calculatedAmount).toBe(80000);
    expect(result[0].jobPostingTitle).toBeUndefined();
  });

  it('payrollStatus 필터(날짜 외 부가 필터)는 클라단 적용', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-pending', payrollStatus: 'pending' }),
      workLog({ id: 'wl-done', payrollStatus: 'completed' }),
    ]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE, {
      payrollStatus: 'completed',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wl-done');
  });

  it('role 필터(커스텀 역할 other+customRole 매칭 포함)', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-dealer', role: 'dealer' }),
      workLog({ id: 'wl-custom', role: 'other', customRole: '주차요원' } as Partial<WorkLog>),
    ]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE, { role: '주차요원' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wl-custom');
  });

  it('빈 스팬 결과면 getByIdBatch 호출 없이 빈 배열', async () => {
    mockGetByVenueSpanInRange.mockResolvedValue([]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(result).toEqual([]);
    expect(mockGetByIdBatch).not.toHaveBeenCalled();
  });

  it('repo 에러는 handleServiceError 경유 전파', async () => {
    mockGetByVenueSpanInRange.mockRejectedValue(new Error('boom'));

    await expect(getVenueSettlementWorkLogs('v1', DATE_RANGE)).rejects.toThrow('boom');
  });

  it('컨테이너 직속 배치 + 단가표 매칭 → salarySource=roleTable(단가표 급여로 계산)', async () => {
    const dealerSalary = { type: 'hourly', amount: 25000 };
    mockGetVenueContainerById.mockResolvedValue({
      id: 'v1',
      name: '강남홀덤',
      roleSalaries: [{ role: 'dealer', salary: dealerSalary }],
    });
    // 컨테이너 직속 배치(jobPostingId=venueId) — by-id 배치에서는 컨테이너 제외(B4).
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-c', jobPostingId: 'v1', role: 'dealer' }),
    ]);
    mockGetByIdBatch.mockResolvedValue([]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(mockGetVenueContainerById).toHaveBeenCalledWith('v1');
    expect(result[0].salarySource).toBe('roleTable');
    expect(result[0].salaryInfo).toEqual(dealerSalary);
    // 금액이 폴백(₩15,000)이 아니라 단가표(₩25,000) 기준으로 계산됐는지 — calculator 입력 검증.
    expect(mockCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ salaryInfo: dealerSalary })
    );
  });

  it('컨테이너 직속 배치 + 단가표 미매칭 → salarySource=fallback(₩15,000 무회귀)', async () => {
    mockGetVenueContainerById.mockResolvedValue({
      id: 'v1',
      name: '강남홀덤',
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
    });
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({ id: 'wl-c', jobPostingId: 'v1', role: 'serving' }),
    ]);
    mockGetByIdBatch.mockResolvedValue([]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(result[0].salarySource).toBe('fallback');
    expect(result[0].salaryInfo).toEqual({ type: 'hourly', amount: 15000 });
    expect(mockCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ salaryInfo: { type: 'hourly', amount: 15000 } })
    );
  });

  it('customSalaryInfo 보유 → salarySource=override(단가표보다 우선)', async () => {
    const override = { type: 'daily', amount: 200000 };
    mockGetVenueContainerById.mockResolvedValue({
      id: 'v1',
      name: '강남홀덤',
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
    });
    mockGetByVenueSpanInRange.mockResolvedValue([
      workLog({
        id: 'wl-c',
        jobPostingId: 'v1',
        role: 'dealer',
        customSalaryInfo: override,
      } as Partial<WorkLog>),
    ]);
    mockGetByIdBatch.mockResolvedValue([]);

    const result = await getVenueSettlementWorkLogs('v1', DATE_RANGE);

    expect(result[0].salarySource).toBe('override');
    expect(result[0].salaryInfo).toEqual(override);
  });
});
