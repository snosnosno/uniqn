/**
 * executeConfirmWithHistory — confirm_application RPC 파라미터 테스트
 *
 * Task 2 (SP2): 클라이언트가 더 이상 p_is_fixed_posting 을 RPC에 전달하지 않음을 보장.
 * DB RPC 가 이미 서버 내부에서 v_is_fixed 를 도출하므로 클라이언트 플래그 불필요.
 */

import { executeConfirmWithHistory } from '../ApplicationRepositoryTransactions';

// ─── supabase mock ───────────────────────────────────────────────────────────
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

// ─── domain helpers mock ─────────────────────────────────────────────────────
jest.mock('@/domains/application', () => ({
  createHistoryEntry: jest.fn().mockReturnValue({ id: 'hist-1', confirmedAt: new Date() }),
  findActiveConfirmation: jest.fn().mockReturnValue(null),
  validateAssignmentSlotCapacity: jest.fn().mockReturnValue({ available: true }),
}));

jest.mock('@/utils/supabase', () => ({
  handleSupabaseError: jest.fn(),
}));

// ─── fixtures ────────────────────────────────────────────────────────────────
const fixedAssignment = {
  groupId: 'g1',
  dates: ['2026-06-01'],
  timeSlot: '10:00-18:00',
  roleIds: ['dealer'],
  isTimeToBeAnnounced: false,
};

const fakeApplication = {
  id: 'app-1',
  jobPostingId: 'jp-1',
  applicantId: 'staff-uid',
  applicantName: '홍길동',
  status: 'applied',
  assignments: [fixedAssignment],
  confirmationHistory: [],
  originalApplication: null,
  createdAt: new Date('2026-06-01'),
};

const fakeJobPosting = {
  id: 'jp-1',
  ownerId: 'owner-uid',
  title: '테스트 공고',
  schedule: { kind: 'fixed' },
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('executeConfirmWithHistory — confirm_application RPC 파라미터', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadApplication.mockResolvedValue(fakeApplication);
    mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);
    mockRpc.mockResolvedValue({ data: { workLogIds: [] }, error: null });
  });

  it('confirm_application RPC 호출 시 p_is_fixed_posting 파라미터를 포함하지 않음', async () => {
    await executeConfirmWithHistory('app-1', undefined, 'owner-uid');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcParams] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];

    expect(rpcName).toBe('confirm_application');
    expect(rpcParams).not.toHaveProperty('p_is_fixed_posting');
  });

  it('fixed 공고일 때 선택된 assignments 대신 applicationData.assignments 를 사용 (선택 로직 유지)', async () => {
    const selectedAssignments = [{ ...fixedAssignment, dates: ['2026-06-02'] }];
    await executeConfirmWithHistory('app-1', selectedAssignments, 'owner-uid');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [, rpcParams] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];

    // fixed 공고는 selectedAssignments 를 무시하고 application.assignments 사용
    const flatAssignments = rpcParams['p_assignments'] as { date: string }[];
    expect(flatAssignments.some((a) => a.date === '2026-06-01')).toBe(true);
    expect(flatAssignments.some((a) => a.date === '2026-06-02')).toBe(false);
  });
});
