/**
 * T-B3: cancel_application_atomically RPC 클라이언트 회귀 테스트
 *
 * @description executeCancelConfirmation 가 RPC를 올바른 파라미터로 호출하고,
 *              에러 / idempotent / success 응답을 모두 처리하는지 검증.
 * @see docs/qa/2026-04-14/team-b-atomicity-spec.md §2
 */

import { executeCancelConfirmation } from '@/repositories/supabase/ApplicationRepositoryTransactions';
import { isAppError } from '@/errors';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/supabase', () => ({
  handleSupabaseError: (error: { message?: string } | null) => {
    throw new Error(`supabase: ${error?.message ?? 'unknown'}`);
  },
  toCamelCase: <T>(x: T) => x,
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Repository helpers (loadApplication 등) — RPC 경로에서는 호출되지 않지만 import 트리 유지
jest.mock('@/repositories/supabase/ApplicationRepositoryHelpers', () => ({
  TABLES: { APPLICATIONS: 'applications', JOB_POSTINGS: 'job_postings', WORK_LOGS: 'work_logs' },
  rethrowOrHandle: (error: unknown) => {
    throw error;
  },
  loadApplication: jest.fn(),
  loadAndVerifyJobPostingAccess: jest.fn(),
}));

describe('executeCancelConfirmation — cancel_application_atomically RPC', () => {
  const APPLICATION_ID = 'app-uuid-123';
  const ACTOR_ID = 'staff-uuid-456';

  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('성공 응답: RPC를 staff_initiates 파라미터로 호출하고 CancelConfirmationResult 반환', async () => {
    const cancelledAtIso = '2026-04-14T12:00:00.000Z';
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        application_id: APPLICATION_ID,
        new_status: 'applied',
        assignment_count: 1,
        new_filled_positions: 0,
        deleted_work_log_count: 1,
        cancelled_at: cancelledAtIso,
      },
      error: null,
    });

    const result = await executeCancelConfirmation(
      APPLICATION_ID,
      ACTOR_ID,
      '개인 사정',
      'staff_initiates'
    );

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('cancel_application_atomically', {
      p_application_id: APPLICATION_ID,
      p_actor_type: 'staff_initiates',
      p_actor_id: ACTOR_ID,
      p_cancel_reason: '개인 사정',
      p_rejection_reason: null,
    });

    expect(result).toEqual({
      applicationId: APPLICATION_ID,
      cancelledAt: new Date(cancelledAtIso),
      restoredStatus: 'applied',
    });
  });

  it('cancelReason 미지정 시 null 로 전달', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        application_id: APPLICATION_ID,
        new_status: 'applied',
        deleted_work_log_count: 0,
        cancelled_at: '2026-04-14T12:00:00.000Z',
      },
      error: null,
    });

    await executeCancelConfirmation(APPLICATION_ID, ACTOR_ID, undefined, 'staff_initiates');

    expect(mockRpc).toHaveBeenCalledWith(
      'cancel_application_atomically',
      expect.objectContaining({ p_cancel_reason: null })
    );
  });

  it('Idempotent 응답(success=true, idempotent=true): 정상 반환', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, idempotent: true },
      error: null,
    });

    const result = await executeCancelConfirmation(
      APPLICATION_ID,
      ACTOR_ID,
      undefined,
      'staff_initiates'
    );

    expect(result.applicationId).toBe(APPLICATION_ID);
    expect(result.restoredStatus).toBe('applied');
    // cancelled_at 누락 시 fallback Date 객체 반환
    expect(result.cancelledAt).toBeInstanceOf(Date);
  });

  it('RPC error 객체 반환 시 throw', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused', code: 'PGRST000' },
    });

    await expect(
      executeCancelConfirmation(APPLICATION_ID, ACTOR_ID, undefined, 'staff_initiates')
    ).rejects.toThrow(/supabase: connection refused/);
  });

  it('success=false 응답: BusinessError 로 throw하며 errorCode 매핑', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'unauthorized' },
      error: null,
    });

    expect.assertions(3);
    try {
      await executeCancelConfirmation(APPLICATION_ID, ACTOR_ID, undefined, 'staff_initiates');
    } catch (err) {
      expect(isAppError(err)).toBe(true);
      if (isAppError(err)) {
        expect(err.userMessage).toContain('권한');
        expect(err.metadata).toMatchObject({ errorCode: 'unauthorized' });
      }
    }
  });

  it('success=false + invalid_status_for_cancellation: 적절한 사용자 메시지', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'invalid_status_for_cancellation',
        current_status: 'cancelled',
      },
      error: null,
    });

    try {
      await executeCancelConfirmation(APPLICATION_ID, ACTOR_ID, undefined, 'staff_initiates');
      throw new Error('expected throw');
    } catch (err) {
      expect(isAppError(err)).toBe(true);
      if (isAppError(err)) {
        expect(err.userMessage).toMatch(/확정된 지원/);
      }
    }
  });

  it('null data + null error: BusinessError(unknown) throw', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    try {
      await executeCancelConfirmation(APPLICATION_ID, ACTOR_ID, undefined, 'staff_initiates');
      throw new Error('expected throw');
    } catch (err) {
      expect(isAppError(err)).toBe(true);
      if (isAppError(err)) {
        expect(err.metadata).toMatchObject({ errorCode: 'unknown' });
      }
    }
  });
});
