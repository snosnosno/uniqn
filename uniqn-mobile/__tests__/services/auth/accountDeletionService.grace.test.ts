/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * T-D5: WF-18 계정 삭제 30일 grace period 단위 테스트
 *
 * 시나리오:
 * 1. 삭제 요청 생성 → scheduledDeletionAt = now + 30일
 * 2. 25일 경과 → 복구 가능 (cancelAccountDeletion 호출 가능)
 * 3. 31일 경과 → getDeletionStatus가 completed/null 반환
 * 4. 취소(복구) 후 재요청 → 새 30일 타이머
 */

import { STATUS } from '@/constants';
import type { DeletionRequest } from '@/repositories';

const mockGetUser = jest.fn();
const mockRequestDeletion = jest.fn();
const mockCancelDeletion = jest.fn();
const mockGetDeletionStatus = jest.fn();
const mockFunctionsInvoke = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    requestDeletion: (...args: unknown[]) => mockRequestDeletion(...args),
    cancelDeletion: (...args: unknown[]) => mockCancelDeletion(...args),
    getDeletionStatus: (...args: unknown[]) => mockGetDeletionStatus(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/services/auth/appleAuthService', () => ({
  requestAppleAuthorization: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
  toDate: jest.fn((d: unknown) => d),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

/** email provider 유저 */
const mockEmailUser = {
  id: 'user-grace-test',
  email: 'grace@example.com',
  app_metadata: { providers: ['email'] },
};

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const DAYS_25_MS = 25 * 24 * 60 * 60 * 1000;
const DAYS_31_MS = 31 * 24 * 60 * 60 * 1000;

type AccountDeletionServiceModule = typeof import('@/services/auth/accountDeletionService');

function loadModule(): AccountDeletionServiceModule {
  let moduleUnderTest: AccountDeletionServiceModule | undefined;
  jest.isolateModules(() => {
    moduleUnderTest =
      require('@/services/auth/accountDeletionService') as AccountDeletionServiceModule;
  });
  return moduleUnderTest!;
}

describe('WF-18 Grace Period — accountDeletionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    jest.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { ...mockEmailUser } },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockRequestDeletion.mockResolvedValue(undefined);
    mockCancelDeletion.mockResolvedValue(undefined);
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('시나리오 1: 삭제 요청 생성 시 scheduledDeletionAt = now + 30일', async () => {
    const { requestAccountDeletion, DELETION_GRACE_PERIOD_DAYS } = loadModule();

    expect(DELETION_GRACE_PERIOD_DAYS).toBe(30);

    await requestAccountDeletion('no_longer_needed', 'password123');

    expect(mockRequestDeletion).toHaveBeenCalledTimes(1);

    const [userId, requestData] = mockRequestDeletion.mock.calls[0] as [
      string,
      Omit<DeletionRequest, 'userId'>,
    ];

    expect(userId).toBe('user-grace-test');

    const expectedScheduledAt = new Date(FIXED_NOW.getTime() + DAYS_30_MS);
    expect(requestData.scheduledDeletionAt).toEqual(expectedScheduledAt);
    expect(requestData.status).toBe(STATUS.DELETION_REQUEST.PENDING);
  });

  it('시나리오 2: 25일 경과 → status=pending 상태에서 cancelAccountDeletion 호출 가능(복구 가능)', async () => {
    const { cancelAccountDeletion } = loadModule();

    // 삭제 요청 후 25일 경과 시뮬레이션
    jest.advanceTimersByTime(DAYS_25_MS);

    const pendingRequest: DeletionRequest = {
      userId: 'user-grace-test',
      reason: 'no_longer_needed',
      requestedAt: FIXED_NOW,
      scheduledDeletionAt: new Date(FIXED_NOW.getTime() + DAYS_30_MS),
      status: STATUS.DELETION_REQUEST.PENDING,
    };

    mockGetDeletionStatus.mockResolvedValue(pendingRequest);

    // 25일 경과 시 아직 grace period 내이므로 취소 가능
    await cancelAccountDeletion('user-grace-test');

    expect(mockCancelDeletion).toHaveBeenCalledTimes(1);
    expect(mockCancelDeletion).toHaveBeenCalledWith('user-grace-test');
  });

  it('시나리오 3: 31일 경과 → getDeletionStatus가 completed 또는 null 반환', async () => {
    const { getDeletionStatus } = loadModule();

    // 31일 경과 → DB 레벨에서 completed 처리됨을 mock으로 표현
    jest.advanceTimersByTime(DAYS_31_MS);

    const completedRequest: DeletionRequest = {
      userId: 'user-grace-test',
      reason: 'no_longer_needed',
      requestedAt: FIXED_NOW,
      scheduledDeletionAt: new Date(FIXED_NOW.getTime() + DAYS_30_MS),
      status: STATUS.DELETION_REQUEST.COMPLETED,
    };

    mockGetDeletionStatus.mockResolvedValue(completedRequest);

    const result = await getDeletionStatus('user-grace-test');

    // 31일 후: completed 상태 또는 null(완전 삭제 후 레코드 없음) 중 하나여야 함
    if (result !== null) {
      expect(result.status).toBe(STATUS.DELETION_REQUEST.COMPLETED);
    } else {
      expect(result).toBeNull();
    }

    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-grace-test');
  });

  it('시나리오 4: 취소(복구) 후 재요청 → 새 30일 타이머로 scheduledDeletionAt 갱신', async () => {
    const { cancelAccountDeletion, requestAccountDeletion } = loadModule();

    // Step 1: 취소 (복구)
    await cancelAccountDeletion('user-grace-test');
    expect(mockCancelDeletion).toHaveBeenCalledTimes(1);

    // Step 2: 10일 경과 후 재요청
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    jest.advanceTimersByTime(TEN_DAYS_MS);

    const timeOfRerequest = new Date(FIXED_NOW.getTime() + TEN_DAYS_MS);

    // Step 3: 재요청
    await requestAccountDeletion('privacy_concerns', 'password123');

    expect(mockRequestDeletion).toHaveBeenCalledTimes(1);

    const [userId, requestData] = mockRequestDeletion.mock.calls[0] as [
      string,
      Omit<DeletionRequest, 'userId'>,
    ];

    expect(userId).toBe('user-grace-test');

    // 새 scheduledDeletionAt = 재요청 시각 + 30일
    const expectedNewScheduledAt = new Date(timeOfRerequest.getTime() + DAYS_30_MS);
    expect(requestData.scheduledDeletionAt).toEqual(expectedNewScheduledAt);
    expect(requestData.status).toBe(STATUS.DELETION_REQUEST.PENDING);
  });
});
