/**
 * SupabaseConfirmedStaffRepository.markAsNoShow 회귀 테스트
 *
 * @description 감사 3-2(정산 완료 근무를 노쇼로 뒤집을 수 있는 단방향 비대칭) 회귀 가드.
 *
 *   `cancelNoShow` 는 정산 완료 건을 `BUSINESS_ALREADY_SETTLED` 로 거부하는데
 *   (`ConfirmedStaffRepository.cancelNoShow.test.ts` 가 이미 고정) 정반대 방향인
 *   `markAsNoShow` 에는 같은 잠금이 없었다. 그래서 '지급 완료 + 노쇼' 모순 행이
 *   DB 에 쌓이고, 스태프 월 수입 합계(=completed 만 합산)에서 **실제 받은 급여가 사라진다**.
 *
 *   서버 3경로(QR 출근 clamp·status 화이트리스트·퇴근 시각 검증)는 이미 동일하게
 *   `payroll_status='completed'` 를 차단하고 있어, 이 비대칭 자체가 결함의 증거였다.
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
    status: STATUS.WORK_LOG.COMPLETED,
    checkInTime: '2026-01-01T09:00:00.000Z',
    checkOutTime: '2026-01-01T18:00:00.000Z',
    payrollStatus: undefined,
    ...overrides,
  } as WorkLog;
}

describe('SupabaseConfirmedStaffRepository.markAsNoShow', () => {
  let repo: SupabaseConfirmedStaffRepository;

  beforeEach(() => {
    mockFrom.mockReset();
    mockParseWorkLogDocument.mockReset();
    repo = new SupabaseConfirmedStaffRepository();
  });

  it('정산이 완료된 근무 기록은 BUSINESS_ALREADY_SETTLED로 거부한다 (cancelNoShow 와 대칭)', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await expect(
      repo.markAsNoShow({ workLogId: 'wl-1', actorId: 'owner-1', reason: '연락 두절' })
    ).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_ALREADY_SETTLED,
    });

    // 거부는 던지는 것으로 끝나면 안 된다 — UPDATE 가 실제로 발사되지 않아야 한다.
    expect(updateChain.update).not.toHaveBeenCalled();
  });

  it('정산 완료 안내는 되돌리기 탈출 경로를 알려준다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    mockFrom.mockReturnValueOnce(workLogChain).mockReturnValueOnce(jobPostingChain);

    await expect(
      repo.markAsNoShow({ workLogId: 'wl-1', actorId: 'owner-1', reason: '연락 두절' })
    ).rejects.toMatchObject({
      userMessage: expect.stringContaining('정산'),
    });
  });

  it('정산 전(미정산)이면 노쇼로 정상 처리한다 (무회귀 가드)', async () => {
    mockParseWorkLogDocument.mockReturnValue(makeWorkLog({ payrollStatus: undefined }));

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await repo.markAsNoShow({ workLogId: 'wl-1', actorId: 'owner-1', reason: '연락 두절' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: STATUS.WORK_LOG.NO_SHOW,
        no_show_reason: '연락 두절',
      })
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'wl-1');
  });

  it('정산 대기(pending) 상태는 노쇼 처리를 막지 않는다', async () => {
    mockParseWorkLogDocument.mockReturnValue(
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.PENDING })
    );

    const workLogChain = makeChain({ data: { id: 'wl-1' }, error: null });
    const jobPostingChain = makeChain({ data: { id: 'job-1', owner_id: 'owner-1' }, error: null });
    const updateChain = makeChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(workLogChain)
      .mockReturnValueOnce(jobPostingChain)
      .mockReturnValueOnce(updateChain);

    await repo.markAsNoShow({ workLogId: 'wl-1', actorId: 'owner-1', reason: '연락 두절' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: STATUS.WORK_LOG.NO_SHOW })
    );
  });
});
