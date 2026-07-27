/**
 * 취소 도메인 직접 UPDATE 2곳 — 영향 행 수 검증 (W1-9 / EDIT-2 동일 뿌리).
 *
 * @description 두 지점 모두 상태 CAS 가드(`.eq('status', …)`)는 이미 붙어 있다. 그래서 0행이
 *   **더 잘 나는데** 아무도 그걸 보지 않는 것이 결함의 핵심이다. PostgREST 는 조건 불일치로
 *   0행이 갱신돼도 `error: null` 을 주므로:
 *     · 취소 요청 제출 — 이미 다른 탭에서 취소했거나 사장이 먼저 확정 해제했으면 0행인데
 *       ':422 취소 요청 제출 성공' 로그가 남고 화면은 성공 토스트를 띄운다.
 *     · 취소 요청 거절 — 0행이어도 void 로 끝나고 useCancellationManagement 가 성공 토스트를 띄운다.
 *   둘 다 사용자는 처리됐다고 믿고 화면을 떠난다.
 */
import { SupabaseApplicationRepository } from '../ApplicationRepository';
import { executeReviewCancellation } from '../ApplicationRepositoryTransactions';

import { ERROR_CODES } from '@/errors/AppError';
import { STATUS } from '@/constants';

interface UpdateCall {
  filters: [string, unknown][];
  selected: string | null;
}

const mockDb: {
  calls: UpdateCall[];
  result: { data: unknown[] | null; error: unknown };
} = {
  calls: [],
  result: { data: [{ id: 'app-1' }], error: null },
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => {
        const call: UpdateCall = { filters: [], selected: null };
        mockDb.calls.push(call);
        const builder = {
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return builder;
          },
          select: (columns: string) => {
            call.selected = columns;
            return Promise.resolve(mockDb.result);
          },
        };
        return builder;
      },
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

const mockLoadApplication = jest.fn();
const mockLoadJobPosting = jest.fn();
const mockLoadJobAccess = jest.fn();
jest.mock('../ApplicationRepositoryHelpers', () => ({
  ...jest.requireActual('../ApplicationRepositoryHelpers'),
  loadApplication: (...args: unknown[]) => mockLoadApplication(...args),
  loadJobPosting: (...args: unknown[]) => mockLoadJobPosting(...args),
  loadAndVerifyJobPostingAccess: (...args: unknown[]) => mockLoadJobAccess(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const APPLICANT = '11111111-1111-4111-8111-111111111111';
const REVIEWER = '22222222-2222-4222-8222-222222222222';
const APPLICATION = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mockDb.calls = [];
  mockDb.result = { data: [{ id: APPLICATION }], error: null };
  mockLoadApplication.mockReset();
  mockLoadApplication.mockResolvedValue({
    id: APPLICATION,
    applicantId: APPLICANT,
    jobPostingId: '44444444-4444-4444-8444-444444444444',
    status: STATUS.APPLICATION.CONFIRMED,
  });
  mockLoadJobPosting.mockReset();
  mockLoadJobPosting.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    schedule: { kind: 'dated' },
  });
  mockLoadJobAccess.mockReset();
  mockLoadJobAccess.mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444' });
});

describe('취소 요청 제출 — 0행 false success 차단', () => {
  const repo = new SupabaseApplicationRepository();

  it('갱신 건수를 보려면 select 가 필요하다', async () => {
    await repo.requestCancellationWithTransaction(
      { applicationId: APPLICATION, reason: '개인 사정' },
      APPLICANT
    );

    expect(mockDb.calls).toHaveLength(1);
    expect(mockDb.calls[0]!.selected).toBe('id');
  });

  it('조건에 맞는 행이 없으면(이미 상태가 바뀜) 성공으로 끝내지 않는다', async () => {
    mockDb.result = { data: [], error: null };

    await expect(
      repo.requestCancellationWithTransaction(
        { applicationId: APPLICATION, reason: '개인 사정' },
        APPLICANT
      )
    ).rejects.toMatchObject({ code: ERROR_CODES.BUSINESS_INVALID_STATE });
  });
});

describe('취소 요청 거절 — 0행 false success 차단', () => {
  const input = { applicationId: APPLICATION, approved: false, rejectionReason: '인원 부족' };

  beforeEach(() => {
    mockLoadApplication.mockResolvedValue({
      id: APPLICATION,
      applicantId: APPLICANT,
      jobPostingId: '44444444-4444-4444-8444-444444444444',
      status: STATUS.APPLICATION.CANCELLATION_PENDING,
      cancellationRequest: {
        requestedAt: '2026-07-01T00:00:00.000Z',
        reason: '개인 사정',
        status: STATUS.CANCELLATION_REQUEST.PENDING,
      },
    });
  });

  it('갱신 건수를 보려면 select 가 필요하다', async () => {
    await executeReviewCancellation(input as never, REVIEWER);

    expect(mockDb.calls).toHaveLength(1);
    expect(mockDb.calls[0]!.selected).toBe('id');
  });

  it('조건에 맞는 행이 없으면(이미 처리됨) 성공으로 끝내지 않는다', async () => {
    mockDb.result = { data: [], error: null };

    await expect(executeReviewCancellation(input as never, REVIEWER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
  });
});
