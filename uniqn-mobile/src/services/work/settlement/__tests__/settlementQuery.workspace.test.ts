/**
 * Phase 2A.후속 P0 hotfix (2026-05-10)
 *
 * settlementQuery 의 owner-only 가드를 loadAndVerifyJobPostingAccess (owner|member|admin) 로
 * 교체. 4 역할 시나리오 + not-found / non-permission 에러 propagation 검증.
 */

import type { JobPosting, WorkLog } from '@/types';

// Import after mocks
import {
  getWorkLogsByJobPosting,
  getJobPostingSettlementSummary,
} from '@/services/work/settlement/settlementQuery';
import { PermissionError, BusinessError, ERROR_CODES } from '@/errors';

// ============================================================================
// Mock Setup (호이스팅)
// ============================================================================

const mockLoadAndVerifyJobPostingAccess = jest.fn();
const mockGetByJobPostingId = jest.fn();
const mockGetPostingSettlementContext = jest.fn();

jest.mock('@/repositories/supabase/ApplicationRepositoryHelpers', () => ({
  loadAndVerifyJobPostingAccess: (...args: unknown[]) => mockLoadAndVerifyJobPostingAccess(...args),
}));

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByJobPostingId: (...args: unknown[]) => mockGetByJobPostingId(...args),
  },
  jobPostingRepository: {
    getManagedJobPostings: jest.fn(),
  },
}));

jest.mock('@/domains/job-posting', () => ({
  getPostingSettlementContext: (...args: unknown[]) => mockGetPostingSettlementContext(...args),
}));

jest.mock('@/utils/jobPostingVisibility', () => ({
  isCanonicalDatedPosting: jest.fn(() => true),
}));

jest.mock('@/utils/settlement', () => ({
  getEffectiveSalaryInfoFromRoles: jest.fn(() => ({ type: 'hourly', rate: 10000 })),
  getEffectiveAllowances: jest.fn(() => []),
  getEffectiveTaxSettings: jest.fn(() => ({ rate: 0 })),
}));

jest.mock('@/domains/settlement', () => ({
  SettlementCalculator: {
    calculate: jest.fn(() => ({ hoursWorked: 8, afterTaxPay: 80000 })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/errors', () => {
  class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = options?.userMessage || code;
    }
  }
  class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = options?.userMessage || code;
    }
  }
  return {
    BusinessError,
    PermissionError,
    ERROR_CODES: {
      INFRA_NOT_FOUND: 'E4002',
      INFRA_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6002',
    },
  };
});

jest.mock('@/constants', () => ({
  STATUS: {
    WORK_LOG: {
      CANCELLED: 'cancelled',
      CHECKED_OUT: 'checked_out',
      COMPLETED: 'completed',
    },
    PAYROLL: {
      COMPLETED: 'completed',
    },
  },
}));

// ============================================================================
// Fixtures
// ============================================================================

const fakeJobPosting = {
  id: 'jp-1',
  ownerId: 'owner-uid',
  workspaceId: 'ws-1',
  title: '테스트 공고',
  status: 'active',
} as unknown as JobPosting;

const emptySettlementContext = {
  roles: [],
  defaultSalary: { type: 'hourly', rate: 10000 },
  allowances: [],
  taxSettings: { rate: 0 },
};

// ============================================================================
// Tests — getWorkLogsByJobPosting
// ============================================================================

describe('getWorkLogsByJobPosting — 4 역할 권한 호환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByJobPostingId.mockResolvedValue([]);
    mockGetPostingSettlementContext.mockReturnValue(emptySettlementContext);
  });

  it('owner 본인 호출 시 통과 (helper 가 posting 반환)', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const result = await getWorkLogsByJobPosting('jp-1', 'owner-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'owner-uid',
      '공고별 근무 기록 조회'
    );
    expect(result).toEqual([]);
  });

  it('워크스페이스 멤버 호출 시 통과 (Phase 2A.후속 호환)', async () => {
    // helper 가 멤버 통과시 posting 반환
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const result = await getWorkLogsByJobPosting('jp-1', 'member-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'member-uid',
      '공고별 근무 기록 조회'
    );
    expect(mockGetByJobPostingId).toHaveBeenCalledWith('jp-1');
    expect(result).toEqual([]);
  });

  it('admin 호출 시 통과', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const result = await getWorkLogsByJobPosting('jp-1', 'admin-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'admin-uid',
      '공고별 근무 기록 조회'
    );
    expect(result).toEqual([]);
  });

  it('외부인 호출 시 PermissionError propagate', async () => {
    const permissionError = new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: '워크스페이스 멤버만 관리할 수 있습니다: 공고별 근무 기록 조회',
    });
    mockLoadAndVerifyJobPostingAccess.mockRejectedValue(permissionError);

    await expect(getWorkLogsByJobPosting('jp-1', 'stranger-uid')).rejects.toThrow(PermissionError);

    expect(mockGetByJobPostingId).not.toHaveBeenCalled();
  });

  it('존재하지 않는 공고 호출 시 BusinessError(NOT_FOUND) propagate', async () => {
    const notFoundError = new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
    mockLoadAndVerifyJobPostingAccess.mockRejectedValue(notFoundError);

    await expect(getWorkLogsByJobPosting('non-existent', 'owner-uid')).rejects.toThrow(
      BusinessError
    );

    expect(mockGetByJobPostingId).not.toHaveBeenCalled();
  });

  it('필터 적용 (workspace member 가 dateRange 필터로 조회)', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);
    mockGetByJobPostingId.mockResolvedValue([
      {
        id: 'wl-1',
        date: '2026-05-10',
        status: 'checked_out',
        role: 'dealer',
        checkInTime: '2026-05-10T10:00:00Z',
        checkOutTime: '2026-05-10T18:00:00Z',
      } as unknown as WorkLog,
    ]);

    const result = await getWorkLogsByJobPosting('jp-1', 'member-uid', {
      dateRange: { start: '2026-05-01', end: '2026-05-31' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wl-1');
  });
});

// ============================================================================
// Tests — getJobPostingSettlementSummary
// ============================================================================

describe('getJobPostingSettlementSummary — 4 역할 권한 호환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByJobPostingId.mockResolvedValue([]);
    mockGetPostingSettlementContext.mockReturnValue(emptySettlementContext);
  });

  it('owner 본인 호출 시 통과', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const summary = await getJobPostingSettlementSummary('jp-1', 'owner-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'owner-uid',
      '공고별 정산 요약 조회'
    );
    expect(summary.jobPostingId).toBe('jp-1');
    expect(summary.totalWorkLogs).toBe(0);
  });

  it('워크스페이스 멤버 호출 시 통과', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const summary = await getJobPostingSettlementSummary('jp-1', 'member-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'member-uid',
      '공고별 정산 요약 조회'
    );
    expect(summary.jobPostingTitle).toBe('테스트 공고');
  });

  it('admin 호출 시 통과', async () => {
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

    const summary = await getJobPostingSettlementSummary('jp-1', 'admin-uid');

    expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
      'jp-1',
      'admin-uid',
      '공고별 정산 요약 조회'
    );
    expect(summary).toBeDefined();
  });

  it('외부인 호출 시 PermissionError propagate', async () => {
    const permissionError = new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: '워크스페이스 멤버만 관리할 수 있습니다: 공고별 정산 요약 조회',
    });
    mockLoadAndVerifyJobPostingAccess.mockRejectedValue(permissionError);

    await expect(getJobPostingSettlementSummary('jp-1', 'stranger-uid')).rejects.toThrow(
      PermissionError
    );

    expect(mockGetByJobPostingId).not.toHaveBeenCalled();
  });

  it('존재하지 않는 공고 호출 시 BusinessError(NOT_FOUND) propagate', async () => {
    const notFoundError = new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
    mockLoadAndVerifyJobPostingAccess.mockRejectedValue(notFoundError);

    await expect(getJobPostingSettlementSummary('non-existent', 'owner-uid')).rejects.toThrow(
      BusinessError
    );

    expect(mockGetByJobPostingId).not.toHaveBeenCalled();
  });
});
