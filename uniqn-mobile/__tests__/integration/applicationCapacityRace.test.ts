/**
 * T-D6: WF-06 지원 정원 race condition 테스트
 *
 * @description executeConfirmWithHistory 를 Promise.all 로 동시 호출해
 *              정원 초과 시 MaxCapacityReachedError 또는 BusinessError 가 발생하는지 검증.
 * @see docs/qa — WF-06 Application Capacity Race Condition
 */

import { executeConfirmWithHistory } from '@/repositories/supabase/ApplicationRepositoryTransactions';

// ── Mock 선언 ────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock('@/utils/supabase', () => ({
  handleSupabaseError: (error: { message?: string } | null) => {
    throw new Error(`supabase: ${error?.message ?? 'unknown'}`);
  },
  toCamelCase: <T>(x: T) => x,
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/repositories/supabase/ApplicationRepositoryHelpers', () => ({
  TABLES: { APPLICATIONS: 'applications', JOB_POSTINGS: 'job_postings', WORK_LOGS: 'work_logs' },
  rethrowOrHandle: (error: unknown) => {
    throw error;
  },
  loadApplication: jest.fn(),
  loadAndVerifyJobPostingAccess: jest.fn(),
}));

jest.mock('@/domains/application', () => ({
  findActiveConfirmation: jest.fn().mockReturnValue(null),
  validateAssignmentSlotCapacity: jest.fn(),
  createHistoryEntry: jest
    .fn()
    .mockReturnValue({ timestamp: new Date(), assignorId: 'employer-1' }),
}));

jest.mock('@/types/assignment', () => ({
  normalizeAssignmentRole: jest.fn().mockReturnValue({ role: 'dealer', customRole: null }),
}));

jest.mock('@/constants', () => ({
  STATUS: {
    APPLICATION: { APPLIED: 'applied', CONFIRMED: 'confirmed' },
    CANCELLATION_REQUEST: { PENDING: 'pending', REJECTED: 'rejected' },
    WORK_LOG: { SCHEDULED: 'scheduled' },
  },
}));

jest.mock('@/errors', () => {
  class AppError extends Error {
    userMessage?: string;
    metadata?: Record<string, unknown>;
    constructor(opts: { code?: string; userMessage?: string; metadata?: Record<string, unknown> }) {
      super(opts.userMessage ?? opts.code ?? 'AppError');
      this.name = 'AppError';
      this.userMessage = opts.userMessage;
      this.metadata = opts.metadata;
    }
  }
  class BusinessError extends AppError {
    constructor(code: string, opts?: { userMessage?: string; metadata?: Record<string, unknown> }) {
      super({ code, userMessage: opts?.userMessage, metadata: opts?.metadata });
      this.name = 'BusinessError';
      Object.setPrototypeOf(this, BusinessError.prototype);
    }
  }
  class MaxCapacityReachedError extends BusinessError {
    constructor(opts?: {
      userMessage?: string;
      jobPostingId?: string;
      maxCapacity?: number;
      currentCount?: number;
    }) {
      super('E6043', {
        userMessage: opts?.userMessage ?? '모집 인원이 마감되었습니다.',
        metadata: { jobPostingId: opts?.jobPostingId },
      });
      this.name = 'MaxCapacityReachedError';
      Object.setPrototypeOf(this, MaxCapacityReachedError.prototype);
    }
  }
  class ValidationError extends AppError {
    constructor(code: string, opts?: { userMessage?: string }) {
      super({ code, userMessage: opts?.userMessage });
      this.name = 'ValidationError';
      Object.setPrototypeOf(this, ValidationError.prototype);
    }
  }
  return {
    AppError,
    BusinessError,
    MaxCapacityReachedError,
    ValidationError,
    ERROR_CODES: {
      BUSINESS_INVALID_STATE: 'E6042',
      BUSINESS_MAX_CAPACITY_REACHED: 'E6043',
      VALIDATION_REQUIRED: 'E3001',
    },
    isAppError: (e: unknown): boolean =>
      e instanceof Error &&
      ('userMessage' in e || e.name === 'BusinessError' || e.name === 'MaxCapacityReachedError'),
    isMaxCapacityReachedError: (e: unknown): boolean =>
      e instanceof Error && e.name === 'MaxCapacityReachedError',
  };
});

// ── 헬퍼 타입 ────────────────────────────────────────────────────────────────

type MockFn = jest.Mock<any, any>;

// ── 픽스처 헬퍼 ──────────────────────────────────────────────────────────────

function makeAssignment(overrides = {}) {
  return {
    groupId: 'g1',
    dates: ['2026-04-15'],
    roleIds: ['dealer'],
    timeSlot: '09:00~18:00',
    ...overrides,
  };
}

function makeApplication(id: string, overrides = {}) {
  return {
    id,
    jobPostingId: 'job-1',
    status: 'applied',
    assignments: [makeAssignment()],
    applicantId: `staff-${id}`,
    applicantName: `지원자-${id}`,
    confirmationHistory: [],
    ...overrides,
  };
}

function makeJobPosting(totalPositions: number, filledPositions: number) {
  return {
    id: 'job-1',
    ownerId: 'employer-1',
    title: '테스트 공고',
    filledPositions,
    totalPositions,
    schedule: {
      kind: 'dated',
      requirements: [
        {
          date: '2026-04-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [{ role: 'dealer', count: totalPositions, filled: filledPositions }],
            },
          ],
        },
      ],
    },
  };
}

function rpcSuccess() {
  return { data: { success: true, workLogIds: ['wl-1'] }, error: null };
}

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe('WF-06: 지원 정원 race condition', () => {
  const OWNER_ID = 'employer-1';

  // mock 함수 참조 — 런타임에 jest.mocked 없이 캐스팅
  let mockLoadApplication: MockFn;
  let mockLoadAndVerifyJobPostingAccess: MockFn;
  let mockValidateAssignmentSlotCapacity: MockFn;

  beforeEach(() => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const helpers = require('@/repositories/supabase/ApplicationRepositoryHelpers');
    mockLoadApplication = helpers.loadApplication as MockFn;
    mockLoadAndVerifyJobPostingAccess = helpers.loadAndVerifyJobPostingAccess as MockFn;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const domain = require('@/domains/application');
    mockValidateAssignmentSlotCapacity = domain.validateAssignmentSlotCapacity as MockFn;

    mockRpc.mockReset();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 시나리오 1: 정원 1 공고 + 2명 동시 → 1성공 1실패
  // race 시뮬레이션: validateAssignmentSlotCapacity 호출 횟수로 정원 초과 판단
  // ─────────────────────────────────────────────────────────────────────────
  it('정원 1 공고에 2명 동시 confirm → 1명 성공, 1명 MaxCapacityReachedError', async () => {
    mockLoadApplication
      .mockResolvedValueOnce(makeApplication('app-1'))
      .mockResolvedValueOnce(makeApplication('app-2'));

    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(makeJobPosting(1, 0));

    // 첫 번째 validateAssignmentSlotCapacity 호출: 정원 여유 있음
    // 두 번째 호출: 첫 번째가 이미 정원을 소비했다고 가정 (race 시뮬레이션)
    let validateCallCount = 0;
    mockValidateAssignmentSlotCapacity.mockImplementation(() => {
      validateCallCount++;
      if (validateCallCount === 1) {
        return { available: true, issues: [] };
      }
      // 두 번째 호출: 이미 정원 소비됨
      return {
        available: false,
        issues: [
          {
            date: '2026-04-15',
            timeSlot: '09:00',
            roleId: 'dealer',
            count: 1,
            filled: 1,
            requested: 1,
            remaining: 0,
          },
        ],
      };
    });

    mockRpc.mockResolvedValue(rpcSuccess());

    const results = await Promise.allSettled([
      executeConfirmWithHistory('app-1', undefined, OWNER_ID),
      executeConfirmWithHistory('app-2', undefined, OWNER_ID),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failedReason = (rejected[0] as PromiseRejectedResult).reason as Error;
    expect(failedReason.name).toBe('MaxCapacityReachedError');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 시나리오 2: 성공 후 filledPositions=1 증가 확인
  // ─────────────────────────────────────────────────────────────────────────
  it('성공한 confirm 이후 filled_positions 가 1 증가한다', async () => {
    let filledPositions = 0;

    mockLoadApplication.mockResolvedValue(makeApplication('app-1'));
    mockLoadAndVerifyJobPostingAccess.mockImplementation(async () =>
      makeJobPosting(1, filledPositions)
    );

    mockValidateAssignmentSlotCapacity.mockReturnValue({ available: true, issues: [] });

    mockRpc.mockImplementation(async () => {
      filledPositions++;
      return rpcSuccess();
    });

    await executeConfirmWithHistory('app-1', undefined, OWNER_ID);

    expect(filledPositions).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 시나리오 3: 정원 3 공고 + 3명 동시 → 모두 성공
  // ─────────────────────────────────────────────────────────────────────────
  it('정원 3 공고에 3명 동시 confirm → 모두 성공', async () => {
    let filledPositions = 0;
    const CAPACITY = 3;

    mockLoadApplication
      .mockResolvedValueOnce(makeApplication('app-1'))
      .mockResolvedValueOnce(makeApplication('app-2'))
      .mockResolvedValueOnce(makeApplication('app-3'));

    mockLoadAndVerifyJobPostingAccess.mockImplementation(async () =>
      makeJobPosting(CAPACITY, filledPositions)
    );

    mockValidateAssignmentSlotCapacity.mockReturnValue({ available: true, issues: [] });

    mockRpc.mockImplementation(async () => {
      filledPositions++;
      return rpcSuccess();
    });

    const results = await Promise.allSettled([
      executeConfirmWithHistory('app-1', undefined, OWNER_ID),
      executeConfirmWithHistory('app-2', undefined, OWNER_ID),
      executeConfirmWithHistory('app-3', undefined, OWNER_ID),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(0);
    expect(filledPositions).toBe(3);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 시나리오 4: 정원 2 공고 + 3명 동시 → 2성공 1실패 (경계값)
  // race 시뮬레이션: 처음 2번은 available=true, 3번째는 available=false
  // ─────────────────────────────────────────────────────────────────────────
  it('정원 2 공고에 3명 동시 confirm → 2성공 1실패 (경계값)', async () => {
    const CAPACITY = 2;

    mockLoadApplication
      .mockResolvedValueOnce(makeApplication('app-1'))
      .mockResolvedValueOnce(makeApplication('app-2'))
      .mockResolvedValueOnce(makeApplication('app-3'));

    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(makeJobPosting(CAPACITY, 0));

    // 처음 2번은 통과, 3번째는 정원 초과
    let validateCallCount = 0;
    mockValidateAssignmentSlotCapacity.mockImplementation(() => {
      validateCallCount++;
      if (validateCallCount <= 2) {
        return { available: true, issues: [] };
      }
      return {
        available: false,
        issues: [
          {
            date: '2026-04-15',
            timeSlot: '09:00',
            roleId: 'dealer',
            count: CAPACITY,
            filled: CAPACITY,
            requested: 1,
            remaining: 0,
          },
        ],
      };
    });

    mockRpc.mockResolvedValue(rpcSuccess());

    const results = await Promise.allSettled([
      executeConfirmWithHistory('app-1', undefined, OWNER_ID),
      executeConfirmWithHistory('app-2', undefined, OWNER_ID),
      executeConfirmWithHistory('app-3', undefined, OWNER_ID),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);

    const failedReason = (rejected[0] as PromiseRejectedResult).reason as Error;
    expect(failedReason).toBeInstanceOf(Error);
    expect(
      failedReason.name === 'MaxCapacityReachedError' || failedReason.name === 'BusinessError'
    ).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 시나리오 5: validateAssignmentSlotCapacity unavailable → MaxCapacityReachedError
  // ─────────────────────────────────────────────────────────────────────────
  it('validateAssignmentSlotCapacity unavailable 반환 시 capacity 에러 throw', async () => {
    mockLoadApplication.mockResolvedValue(makeApplication('app-1'));
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(makeJobPosting(1, 1));

    mockValidateAssignmentSlotCapacity.mockReturnValue({
      available: false,
      issues: [
        {
          date: '2026-04-15',
          timeSlot: '09:00',
          roleId: 'dealer',
          count: 1,
          filled: 1,
          requested: 1,
          remaining: 0,
        },
      ],
    });

    await expect(executeConfirmWithHistory('app-1', undefined, OWNER_ID)).rejects.toMatchObject({
      name: 'MaxCapacityReachedError',
    });
  });
});
