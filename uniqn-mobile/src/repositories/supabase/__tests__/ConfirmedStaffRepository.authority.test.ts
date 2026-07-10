/**
 * ConfirmedStaffRepository 권한 통합 테스트 (2026-07-10 P0#3)
 *
 * - markAsNoShow / updateStatus: owner-only → owner|멤버|협업자 (verifyPostingAuthority)
 * - updateRole / updateWorkTime: 무검증이던 2경로에 가드 신설
 */
import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { ERROR_CODES } from '@/errors';

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

// 실제 zod 파서 대신 결정적 WorkLog 반환 — 권한 경로만 검증한다.
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return {
    ...actual,
    parseWorkLogDocument: (doc: Record<string, unknown>) => ({
      id: doc.id,
      jobPostingId: doc.jobPostingId ?? doc.job_posting_id ?? 'jp-1',
      staffId: 'staff-1',
      ownerId: 'owner-1',
      date: '2026-07-20',
      status: 'scheduled',
      role: 'dealer',
      roleChangeHistory: [],
    }),
  };
});

const OWNER = 'owner-1';
const WORK_LOG_ID = 'wl-1';
const JOB_POSTING_ID = 'jp-1';

// work_logs SELECT → job_postings SELECT → work_logs UPDATE 순서로 from() 이 불린다.
let updateError: unknown = null;
let capturedUpdate: Record<string, unknown> | undefined;

function makeChain(table: string) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    update: (data: Record<string, unknown>) => {
      capturedUpdate = data;
      return {
        eq: () => Promise.resolve({ error: updateError }),
      };
    },
    maybeSingle: () =>
      Promise.resolve(
        table === 'work_logs'
          ? {
              data: {
                id: WORK_LOG_ID,
                job_posting_id: JOB_POSTING_ID,
                staff_id: 'staff-1',
                owner_id: OWNER,
                date: '2026-07-20',
                status: 'scheduled',
                role: 'dealer',
                role_change_history: [],
              },
              error: null,
            }
          : {
              data: { id: JOB_POSTING_ID, owner_id: OWNER, workspace_id: 'ws-1' },
              error: null,
            }
      ),
  };
  return chain;
}

let repo: SupabaseConfirmedStaffRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  updateError = null;
  capturedUpdate = undefined;
  mockFrom.mockImplementation((table: string) => makeChain(table));
  mockRpc.mockResolvedValue({ data: false, error: null });
  repo = new SupabaseConfirmedStaffRepository();
});

describe('markAsNoShow 권한', () => {
  it('공고 협업자의 노쇼 처리는 통과한다', async () => {
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'is_posting_collaborator', error: null })
    );

    await expect(
      repo.markAsNoShow({ workLogId: WORK_LOG_ID, ownerId: 'collab-1', reason: '무단결근' })
    ).resolves.not.toThrow();
    expect(capturedUpdate).toMatchObject({ status: 'no_show' });
  });

  it('외부인의 노쇼 처리는 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
    await expect(
      repo.markAsNoShow({ workLogId: WORK_LOG_ID, ownerId: 'outsider-1', reason: 'x' })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
  });
});

describe('updateRoleWithTransaction 권한 (신규 가드)', () => {
  it('외부인의 역할 변경은 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
    await expect(
      repo.updateRoleWithTransaction({
        workLogId: WORK_LOG_ID,
        newRole: 'floor',
        isStandardRole: true,
        reason: '변경',
        changedBy: 'outsider-1',
        actorId: 'outsider-1',
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
    // 가드 실패 시 UPDATE 미발행
    expect(capturedUpdate).toBeUndefined();
  });

  it('owner 의 역할 변경은 통과한다 (RPC 0회)', async () => {
    await expect(
      repo.updateRoleWithTransaction({
        workLogId: WORK_LOG_ID,
        newRole: 'floor',
        isStandardRole: true,
        reason: '변경',
        changedBy: OWNER,
        actorId: OWNER,
      })
    ).resolves.not.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(capturedUpdate).toMatchObject({ role: 'floor' });
  });
});

describe('updateWorkTimeWithTransaction 권한 (신규 가드)', () => {
  it('외부인의 근무시간 수정은 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
    await expect(
      repo.updateWorkTimeWithTransaction({
        workLogId: WORK_LOG_ID,
        checkInTime: new Date('2026-07-20T09:00:00Z'),
        checkOutTime: null,
        reason: '정정',
        modifiedBy: 'outsider-1',
        actorId: 'outsider-1',
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
    expect(capturedUpdate).toBeUndefined();
  });
});
