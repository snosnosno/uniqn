/**
 * UserRepository — 탈퇴 파이프라인 계약 (2026-08-07)
 *
 * @description 전체 감사 A2 후속. 두 결함의 회귀 가드다.
 *
 *   1) 탈퇴 사유가 저장되지 않았다 — 화면은 사유를 **필수**로 받는데
 *      `requestDeletion` 의 UPDATE 에 reason 이 아예 없었고(`:222` 주석이 자인),
 *      `getDeletionStatus` 는 항상 'other' 를 반환했다. DB 컬럼도 없었다(20260807140000 에서 추가).
 *
 *   2) status 는 'deactivated' 로 쓴다 — prod `users_status_check` 가 이 값을 거부해
 *      탈퇴 요청 자체가 실패해 왔다(20260807140000 이 제약을 넓혔다).
 *      여기서는 클라가 그 값을 계속 쓴다는 계약만 고정한다.
 *
 *   3) `getWithdrawalImpact` — 탈퇴해도 남는 근무·정산 건수. 영구삭제 RPC 가 익명화만 하므로
 *      화면이 사전 경고를 띄우기 위해 쓴다.
 *
 * contract level (Supabase 호출 인자 + 반환 매핑) 만 검증한다.
 */

import { SupabaseUserRepository } from '../UserRepository';

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

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
}));

function makeChain(returnValue: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'select',
    'update',
    'eq',
    'in',
    'neq',
    'is',
    'not',
    'order',
    'limit',
    'range',
    'maybeSingle',
    'single',
    'returns',
  ]) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as { then?: unknown }).then = function then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

const USER_ID = 'user-1';
const repo = new SupabaseUserRepository();

beforeEach(() => {
  mockFrom.mockReset();
});

describe('requestDeletion — 탈퇴 사유를 실제로 저장한다', () => {
  it('reason 과 reasonDetail 을 UPDATE 에 싣는다', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await repo.requestDeletion(USER_ID, {
      reason: 'privacy_concerns',
      reasonDetail: '개인정보가 걱정됩니다',
      requestedAt: new Date('2026-08-07T00:00:00.000Z'),
      scheduledDeletionAt: new Date('2026-09-06T00:00:00.000Z'),
      status: 'pending',
    });

    expect(mockFrom).toHaveBeenCalledWith('users');
    const payload = chain.update.mock.calls[0][0] as Record<string, unknown>;

    // 결함의 핵심: 이 두 키가 없어서 필수로 받은 사유가 버려졌다.
    expect(payload.deletion_reason).toBe('privacy_concerns');
    expect(payload.deletion_reason_detail).toBe('개인정보가 걱정됩니다');

    // 상태값 계약 — DB 제약(20260807140000)이 허용해야 하는 값
    expect(payload.status).toBe('deactivated');
    expect(chain.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('상세가 비었거나 공백뿐이면 NULL 로 눕힌다', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await repo.requestDeletion(USER_ID, {
      reason: 'no_longer_needed',
      reasonDetail: '   ',
      requestedAt: new Date('2026-08-07T00:00:00.000Z'),
      scheduledDeletionAt: new Date('2026-09-06T00:00:00.000Z'),
      status: 'pending',
    });

    const payload = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.deletion_reason).toBe('no_longer_needed');
    expect(payload.deletion_reason_detail).toBeNull();
  });
});

describe('getDeletionStatus — 저장된 사유를 돌려준다', () => {
  it('DB 의 사유를 그대로 읽는다 (하드코딩 other 아님)', async () => {
    const chain = makeChain({
      data: {
        id: USER_ID,
        status: 'deactivated',
        deletion_requested_at: '2026-08-07T00:00:00.000Z',
        deletion_scheduled_for: '2026-09-06T00:00:00.000Z',
        deletion_reason: 'too_many_notifications',
        deletion_reason_detail: null,
      },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await repo.getDeletionStatus(USER_ID);

    expect(result?.reason).toBe('too_many_notifications');
    expect(result?.status).toBe('pending');
    // 조회 컬럼에 사유가 포함돼야 위 매핑이 성립한다
    expect(chain.select.mock.calls[0][0]).toContain('deletion_reason');
  });

  it('사유 컬럼 도입 이전 행은 other 로 눕힌다', async () => {
    const chain = makeChain({
      data: {
        id: USER_ID,
        status: 'deactivated',
        deletion_requested_at: '2026-07-01T00:00:00.000Z',
        deletion_scheduled_for: '2026-07-31T00:00:00.000Z',
        deletion_reason: null,
        deletion_reason_detail: null,
      },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await repo.getDeletionStatus(USER_ID);
    expect(result?.reason).toBe('other');
    expect(result?.reasonDetail).toBeUndefined();
  });
});

describe('getWithdrawalImpact — 탈퇴해도 남는 것을 센다', () => {
  it('예정 근무와 미정산 급여를 각각 집계한다', async () => {
    const upcoming = makeChain({ data: null, error: null, count: 2 });
    const unsettled = makeChain({ data: null, error: null, count: 1 });
    mockFrom.mockReturnValueOnce(upcoming).mockReturnValueOnce(unsettled);

    const result = await repo.getWithdrawalImpact(USER_ID);

    expect(result).toEqual({ upcomingWorkCount: 2, unsettledPayrollCount: 1 });
    expect(mockFrom).toHaveBeenCalledWith('work_logs');

    // 예정 근무 = 아직 안 끝난 것
    expect(upcoming.in).toHaveBeenCalledWith('status', ['scheduled', 'checked_in']);
    // 미정산 = 근무는 끝났는데 정산이 안 끝난 것 (payroll_status 는 3값이라 !== completed 로 잡는다)
    expect(unsettled.in).toHaveBeenCalledWith('status', ['checked_out', 'completed']);
    expect(unsettled.neq).toHaveBeenCalledWith('payroll_status', 'completed');
  });

  it('count 가 null 이면 0 으로 눕힌다', async () => {
    const upcoming = makeChain({ data: null, error: null });
    const unsettled = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(upcoming).mockReturnValueOnce(unsettled);

    await expect(repo.getWithdrawalImpact(USER_ID)).resolves.toEqual({
      upcomingWorkCount: 0,
      unsettledPayrollCount: 0,
    });
  });
});
