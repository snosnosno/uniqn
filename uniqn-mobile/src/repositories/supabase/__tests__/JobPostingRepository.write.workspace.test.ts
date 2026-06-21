/**
 * Phase 2A.후속 — write-side workspace member + admin 호환
 * PR3-A.2 (2026-05-11) — admin 분기 silent no-op 차단: loadAndVerifyMutateAccess admin throw
 *
 * @description JobPostingRepository.{update,delete,close,reopen,updateSettlementSettings}
 *              의 access verification 분기 검증. loadAndVerifyMutateAccess 는 PR3-A.2 후
 *              owner|member 만 통과 (admin 은 PermissionError throw — RLS app_update/wl_update
 *              admin 분기 제거 후 silent no-op 방지). loadAndVerifyDeleteAccess 는 unchanged
 *              (job_postings.jp_delete 는 PR3-A.2 범위 외, admin pass-through 유지).
 *
 * 권한 매트릭스 (PR3-A.2 후):
 * | flow              | owner | member | admin           | outsider |
 * |-------------------|-------|--------|-----------------|----------|
 * | updateWith        | OK    | OK     | reject (PR3-A.2)| reject   |
 * | closeWith         | OK    | OK     | reject (PR3-A.2)| reject   |
 * | reopenWith        | OK    | OK     | reject (PR3-A.2)| reject   |
 * | updateSettlement  | OK    | OK     | reject (PR3-A.2)| reject   |
 * | deleteWith        | OK    | reject | OK              | reject   |
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { PermissionError } from '@/errors';

// ── Mock Supabase ────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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

// 핵심: parseJobPostingDocument 가 fakeJobPosting 을 반환하도록 mock
const mockParseJobPosting = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return {
    ...actual,
    parseJobPostingDocument: (...args: unknown[]) => mockParseJobPosting(...args),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const OUTSIDER_ID = '44444444-4444-4444-8444-444444444444';
const POSTING_ID = '55555555-5555-4555-8555-555555555555';
const WORKSPACE_ID = '66666666-6666-4666-8666-666666666666';

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'in',
    'is',
    'order',
    'limit',
    'range',
    'update',
    'insert',
    'delete',
    'upsert',
  ]) {
    chain[m] = jest.fn(() => chain);
  }
  for (const m of ['single', 'maybeSingle']) {
    chain[m] = jest.fn(() => Promise.resolve(returnValue));
  }
  (chain as { then?: unknown }).then = function then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

const fakePosting = {
  id: POSTING_ID,
  ownerId: OWNER_ID,
  workspaceId: WORKSPACE_ID,
  title: '234',
  status: 'active' as const,
  schemaVersion: 3,
  workDate: '2026-05-09',
  workDates: ['2026-05-09'],
  roleKeys: ['dealer'],
  totalPositions: 1,
  filledPositions: 0,
  viewCount: 0,
  createdAt: new Date('2026-05-09T00:00:00Z'),
  updatedAt: new Date('2026-05-09T00:00:00Z'),
  ownerName: 'Owner',
  postingType: 'regular',
  location: { name: '강남' },
  schedule: {
    kind: 'dated' as const,
    primaryDate: '2026-05-09',
    allDates: ['2026-05-09'],
    requirements: [],
  },
  roleCatalog: [{ role: 'dealer' }],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

function setupLoadAndUpdate() {
  // 1st from() — loadJobPostingForVerify (.select.eq.maybeSingle)
  // 2nd from() — actual UPDATE (.update.eq).then resolves to {error: null}
  const loadChain = makeChain({
    data: { id: POSTING_ID, owner_id: OWNER_ID, workspace_id: WORKSPACE_ID },
    error: null,
  });
  const updateChain = makeChain({ data: null, error: null });
  mockFrom.mockReturnValueOnce(loadChain).mockReturnValue(updateChain);
  mockParseJobPosting.mockReturnValue(fakePosting);
  return { loadChain, updateChain };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockParseJobPosting.mockReset();
});

// ============================================================================
// Mutate access (update/close/reopen/settlement)
// ============================================================================

describe('JobPostingRepository write-side — loadAndVerifyMutateAccess (owner|member, PR3-A.2 admin reject)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('owner 본인의 close 호출은 RPC 0회로 통과한다', async () => {
    setupLoadAndUpdate();

    await repo.closeWithTransaction(POSTING_ID, OWNER_ID).catch(() => {
      // 본 테스트는 access 분기만 검증 — 후속 비즈니스 로직 fail 여부는 무관
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('워크스페이스 멤버의 close 호출은 is_workspace_member RPC 통과 후 진행', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    await repo.closeWithTransaction(POSTING_ID, MEMBER_ID).catch(() => {});

    expect(mockRpc).toHaveBeenCalledWith('is_workspace_member', {
      _workspace_id: WORKSPACE_ID,
      _user_id: MEMBER_ID,
    });
    // is_workspace_member 가 true 면 is_admin 안 부름
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  // PR3-A.2 (2026-05-11): admin 분기 silent no-op 차단 — RLS app_update/wl_update admin
  // 분기 제거 후 helper 통과 시 0 row affected 로 false success. helper 단계에서 throw.
  it('admin 호출은 PermissionError 로 거절된다 (PR3-A.2 silent no-op 차단)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_admin') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    await expect(repo.closeWithTransaction(POSTING_ID, ADMIN_ID)).rejects.toThrow(PermissionError);
    // is_workspace_member 호출 후 is_admin 호출 → throw
    expect(mockRpc).toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith('is_admin');
  });

  it('admin 이지만 본인 owner 인 jobPosting 은 owner 분기 우선 (RPC 0회)', async () => {
    setupLoadAndUpdate();
    // ADMIN_ID 가 OWNER_ID 와 같으면 owner 분기로 통과
    await repo.closeWithTransaction(POSTING_ID, OWNER_ID).catch(() => {});
    // owner 분기로 short-circuit → admin RPC 호출 없음
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('admin 이지만 워크스페이스 멤버 인 사용자는 member 분기 우선 (admin RPC 미호출)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    await repo.closeWithTransaction(POSTING_ID, ADMIN_ID).catch(() => {});

    // member 통과 → is_admin 미호출
    expect(mockRpc).toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith('is_admin');
  });

  it('외부인의 close 호출은 PermissionError 로 거절된다', async () => {
    setupLoadAndUpdate();
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(repo.closeWithTransaction(POSTING_ID, OUTSIDER_ID)).rejects.toThrow(
      PermissionError
    );
  });

  it('reopenWithTransaction 도 동일 분기 (member 통과)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'is_workspace_member', error: null })
    );

    await repo.reopenWithTransaction(POSTING_ID, MEMBER_ID).catch(() => {});

    expect(mockRpc).toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
  });

  it('updateSettlementSettings 의 admin 호출도 PR3-A.2 throw (silent no-op 차단)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_admin') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    await expect(
      repo.updateSettlementSettings(
        POSTING_ID,
        { roles: [], allowances: {}, taxSettings: {} as never },
        ADMIN_ID
      )
    ).rejects.toThrow(PermissionError);
    expect(mockRpc).toHaveBeenCalledWith('is_admin');
  });

  it('workspaceId 가 undefined 인 레거시 row 는 PermissionError', async () => {
    const loadChain = makeChain({
      data: { id: POSTING_ID, owner_id: OWNER_ID, workspace_id: null },
      error: null,
    });
    mockFrom.mockReturnValueOnce(loadChain);
    mockParseJobPosting.mockReturnValue({ ...fakePosting, workspaceId: undefined });

    await expect(repo.closeWithTransaction(POSTING_ID, MEMBER_ID)).rejects.toThrow(PermissionError);
    // workspaceId guard 가 short-circuit → RPC 호출 없음
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Delete access (더 엄격: owner|admin only, member 차단)
// ============================================================================

describe('JobPostingRepository write-side — loadAndVerifyDeleteAccess (owner|admin only)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('owner 본인의 delete 호출은 권한 검증 RPC 0회로 통과', async () => {
    setupLoadAndUpdate();

    await repo.deleteWithTransaction(POSTING_ID, OWNER_ID).catch(() => {});

    // owner 분기로 short-circuit → 권한 검증 RPC(is_admin/is_workspace_member) 미호출.
    // (취소 후 best-effort 환불 RPC는 별개 — 권한 분기와 무관하므로 여기서 검증 대상 아님)
    expect(mockRpc).not.toHaveBeenCalledWith('is_admin');
    expect(mockRpc).not.toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
  });

  it('워크스페이스 멤버의 delete 호출은 PermissionError (member 차단)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(repo.deleteWithTransaction(POSTING_ID, MEMBER_ID)).rejects.toThrow(
      PermissionError
    );
    // delete 헬퍼는 is_workspace_member 분기 자체가 없으므로 호출 안 함
    expect(mockRpc).not.toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
  });

  it('admin 호출 시 is_admin RPC 만 호출하여 통과 (is_workspace_member 미호출)', async () => {
    setupLoadAndUpdate();
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'is_admin', error: null })
    );

    await repo.deleteWithTransaction(POSTING_ID, ADMIN_ID).catch(() => {});

    expect(mockRpc).toHaveBeenCalledWith('is_admin');
    expect(mockRpc).not.toHaveBeenCalledWith('is_workspace_member', expect.any(Object));
  });

  it('외부인의 delete 호출은 PermissionError', async () => {
    setupLoadAndUpdate();
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(repo.deleteWithTransaction(POSTING_ID, OUTSIDER_ID)).rejects.toThrow(
      PermissionError
    );
  });
});

// ============================================================================
// owner_id 필터 제거 회귀 가드 — RLS 단일 진실 (PR2 핵심)
// ============================================================================

describe('JobPostingRepository write-side — owner_id 필터 회귀 가드', () => {
  const repo = new SupabaseJobPostingRepository();

  it('closeWithTransaction 의 UPDATE 는 owner_id 필터를 사용하지 않는다 (RLS 의존)', async () => {
    const { updateChain } = setupLoadAndUpdate();

    await repo.closeWithTransaction(POSTING_ID, OWNER_ID).catch(() => {});

    // .eq 호출 인자 — id 만 있어야 하고 owner_id 는 없어야 함
    const eqCalls = (updateChain.eq as jest.Mock).mock.calls.map((c) => c[0]);
    expect(eqCalls).toContain('id');
    expect(eqCalls).not.toContain('owner_id');
  });

  it('reopenWithTransaction 도 동일 — owner_id 필터 없음', async () => {
    // reopen 은 status='active' 면 BusinessError 던지므로 closed 상태 fake 필요
    const loadChain = makeChain({
      data: { id: POSTING_ID, owner_id: OWNER_ID, workspace_id: WORKSPACE_ID, status: 'closed' },
      error: null,
    });
    const updateChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(loadChain).mockReturnValue(updateChain);
    mockParseJobPosting.mockReturnValue({ ...fakePosting, status: 'closed' });

    await repo.reopenWithTransaction(POSTING_ID, OWNER_ID).catch(() => {});

    const eqCalls = (updateChain.eq as jest.Mock).mock.calls.map((c) => c[0]);
    expect(eqCalls).toContain('id');
    expect(eqCalls).not.toContain('owner_id');
  });

  it('deleteWithTransaction 은 status=cancelled 직접 UPDATE를 수행 (지갑 제거 후 클라이언트 UPDATE)', async () => {
    const { updateChain } = setupLoadAndUpdate();
    (updateChain.update as jest.Mock).mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    await repo.deleteWithTransaction(POSTING_ID, OWNER_ID).catch(() => {});

    expect(updateChain.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      'cancel_job_posting_with_refund_atomically',
      expect.anything()
    );
  });
});
