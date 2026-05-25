/**
 * executeCancelConfirmation — H5(체크인 후 취소 차단) 에러 매핑 테스트
 *
 * cancel_application_atomically RPC 가 staff_already_checked_in 을 반환하면
 * BusinessError 로 매핑되고 사용자 메시지에 "이미 출근" 안내가 포함되어야 한다.
 */

import {
  executeCancelConfirmation,
  executeReviewCancellation,
} from '../ApplicationRepositoryTransactions';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// ─── ApplicationRepositoryHelpers mock ───────────────────────────────────────
const mockLoadApplication = jest.fn();
const mockLoadAndVerifyJobPostingAccess = jest.fn();

jest.mock('../ApplicationRepositoryHelpers', () => ({
  ...jest.requireActual('../ApplicationRepositoryHelpers'),
  loadApplication: (...args: unknown[]) => mockLoadApplication(...args),
  loadAndVerifyJobPostingAccess: (...args: unknown[]) => mockLoadAndVerifyJobPostingAccess(...args),
}));

describe('executeCancelConfirmation — H5 staff_already_checked_in 매핑', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('staff_already_checked_in 응답을 "이미 출근" 안내가 담긴 BusinessError로 매핑', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'staff_already_checked_in' },
      error: null,
    });

    await expect(executeCancelConfirmation('app-1', 'staff-1')).rejects.toMatchObject({
      userMessage: expect.stringContaining('이미 출근'),
    });
  });
});

// ─── fixtures ────────────────────────────────────────────────────────────────
const fakeFixedJobPosting = {
  id: 'jp-fixed-1',
  ownerId: 'reviewer-uid',
  title: '고정 공고',
  schedule: { kind: 'fixed' },
};

const fakeApplication = {
  id: 'app-2',
  jobPostingId: 'jp-fixed-1',
  applicantId: 'staff-uid',
  applicantName: '홍길동',
  status: 'cancellation_pending',
  cancellationRequest: {
    requestedAt: new Date('2026-06-01'),
    reason: '개인 사정',
    status: 'pending',
  },
  assignments: [],
  confirmationHistory: [],
  originalApplication: null,
  createdAt: new Date('2026-06-01'),
};

describe('executeReviewCancellation — fixed 공고 취소 요청 검토 (SP2 Task 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadApplication.mockResolvedValue(fakeApplication);
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeFixedJobPosting);
  });

  it('fixed 공고 취소 요청 승인 시 "고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다." BusinessError를 던지지 않음', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, idempotent: false, deleted_work_log_count: 1 },
      error: null,
    });

    await expect(
      executeReviewCancellation({ applicationId: 'app-2', approved: true }, 'reviewer-uid')
    ).resolves.not.toThrow();
  });

  it('fixed 공고 취소 요청 승인 시 cancel_application_atomically RPC를 staff_approves_cancel_request로 호출함', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, idempotent: false, deleted_work_log_count: 1 },
      error: null,
    });

    await executeReviewCancellation({ applicationId: 'app-2', approved: true }, 'reviewer-uid');

    expect(mockRpc).toHaveBeenCalledWith(
      'cancel_application_atomically',
      expect.objectContaining({ p_actor_type: 'staff_approves_cancel_request' })
    );
  });
});
