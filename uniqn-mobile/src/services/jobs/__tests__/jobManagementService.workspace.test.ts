/**
 * P1#8 회귀: 공고 생성이 활성 워크스페이스(activeWorkspace)를 존중하는지 검증.
 *
 * 결함: createJobPosting 이 항상 getDefaultWorkspaceIdForOwner(가장 오래된 워크스페이스)로
 * 붙어, 워크스페이스 B 선택 후 만든 공고가 B 스코프 목록에서 사라졌다.
 *
 * 계약:
 * - 명시 workspaceId 전달 시 그 값을 사용(default 조회 생략)한다.
 * - 전달값이 owner 소유/멤버가 아니면 조용히 default 로 붙지 않고 명시 에러로 차단한다(fail-closed).
 * - 미전달(레거시) 시 기존 default 조회로 fallback 한다.
 * - 공고 수정(update)은 workspaceId 를 조회/전달/변경하지 않는다(이전 유지).
 */

import type { CreateJobPostingInput, JobPosting, StaffRole } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { ERROR_CODES } from '@/errors';
import { createJobPosting, updateJobPosting } from '@/services/jobs/jobManagementService';

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockEnqueueScheduleBoardSync = jest.fn();
const mockGetDefaultWorkspaceIdForOwner = jest.fn();
const mockIsMemberOfWorkspace = jest.fn();
const mockRequireCurrentUser = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    enqueueScheduleBoardSync: (...args: unknown[]) => mockEnqueueScheduleBoardSync(...args),
  },
}));

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: () => mockRequireCurrentUser(),
}));

jest.mock('@/services/workspace', () => ({
  workspaceService: {
    getDefaultWorkspaceIdForOwner: (...args: unknown[]) =>
      mockGetDefaultWorkspaceIdForOwner(...args),
    isMemberOfWorkspace: (...args: unknown[]) => mockIsMemberOfWorkspace(...args),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  // AppError 는 그대로 통과시켜 code 로 assert 가능하게 한다.
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

function createInput(overrides: Partial<CreateJobPostingInput> = {}): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Dealer Hiring',
    description: 'Canonical job posting',
    location: { name: 'Seoul Gangnam', address: 'Teheran-ro' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01'],
      requirements: [
        {
          date: '2026-04-01',
          timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer' as StaffRole, count: 2 }] }],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' as StaffRole, salary: { type: 'hourly', amount: 15000 } }],
    compensation: { mode: 'by_role' },
    questions: { items: [] },
    ...overrides,
  };
}

function createPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  const input = createInput();
  return {
    id: 'job-1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title,
    description: input.description,
    status: 'active',
    ownerId: 'employer-1',
    ownerName: 'Owner',
    postingType: input.postingType,
    workDate: '2026-04-01',
    workDates: ['2026-04-01'],
    roleKeys: ['dealer'],
    totalPositions: 2,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: input.location,
    schedule: input.schedule,
    roleCatalog: input.roleCatalog,
    compensation: input.compensation,
    questions: input.questions,
    ...overrides,
  };
}

describe('jobManagementService — activeWorkspace 스코프 (P1#8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultWorkspaceIdForOwner.mockResolvedValue('workspace-uuid-default');
    mockEnqueueScheduleBoardSync.mockResolvedValue(undefined);
  });

  describe('createJobPosting', () => {
    it('명시 workspaceId(멤버/소유)를 그대로 사용하고 default 조회를 건너뛴다', async () => {
      mockIsMemberOfWorkspace.mockResolvedValue(true);
      mockCreateWithTransaction.mockResolvedValue({ id: 'job-1', jobPosting: createPosting() });

      await createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-b');

      expect(mockIsMemberOfWorkspace).toHaveBeenCalledWith('workspace-b', 'employer-1');
      expect(mockGetDefaultWorkspaceIdForOwner).not.toHaveBeenCalled();
      expect(mockCreateWithTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ownerId: 'employer-1', workspaceId: 'workspace-b' })
      );
    });

    it('명시 workspaceId 가 owner 소유/멤버가 아니면 명시 에러로 차단하고 default 로 조용히 붙지 않는다', async () => {
      mockIsMemberOfWorkspace.mockResolvedValue(false);

      await expect(
        createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-foreign')
      ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });

      expect(mockCreateWithTransaction).not.toHaveBeenCalled();
      expect(mockGetDefaultWorkspaceIdForOwner).not.toHaveBeenCalled();
    });

    it('workspaceId 미전달(레거시) 시 default 워크스페이스로 fallback 한다', async () => {
      mockCreateWithTransaction.mockResolvedValue({ id: 'job-1', jobPosting: createPosting() });

      await createJobPosting(createInput(), 'employer-1', 'Owner');

      expect(mockGetDefaultWorkspaceIdForOwner).toHaveBeenCalledWith('employer-1');
      expect(mockIsMemberOfWorkspace).not.toHaveBeenCalled();
      expect(mockCreateWithTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ workspaceId: 'workspace-uuid-default' })
      );
    });
  });

  describe('updateJobPosting — workspace 불변', () => {
    it('공고 수정은 workspaceId 를 조회/전달/변경하지 않는다', async () => {
      mockUpdateWithTransaction.mockResolvedValue(createPosting());
      const update = { title: 'changed' } as never;

      await updateJobPosting('job-1', update, 'employer-1', null);

      expect(mockUpdateWithTransaction).toHaveBeenCalledWith('job-1', update, 'employer-1', null);
      expect(mockGetDefaultWorkspaceIdForOwner).not.toHaveBeenCalled();
      expect(mockIsMemberOfWorkspace).not.toHaveBeenCalled();
    });
  });
});
