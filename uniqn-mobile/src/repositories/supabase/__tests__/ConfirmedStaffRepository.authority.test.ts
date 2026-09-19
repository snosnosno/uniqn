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
      repo.markAsNoShow({ workLogId: WORK_LOG_ID, actorId: 'collab-1', reason: '무단결근' })
    ).resolves.not.toThrow();
    expect(capturedUpdate).toMatchObject({ status: 'no_show' });
  });

  it('외부인의 노쇼 처리는 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
    await expect(
      repo.markAsNoShow({ workLogId: WORK_LOG_ID, actorId: 'outsider-1', reason: 'x' })
    ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
  });
});

// 🗑️ `updateRoleWithTransaction` 권한 케이스는 메서드와 함께 삭제됐다 (감사 finding-04).
//    호출부 0건의 죽은 API 라 RPC 재구현이 아니라 제거가 정답이었다. 역할 편집의 권한 판정은
//    통합 시트가 쓰는 `update_work_log_slot` 안에서 서버가 한다(RLS wl_update 정확 재현).

/**
 * 근무시간 수정의 권한 판정은 **서버로 옮겨졌다**(2026-08-06, update_work_log_slot).
 *
 * 흡수 전에는 클라가 work_logs → job_postings 를 읽어 verifyPostingAuthority 로 판정했다.
 * 지금은 RPC 안에서 `auth.uid()` 기준으로 판정하고 클라는 RAISE 메시지를 앱 에러로 변환한다.
 * 판정 지점이 옮겨졌을 뿐 "외부인은 남의 근무 기록을 못 고친다"는 계약은 그대로다 —
 * 오히려 클라 우회가 불가능해졌다(선행 조회 자체가 사라졌다).
 *
 * 에러 코드가 SECURITY_UNAUTHORIZED_ACCESS → INFRA_PERMISSION_DENIED 로 바뀐 것은
 * 서버 RPC 계열의 공통 매핑(`toUpdateSlotError`)을 따르기 때문이다.
 */
describe('updateWorkTimeWithTransaction 권한 (서버 RPC 위임)', () => {
  const WORK_TIME_ARGS = {
    workLogId: WORK_LOG_ID,
    checkInTime: new Date('2026-07-20T09:00:00Z'),
    checkOutTime: null,
    reason: '정정',
    modifiedBy: 'outsider-1',
    actorId: 'outsider-1',
  };

  /** update_work_log_slot 만 지정 응답, 나머지 RPC(권한 헬퍼)는 false. */
  function installRpc(slotResult: { data: unknown; error: unknown }) {
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'update_work_log_slot' ? slotResult : { data: false, error: null })
    );
  }

  it('서버가 거부하면 PermissionError 로 변환하고 직접 UPDATE 는 발행하지 않는다', async () => {
    installRpc({
      data: null,
      error: { message: 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 수정할 수 있습니다' },
    });

    await expect(repo.updateWorkTimeWithTransaction(WORK_TIME_ARGS)).rejects.toMatchObject({
      code: ERROR_CODES.INFRA_PERMISSION_DENIED,
    });
    expect(capturedUpdate).toBeUndefined();
  });

  it('권한이 있으면 RPC 1회로 끝난다 — work_logs 선행 조회도 직접 UPDATE 도 없다', async () => {
    installRpc({ data: { success: true, assignmentSynced: true }, error: null });

    await expect(repo.updateWorkTimeWithTransaction(WORK_TIME_ARGS)).resolves.toBeUndefined();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(capturedUpdate).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
      p_work_log_id: WORK_LOG_ID,
      // 출근=기록 / 퇴근=삭제(JSON null) / 사유·수정자 명시 — 3상 계약 그대로 전달된다.
      p_patch: {
        checkIn: '2026-07-20T09:00:00.000Z',
        checkOut: null,
        reason: '정정',
        editedBy: 'outsider-1',
      },
    });
  });
});
