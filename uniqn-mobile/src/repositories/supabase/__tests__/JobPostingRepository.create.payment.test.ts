// src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { isAppError } from '@/errors';
import { ERROR_CODES } from '@/errors/AppError';

const mockCreatePayment = jest.fn();
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    createJobPostingWithPayment: (...args: unknown[]) => mockCreatePayment(...args),
  },
}));
// expo-crypto.randomUUID()는 jest 환경에서 undefined를 반환하므로 결정적 UUID v4로 모킹.
// (프로덕션 디바이스에서는 정상 동작 — 멱등키 생성 경로 자체는 동일)
const CLIENT_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
jest.mock('@/utils/generateId', () => ({
  ...jest.requireActual('@/utils/generateId'),
  generateUUID: () => CLIENT_UUID,
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

const OWNER = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '66666666-6666-4666-8666-666666666666';
const NEW_ID = '99999999-9999-4999-8999-999999999999';

const input = {
  title: '강남 홀덤펍 딜러 모집',
  postingType: 'regular' as const,
  location: { name: '강남' },
  schedule: {
    kind: 'dated' as const,
    primaryDate: '2026-06-10',
    allDates: ['2026-06-10'],
    requirements: [
      {
        date: '2026-06-10',
        timeSlots: [{ start: '18:00', end: '23:00', roles: [{ role: 'dealer', count: 2 }] }],
      },
    ],
  },
  roleCatalog: [{ role: 'dealer' }],
  compensation: { mode: 'shared' as const },
  questions: { items: [] },
} as never;

const context = { ownerId: OWNER, ownerName: 'Owner', workspaceId: WORKSPACE };

beforeEach(() => mockCreatePayment.mockReset());

describe('createWithTransaction → 결제 RPC (R1: flag off 무료게시 동등)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('legacy INSERT가 넘기던 snake_case 필드 + 멱등 id를 payload로 결제 RPC 호출', async () => {
    mockCreatePayment.mockResolvedValue({
      success: true,
      posting_id: NEW_ID,
      diamonds_consumed: 0,
      hearts_consumed: 0,
      total_consumed: 0,
    });

    const result = await repo.createWithTransaction(input, context);

    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    const [ownerArg, payload, reason] = mockCreatePayment.mock.calls[0];
    expect(ownerArg).toBe(OWNER);
    expect(reason).toBe('consume_job_posting');

    // R1: legacy 직접 INSERT가 넘기던 핵심 snake_case 필드가 모두 보존돼야 함
    expect(payload.title).toBe('강남 홀덤펍 딜러 모집');
    expect(payload.owner_id).toBe(OWNER);
    expect(payload.workspace_id).toBe(WORKSPACE);
    expect(payload.posting_type).toBe('regular');
    expect(payload.schema_version).toBe(3);
    expect(payload.status).toBe('active');
    expect(payload.schedule).toBeDefined();
    expect(payload.role_catalog).toBeDefined();
    expect(payload.stats).toBeDefined();
    expect(payload.total_positions).toBeDefined();

    // 멱등키: 클라 생성 UUID가 payload.id로 유지 (legacy는 id를 제거했음 — 회귀 차단)
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    // payload에 undefined 값이 없어야 함 (removeUndefined 적용)
    expect(Object.values(payload).some((v) => v === undefined)).toBe(false);

    // 반환 id는 RPC의 posting_id를 사용
    expect(result.id).toBe(NEW_ID);
    expect(result.jobPosting.id).toBe(NEW_ID);
  });

  it('payload.id와 결제 RPC posting_id가 동일 (멱등키 round-trip)', async () => {
    mockCreatePayment.mockImplementation((_o: string, payload: { id: string }) =>
      Promise.resolve({
        success: true,
        posting_id: payload.id,
        diamonds_consumed: 0,
        hearts_consumed: 0,
        total_consumed: 0,
      })
    );
    const result = await repo.createWithTransaction(input, context);
    const payload = mockCreatePayment.mock.calls[0][1];
    expect(result.id).toBe(payload.id);
  });

  it('INSUFFICIENT_BALANCE 에러를 BusinessError(BUSINESS_INSUFFICIENT_BALANCE)로 매핑', async () => {
    mockCreatePayment.mockRejectedValue(new Error('INSUFFICIENT_BALANCE: have 0h+0d, need 10'));

    await expect(repo.createWithTransaction(input, context)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE,
    });
    expect(isAppError).toBeDefined();
  });
});
