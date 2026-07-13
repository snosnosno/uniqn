import type { CreateJobPostingInput, JobPosting, StaffRole, UpdateJobPostingInput } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import {
  bulkUpdateJobPostingStatus,
  closeJobPosting,
  createJobPosting,
  deleteJobPosting,
  getMyJobPostingStats,
  reopenJobPosting,
  updateJobPosting,
  updateJobPostingSettlementSettings,
} from '@/services/jobs/jobManagementService';

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockDeleteWithTransaction = jest.fn();
const mockCloseWithTransaction = jest.fn();
const mockReopenWithTransaction = jest.fn();
const mockGetStatsByOwnerId = jest.fn();
const mockBulkUpdateStatus = jest.fn();
const mockGetById = jest.fn();
const mockUpdateStatus = jest.fn();
const mockEnqueueScheduleBoardSync = jest.fn();
const mockGetDefaultWorkspaceIdForOwner = jest.fn();
const mockUpdateSettlementSettings = jest.fn();
const mockRequireCurrentUser = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    deleteWithTransaction: (...args: unknown[]) => mockDeleteWithTransaction(...args),
    closeWithTransaction: (...args: unknown[]) => mockCloseWithTransaction(...args),
    reopenWithTransaction: (...args: unknown[]) => mockReopenWithTransaction(...args),
    getStatsByOwnerId: (...args: unknown[]) => mockGetStatsByOwnerId(...args),
    bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    enqueueScheduleBoardSync: (...args: unknown[]) => mockEnqueueScheduleBoardSync(...args),
    updateSettlementSettings: (...args: unknown[]) => mockUpdateSettlementSettings(...args),
  },
}));

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: () => mockRequireCurrentUser(),
}));

jest.mock('@/services/workspace', () => ({
  workspaceService: {
    getDefaultWorkspaceIdForOwner: (...args: unknown[]) =>
      mockGetDefaultWorkspaceIdForOwner(...args),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
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
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

function createInput(overrides: Partial<CreateJobPostingInput> = {}): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Dealer Hiring',
    description: 'Canonical job posting',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01'],
      requirements: [
        {
          date: '2026-04-01',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [
                { role: 'dealer' as StaffRole, count: 2 },
                { role: 'manager' as StaffRole, count: 1 },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      {
        role: 'dealer' as StaffRole,
        salary: { type: 'hourly', amount: 15000 },
      },
      {
        role: 'manager' as StaffRole,
        salary: { type: 'hourly', amount: 18000 },
      },
    ],
    compensation: {
      mode: 'by_role',
    },
    questions: {
      items: [],
    },
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
    workDate: input.schedule.kind === 'dated' ? input.schedule.primaryDate : '2026-04-01',
    workDates: input.schedule.kind === 'dated' ? input.schedule.allDates : undefined,
    roleKeys: ['dealer', 'manager'],
    totalPositions: 3,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    location: input.location,
    schedule: input.schedule,
    roleCatalog: input.roleCatalog,
    compensation: input.compensation,
    questions: input.questions,
    ...overrides,
  };
}

describe('jobManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Phase 0 N1 hotfix: createJobPosting 은 항상 workspace lookup 을 먼저 수행.
    // 각 테스트가 별도로 override 가능.
    mockGetDefaultWorkspaceIdForOwner.mockResolvedValue('workspace-uuid-default');
  });

  describe('createJobPosting', () => {
    it('creates a single posting with canonical input', async () => {
      const input = createInput();
      const created = { id: 'job-1', jobPosting: createPosting() };
      mockCreateWithTransaction.mockResolvedValue(created);

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(false);
      expect(mockGetDefaultWorkspaceIdForOwner).toHaveBeenCalledWith('employer-1');
      expect(mockCreateWithTransaction).toHaveBeenCalledWith(input, {
        ownerId: 'employer-1',
        ownerName: 'Owner',
        workspaceId: 'workspace-uuid-default',
      });
    });

    it('Phase 0 N1 hotfix: workspace 23503 FK race 시 친화적 메시지로 변환', async () => {
      const input = createInput();
      const fkError = Object.assign(
        new Error('null value in column "workspace_id" violates not-null constraint'),
        {
          code: '23503',
        }
      );
      mockCreateWithTransaction.mockRejectedValue(fkError);

      await expect(createJobPosting(input, 'employer-1', 'Owner')).rejects.toThrow(
        /workspace|확인|시도/
      );
    });

    it('Phase 0 N1 hotfix: workspace 가 없으면 lookup 단계에서 BUSINESS_INVALID_STATE', async () => {
      const input = createInput();
      mockGetDefaultWorkspaceIdForOwner.mockRejectedValue(
        new Error('워크스페이스를 찾을 수 없어요. 잠시 후 다시 시도해주세요.')
      );

      await expect(createJobPosting(input, 'employer-1', 'Owner')).rejects.toThrow();
      expect(mockCreateWithTransaction).not.toHaveBeenCalled();
    });

    it('keeps regular multi-date postings as a single canonical post', async () => {
      const input = createInput({
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            {
              date: '2026-04-01',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'dealer' as StaffRole, count: 2 }],
                },
              ],
            },
            {
              date: '2026-04-02',
              timeSlots: [
                {
                  startTime: '19:00',
                  roles: [{ role: 'manager' as StaffRole, count: 1 }],
                },
              ],
            },
          ],
        },
      });

      mockCreateWithTransaction.mockResolvedValue({
        id: 'job-1',
        jobPosting: createPosting({
          schedule: input.schedule,
          workDate: '2026-04-01',
          workDates: ['2026-04-01', '2026-04-02'],
          roleCatalog: input.roleCatalog,
        }),
      });

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(false);
      expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);

      const payload = mockCreateWithTransaction.mock.calls[0]?.[0] as CreateJobPostingInput;
      expect(payload.schedule.kind).toBe('dated');
      if (payload.schedule.kind === 'dated') {
        expect(payload.schedule.allDates).toEqual(['2026-04-01', '2026-04-02']);
        expect(payload.schedule.requirements).toHaveLength(2);
      }
      expect(payload.roleCatalog).toEqual(input.roleCatalog);
    });

    it('does not split tournament postings even if dated schedule has multiple requirements', async () => {
      const input = createInput({
        postingType: 'tournament',
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            { date: '2026-04-01', timeSlots: [] },
            { date: '2026-04-02', timeSlots: [] },
          ],
        },
      });

      mockCreateWithTransaction.mockResolvedValue({
        id: 'job-1',
        jobPosting: createPosting({
          postingType: 'tournament',
          schedule: input.schedule,
          workDates: ['2026-04-01', '2026-04-02'],
        }),
      });

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(false);
      expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);
    });

    it('keeps custom roles intact in canonical multi-date payloads', async () => {
      const input = createInput({
        roleCatalog: [
          {
            role: 'other',
            customRole: 'MC',
            salary: { type: 'hourly', amount: 20000 },
          },
        ],
        compensation: {
          mode: 'by_role',
        },
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            {
              date: '2026-04-01',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'other', customRole: 'MC', count: 1 }],
                },
              ],
            },
            {
              date: '2026-04-02',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'other', customRole: 'MC', count: 1 }],
                },
              ],
            },
          ],
        },
      });

      mockCreateWithTransaction.mockResolvedValue({
        id: 'custom-1',
        jobPosting: createPosting({
          id: 'custom-1',
          roleCatalog: input.roleCatalog,
          schedule: input.schedule,
        }),
      });

      await createJobPosting(input, 'employer-1', 'Owner');

      const firstPayload = mockCreateWithTransaction.mock.calls[0]?.[0] as CreateJobPostingInput;
      expect(firstPayload.roleCatalog).toEqual(input.roleCatalog);
      expect(firstPayload.schedule.kind).toBe('dated');
    });

    it('propagates repository create failures without split rollback logic', async () => {
      const input = createInput({
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            { date: '2026-04-01', timeSlots: [] },
            { date: '2026-04-02', timeSlots: [] },
          ],
        },
      });

      mockCreateWithTransaction.mockRejectedValueOnce(new Error('write failed'));

      await expect(createJobPosting(input, 'employer-1', 'Owner')).rejects.toThrow('write failed');
      expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateJobPosting', () => {
    it('passes canonical update payloads through to the repository', async () => {
      const update: UpdateJobPostingInput = {
        compensation: {
          mode: 'shared',
          defaultSalary: { type: 'hourly', amount: 20000 },
        },
        questions: {
          items: [],
        },
      };
      const updated = createPosting({
        compensation: update.compensation!,
        questions: update.questions!,
      });
      mockUpdateWithTransaction.mockResolvedValue(updated);

      const result = await updateJobPosting('job-1', update, 'employer-1');

      expect(mockUpdateWithTransaction).toHaveBeenCalledWith('job-1', update, 'employer-1');
      expect(result.compensation.defaultSalary?.amount).toBe(20000);
    });

    it('passes fixed schedule updates through to the repository', async () => {
      const update: UpdateJobPostingInput = {
        postingType: 'fixed',
        schedule: {
          kind: 'fixed',
          daysPerWeek: 4,
          startTime: '19:00',
          requirements: [
            {
              date: null,
              timeSlots: [
                {
                  isTimeToBeAnnounced: false,
                  roles: [{ role: 'dealer', count: 5 }],
                },
              ],
            },
          ],
        },
        roleCatalog: [{ role: 'dealer' }],
      };
      const updated = createPosting({
        postingType: 'fixed',
        workDate: '',
        workDates: undefined,
        schedule: update.schedule!,
        roleCatalog: update.roleCatalog!,
      });
      mockUpdateWithTransaction.mockResolvedValue(updated);

      const result = await updateJobPosting('job-1', update, 'employer-1');

      expect(mockUpdateWithTransaction).toHaveBeenCalledWith('job-1', update, 'employer-1');
      expect(result.schedule.kind).toBe('fixed');
    });
  });

  describe('passthrough repository actions', () => {
    it('delegates delete/close/reopen', async () => {
      mockDeleteWithTransaction.mockResolvedValue(undefined);
      mockCloseWithTransaction.mockResolvedValue(undefined);
      mockReopenWithTransaction.mockResolvedValue(undefined);

      await deleteJobPosting('job-1', 'employer-1');
      await closeJobPosting('job-1', 'employer-1');
      await reopenJobPosting('job-1', 'employer-1');

      expect(mockDeleteWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
      expect(mockCloseWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
      expect(mockReopenWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('delegates stats and bulk status queries', async () => {
      mockGetStatsByOwnerId.mockResolvedValue({ total: 4, active: 2, closed: 1, cancelled: 1 });
      mockBulkUpdateStatus.mockResolvedValue(2);

      const stats = await getMyJobPostingStats('employer-1');
      const count = await bulkUpdateJobPostingStatus(['job-1', 'job-2'], 'closed', 'employer-1');

      expect(stats.total).toBe(4);
      expect(count).toBe(2);
      expect(mockGetStatsByOwnerId).toHaveBeenCalledWith('employer-1');
      expect(mockBulkUpdateStatus).toHaveBeenCalledWith(['job-1', 'job-2'], 'closed', 'employer-1');
    });
  });

  describe('updateJobPostingSettlementSettings', () => {
    const settlementData = {
      roles: [{ role: 'dealer', count: 1, filled: 0, salary: { type: 'hourly', amount: 15000 } }],
      allowances: {},
      taxSettings: { type: 'none' as const, value: 0 },
    };

    it('세션 사용자를 actorId로 리포지토리에 전달한다', async () => {
      mockRequireCurrentUser.mockResolvedValue({ id: 'session-user-1' });
      mockUpdateSettlementSettings.mockResolvedValue(undefined);

      await updateJobPostingSettlementSettings('job-1', settlementData);

      expect(mockUpdateSettlementSettings).toHaveBeenCalledTimes(1);
      const [jobPostingId, , actorId] = mockUpdateSettlementSettings.mock.calls[0];
      expect(jobPostingId).toBe('job-1');
      expect(actorId).toBe('session-user-1');
    });

    it('미로그인 시 에러를 던지고 리포지토리를 호출하지 않는다', async () => {
      mockRequireCurrentUser.mockRejectedValue(new Error('인증이 필요합니다.'));

      await expect(updateJobPostingSettlementSettings('job-1', settlementData)).rejects.toThrow(
        '인증이 필요합니다.'
      );
      expect(mockUpdateSettlementSettings).not.toHaveBeenCalled();
    });
  });
});
