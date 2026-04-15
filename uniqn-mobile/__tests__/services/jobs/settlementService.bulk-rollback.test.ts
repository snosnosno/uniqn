/**
 * T-D9: WF-11 정산 bulk settlement 부분 실패 처리
 *
 * @description bulkSettlement 서비스가 repository 결과를 올바르게 집계·전파하는지 검증.
 *              - partial commit (일부 성공, 일부 실패) 시나리오
 *              - 전체 성공 / 전체 실패 경계 케이스
 *              - repository throw 시 에러 재전파
 *              - 권한 없는 ownerId → PermissionError 재전파
 */

import { bulkSettlement } from '@/services/work/settlement';

// ============================================================================
// Mocks
// ============================================================================

const mockBulkSettlementWithTransaction = jest.fn();

jest.mock('@/repositories', () => ({
  settlementRepository: {
    bulkSettlementWithTransaction: (...args: unknown[]) =>
      mockBulkSettlementWithTransaction(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => {
  class BusinessError extends Error {
    constructor(code: string, opts?: { userMessage?: string }) {
      super(opts?.userMessage ?? code);
      this.name = 'BusinessError';
    }
  }

  class PermissionError extends Error {
    public code: string;
    constructor(code: string, opts?: { userMessage?: string }) {
      super(opts?.userMessage ?? code);
      this.name = 'PermissionError';
      this.code = code;
    }
  }

  return {
    BusinessError,
    PermissionError,
    ERROR_CODES: {
      INFRA_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6042',
    },
    isAppError: (e: unknown) => e instanceof BusinessError || e instanceof PermissionError,
  };
});

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

// ============================================================================
// Test helpers
// ============================================================================

function makeBulkResult(
  workLogIds: string[],
  failIndices: number[] = []
): {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  results: {
    success: boolean;
    workLogId: string;
    amount: number;
    message: string;
  }[];
} {
  const results = workLogIds.map((id, i) => ({
    success: !failIndices.includes(i),
    workLogId: id,
    amount: failIndices.includes(i) ? 0 : 120_000,
    message: failIndices.includes(i) ? '정산 처리 실패' : '정산 완료',
  }));

  return {
    totalCount: workLogIds.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    totalAmount: results.reduce((s, r) => s + r.amount, 0),
    results,
  };
}

const SIX_IDS = ['wl-1', 'wl-2', 'wl-3', 'wl-4', 'wl-5', 'wl-6'];
const OWNER_ID = 'owner-abc';

// ============================================================================
// Tests
// ============================================================================

describe('bulkSettlement — WF-11 partial commit / rollback', () => {
  beforeEach(() => {
    mockBulkSettlementWithTransaction.mockReset();
  });

  // --------------------------------------------------------------------------
  // 시나리오 1: 전체 성공
  // --------------------------------------------------------------------------
  it('시나리오 1: 6개 모두 성공 → { totalCount:6, successCount:6, failedCount:0 }', async () => {
    const mockResult = makeBulkResult(SIX_IDS);
    mockBulkSettlementWithTransaction.mockResolvedValueOnce(mockResult);

    const result = await bulkSettlement({ workLogIds: SIX_IDS }, OWNER_ID);

    expect(result.totalCount).toBe(6);
    expect(result.successCount).toBe(6);
    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(6);
    expect(result.results.every((r) => r.success)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 시나리오 2: 마지막 1개 실패 (partial commit)
  // --------------------------------------------------------------------------
  it('시나리오 2: 마지막 1개 실패 → successCount:5, failedCount:1, results[5].success=false', async () => {
    const mockResult = makeBulkResult(SIX_IDS, [5]);
    mockBulkSettlementWithTransaction.mockResolvedValueOnce(mockResult);

    const result = await bulkSettlement({ workLogIds: SIX_IDS }, OWNER_ID);

    expect(result.totalCount).toBe(6);
    expect(result.successCount).toBe(5);
    expect(result.failedCount).toBe(1);
    expect(result.results[5].success).toBe(false);
    expect(result.results[5].workLogId).toBe('wl-6');
    // 서비스 레이어는 throw하지 않고 결과 집계 반환
    expect(result.results[5].message).toBe('정산 처리 실패');
  });

  // --------------------------------------------------------------------------
  // 시나리오 3: 전체 실패
  // --------------------------------------------------------------------------
  it('시나리오 3: 전체 실패 → successCount:0, failedCount:6, totalAmount:0', async () => {
    const mockResult = makeBulkResult(SIX_IDS, [0, 1, 2, 3, 4, 5]);
    mockBulkSettlementWithTransaction.mockResolvedValueOnce(mockResult);

    const result = await bulkSettlement({ workLogIds: SIX_IDS }, OWNER_ID);

    expect(result.totalCount).toBe(6);
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(6);
    expect(result.totalAmount).toBe(0);
    expect(result.results.every((r) => !r.success)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 시나리오 4: repository 레벨 에러 (throw)
  // --------------------------------------------------------------------------
  it('시나리오 4: repository가 throw → bulkSettlement도 동일 에러 throw', async () => {
    const repoError = new Error('DB connection failed');
    mockBulkSettlementWithTransaction.mockRejectedValueOnce(repoError);

    await expect(bulkSettlement({ workLogIds: SIX_IDS }, OWNER_ID)).rejects.toThrow(
      'DB connection failed'
    );
  });

  // --------------------------------------------------------------------------
  // 시나리오 5: 권한 없는 ownerId → PermissionError throw
  // --------------------------------------------------------------------------
  it('시나리오 5: PermissionError throw → bulkSettlement도 동일 PermissionError throw', async () => {
    const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors') as {
      PermissionError: new (
        code: string,
        opts?: { userMessage?: string }
      ) => Error & {
        code: string;
      };
      ERROR_CODES: { INFRA_PERMISSION_DENIED: string };
    };

    const permError = new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: '정산 처리 권한이 없습니다.',
    });
    mockBulkSettlementWithTransaction.mockRejectedValueOnce(permError);

    const thrownError = await bulkSettlement({ workLogIds: SIX_IDS }, 'unauthorized-owner').catch(
      (e: unknown) => e
    );

    expect(thrownError).toBe(permError);
    expect((thrownError as { name: string }).name).toBe('PermissionError');
    expect((thrownError as { code: string }).code).toBe(ERROR_CODES.INFRA_PERMISSION_DENIED);
  });
});
