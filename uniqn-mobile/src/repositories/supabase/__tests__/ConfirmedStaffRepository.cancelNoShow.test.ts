/**
 * SupabaseConfirmedStaffRepository.cancelNoShow 회귀 테스트
 *
 * @description 노쇼 되돌리기(취소) 경로 — 상태 재구성, 노쇼 아닌 건 거부,
 *              정산완료 건 거부, 소유권 불일치 거부를 잠근다.
 */
import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { STATUS } from '@/constants';
import { ERROR_CODES } from '@/errors';
import type { WorkLog } from '@/types';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockParseWorkLogDocument = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return {
    ...actual,
    parseWorkLogDocument: (...args: unknown[]) => mockParseWorkLogDocument(...args),
  };
});

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'update']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(returnValue));
  return chain as Record<string, jest.Mock>;
}

function makeWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'wl-1',
    jobPostingId: 'job-1',
    status: STATUS.WORK_LOG.NO_SHOW,
    noShowAt: '2026-01-01T00:00:00.000Z',
    noShowReason: '연락 두절',
    checkInTime: undefined,
    checkOutTime: undefined,
    payrollStatus: undefined,
    ...overrides,
  } as WorkLog;
}

describe('SupabaseConfirmedStaffRepository.cancelNoShow', () => {
  let repo: SupabaseConfirmedStaffRepository;

  beforeEach(() => {
    mockFrom.mockReset();
    mockParseWorkLogDocument.mockReset();
    repo = new SupabaseConfirmedStaffRepository();
  });

  it('출퇴근 기록이 없으면 scheduled로 복구하고 노쇼 필드를 정리한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(makeWorkLog());

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: STATUS.WORK_LOG.SCHEDULED,
        no_show_at: null,
        no_show_reason: null,
      })
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'wl-1');
  });

  it('출근 기록만 있으면 checked_in으로 복구한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ checkInTime: '2026-01-01T09:00:00.000Z' })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: STATUS.WORK_LOG.CHECKED_IN })
    );
  });

  it('출퇴근 기록이 모두 있으면 checked_out으로 복구한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({
        checkInTime: '2026-01-01T09:00:00.000Z',
        checkOutTime: '2026-01-01T18:00:00.000Z',
      })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: STATUS.WORK_LOG.CHECKED_OUT })
    );
  });

  it('노쇼 처리된 근무 기록이 아니면 BUSINESS_INVALID_STATE로 거부한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ status: STATUS.WORK_LOG.SCHEDULED, noShowAt: undefined })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    mockFrom.mockReturnValueOnce(workLogChain).mockReturnValueOnce(jobPostingChain);

    await expect(
      repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' })
    ).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
  });

  it('정산이 완료된 근무 기록은 BUSINESS_ALREADY_SETTLED로 거부한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    mockFrom.mockReturnValueOnce(workLogChain).mockReturnValueOnce(jobPostingChain);

    await expect(
      repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' })
    ).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_ALREADY_SETTLED,
    });
  });

  it('공고 소유자가 아니면 SECURITY_UNAUTHORIZED_ACCESS로 거부한다', async () => {
    mockParseWorkLogDocument.mockReturnValue(makeWorkLog());

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({
      data: { id: 'job-1', owner_id: 'other-owner' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(workLogChain).mockReturnValueOnce(jobPostingChain);

    await expect(
      repo.cancelNoShow({ workLogId: 'wl-1', ownerId: 'owner-1' })
    ).rejects.toMatchObject({
      code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
    });
  });
});
