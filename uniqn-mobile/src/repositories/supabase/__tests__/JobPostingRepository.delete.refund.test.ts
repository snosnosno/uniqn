// src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import * as Sentry from '@sentry/react-native';

const mockRefund = jest.fn();
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: { refundJobCancellation: (...a: unknown[]) => mockRefund(...a) },
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
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
  captureException: jest.fn(),
}));

const mockParseJobPosting = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return { ...actual, parseJobPostingDocument: (...a: unknown[]) => mockParseJobPosting(...a) };
});

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '55555555-5555-4555-8555-555555555555';
const WORKSPACE = '66666666-6666-4666-8666-666666666666';

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'update', 'insert', 'delete']) {
    chain[m] = jest.fn(() => chain);
  }
  for (const m of ['single', 'maybeSingle']) chain[m] = jest.fn(() => Promise.resolve(returnValue));
  (chain as { then?: unknown }).then = (onf: (v: unknown) => unknown) =>
    Promise.resolve(returnValue).then(onf);
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

const fakePosting = {
  id: POSTING,
  ownerId: OWNER,
  workspaceId: WORKSPACE,
  title: 't',
  status: 'active',
  filledPositions: 0,
  schemaVersion: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  postingType: 'regular',
  location: { name: 'x' },
  schedule: {
    kind: 'dated',
    primaryDate: '2026-06-10',
    allDates: ['2026-06-10'],
    requirements: [],
  },
  roleCatalog: [],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRefund.mockReset();
  mockParseJobPosting.mockReset();
});

function setupOwnerDelete() {
  const loadChain = makeChain({
    data: { id: POSTING, owner_id: OWNER, workspace_id: WORKSPACE },
    error: null,
  });
  const updateChain = makeChain({ data: null, error: null });
  mockFrom.mockReturnValueOnce(loadChain).mockReturnValue(updateChain);
  mockParseJobPosting.mockReturnValue(fakePosting);
}

describe('deleteWithTransaction → 환불 연결', () => {
  const repo = new SupabaseJobPostingRepository();

  it('취소(CANCELLED) UPDATE 성공 후 refundJobCancellation(postingId, ownerId) 호출', async () => {
    setupOwnerDelete();
    mockRefund.mockResolvedValue({ success: false, error: 'no_consumption_found' });

    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(mockRefund).toHaveBeenCalledWith(POSTING, OWNER);
  });

  it('환불 RPC 실패는 swallow — 취소는 성립(throw 없음)', async () => {
    setupOwnerDelete();
    mockRefund.mockRejectedValue(new Error('refund down'));

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).resolves.toBeUndefined();
  });

  it('환불 RPC throw 시 Sentry.captureException 으로 관측 신호 기록', async () => {
    setupOwnerDelete();
    mockRefund.mockRejectedValue(new Error('refund down'));

    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('환불 success:false(unauthorized 등 예상외)는 Sentry breadcrumb 로 관측 + 취소 성립', async () => {
    setupOwnerDelete();
    mockRefund.mockResolvedValue({ success: false, error: 'unauthorized' });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).resolves.toBeUndefined();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'refund_returned_failure_after_cancel' })
    );
  });

  it('환불 no_consumption_found(무과금 no-op)는 경보 없이 통과', async () => {
    setupOwnerDelete();
    (Sentry.addBreadcrumb as jest.Mock).mockClear();
    (Sentry.captureException as jest.Mock).mockClear();
    mockRefund.mockResolvedValue({ success: false, error: 'no_consumption_found' });

    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
